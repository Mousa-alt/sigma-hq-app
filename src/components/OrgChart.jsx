import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_ID, COLORS } from '../config';
import Icon from './Icon';

// Position hierarchy
const POSITIONS = [
  { id: 'executive', label: 'Executive Manager', level: 0, color: '#0F172A', department: 'Management' },
  { id: 'head', label: 'Head of Technical Office', level: 1, color: '#0A1628', department: 'Technical Office' },
  { id: 'team_leader', label: 'Team Leader', level: 2, color: '#1E40AF', department: 'Technical Office' },
  { id: 'senior', label: 'Senior TOE', level: 3, color: '#0369A1', department: 'Technical Office' },
  { id: 'toe', label: 'Technical Office Engineer', level: 4, color: '#0891B2', department: 'Technical Office' },
  { id: 'junior', label: 'Junior TOE', level: 5, color: '#06B6D4', department: 'Technical Office' },
  { id: 'trainee', label: 'Trainee', level: 6, color: '#22D3EE', department: 'Technical Office' },
  { id: 'senior_pm', label: 'Senior Project Manager', level: 1, color: '#7C3AED', department: 'Project Management' },
  { id: 'pm', label: 'Project Manager', level: 2, color: '#8B5CF6', department: 'Project Management' },
  { id: 'site_manager', label: 'Site Manager', level: 2, color: '#059669', department: 'Site' },
  { id: 'site_engineer', label: 'Site Engineer', level: 3, color: '#10B981', department: 'Site' },
  { id: 'supervisor', label: 'Supervisor', level: 4, color: '#34D399', department: 'Site' },
  { id: 'mep_team_leader', label: 'MEP Team Leader', level: 2, color: '#DC2626', department: 'MEP' },
  { id: 'mep_senior', label: 'Senior MEP Engineer', level: 3, color: '#EF4444', department: 'MEP' },
  { id: 'mep_toe', label: 'MEP Technical Office Engineer', level: 4, color: '#F87171', department: 'MEP' },
  { id: 'mep_junior', label: 'Junior MEP Engineer', level: 5, color: '#FCA5A5', department: 'MEP' },
  { id: 'planning_head', label: 'Head of Planning', level: 1, color: '#EA580C', department: 'Planning' },
  { id: 'planning_senior', label: 'Senior Planning Engineer', level: 2, color: '#F97316', department: 'Planning' },
  { id: 'planning_engineer', label: 'Planning Engineer', level: 3, color: '#FB923C', department: 'Planning' },
];

const DEPARTMENTS = ['Management', 'Technical Office', 'Project Management', 'Site', 'MEP', 'Planning'];

const DEPARTMENT_COLORS = {
  'Management': '#0F172A',
  'Technical Office': '#0A1628',
  'Project Management': '#7C3AED',
  'Site': '#059669',
  'MEP': '#DC2626',
  'Planning': '#EA580C'
};

export default function OrgChart({ projects }) {
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chart');
  const [selectedDepartment, setSelectedDepartment] = useState('Technical Office');

  useEffect(() => {
    const engineersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'engineers');
    const unsubEngineers = onSnapshot(engineersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEngineers(data);
    });

    const assignmentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'assignments');
    const unsubAssignments = onSnapshot(assignmentsRef, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubEngineers(); unsubAssignments(); };
  }, []);

  const handleSaveEngineer = async (formData) => {
    setLoading(true);
    try {
      if (editingEngineer) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'engineers', editingEngineer.id), formData);
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'engineers'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingEngineer(null);
    } catch (err) {
      alert('Error saving engineer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEngineer = async (id) => {
    if (!confirm('Remove this team member?')) return;
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'engineers', id));
  };

  const handleAssign = async (engineerId, projectId) => {
    const existing = assignments.find(a => a.engineerId === engineerId && a.projectId === projectId);
    if (existing) {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'assignments', existing.id));
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'assignments'), {
        engineerId,
        projectId,
        assignedAt: serverTimestamp()
      });
    }
  };

  const getEngineerProjects = (engineerId) => {
    return assignments
      .filter(a => a.engineerId === engineerId)
      .map(a => projects.find(p => p.id === a.projectId))
      .filter(Boolean);
  };

  const getEngineersByDepartment = (dept) => {
    return engineers.filter(e => {
      const pos = POSITIONS.find(p => p.id === e.position);
      return pos?.department === dept;
    });
  };

  const totalPeople = engineers.length;
  const totalProjects = projects.length;
  const departmentCounts = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = getEngineersByDepartment(dept).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organization</h1>
          <p className="text-slate-500 text-xs mt-0.5">Team structure & project assignments</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 bg-white px-4 py-2 rounded-xl border border-slate-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{totalPeople}</p>
              <p className="text-[10px] text-slate-400 uppercase">Team</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{totalProjects}</p>
              <p className="text-[10px] text-slate-400 uppercase">Projects</p>
            </div>
          </div>
          
          <button
            onClick={() => { setEditingEngineer(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium"
            style={{ backgroundColor: COLORS.blue }}
          >
            <Icon name="user-plus" size={16} />
            Add Member
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'chart' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          <Icon name="git-branch" size={14} className="inline mr-2" />
          Org Chart
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          <Icon name="list" size={14} className="inline mr-2" />
          Team List
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'assignments' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          <Icon name="grid-3x3" size={14} className="inline mr-2" />
          Assignments
        </button>
      </div>

      {activeTab === 'chart' ? (
        <div className="space-y-4">
          {/* Department Selector */}
          <div className="flex gap-2 flex-wrap">
            {DEPARTMENTS.filter(d => departmentCounts[d] > 0).map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedDepartment === dept 
                    ? 'text-white' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
                style={selectedDepartment === dept ? { backgroundColor: DEPARTMENT_COLORS[dept] } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedDepartment === dept ? 'white' : DEPARTMENT_COLORS[dept] }}></span>
                {dept}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedDepartment === dept ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {departmentCounts[dept]}
                </span>
              </button>
            ))}
          </div>

          {/* Org Chart - Based on Reporting Structure */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 overflow-x-auto">
            <ReportingTree 
              engineers={getEngineersByDepartment(selectedDepartment)}
              allEngineers={engineers}
              getEngineerProjects={getEngineerProjects}
              onEdit={(eng) => { setEditingEngineer(eng); setIsModalOpen(true); }}
              onDelete={handleDeleteEngineer}
            />
            
            {getEngineersByDepartment(selectedDepartment).length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="users" size={24} className="text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">No Team Members</h3>
                <p className="text-slate-500 mt-1 text-sm">Add members to {selectedDepartment}</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'list' ? (
        <TeamListView 
          engineers={engineers} 
          allEngineers={engineers}
          getEngineerProjects={getEngineerProjects}
          onEdit={(eng) => { setEditingEngineer(eng); setIsModalOpen(true); }}
          onDelete={handleDeleteEngineer}
        />
      ) : (
        <AssignmentMatrix 
          engineers={engineers}
          projects={projects}
          assignments={assignments}
          onAssign={handleAssign}
        />
      )}

      {isModalOpen && (
        <EngineerModal
          engineer={editingEngineer}
          engineers={engineers}
          onClose={() => { setIsModalOpen(false); setEditingEngineer(null); }}
          onSave={handleSaveEngineer}
          loading={loading}
        />
      )}
    </div>
  );
}

// Reporting Tree - Uses actual reportsTo relationships
function ReportingTree({ engineers, allEngineers, getEngineerProjects, onEdit, onDelete }) {
  if (engineers.length === 0) return null;

  // Build tree based on reportsTo
  // Find root nodes: people who don't report to anyone in this department
  const deptIds = new Set(engineers.map(e => e.id));
  
  const rootEngineers = engineers.filter(eng => {
    // No reportsTo = root
    if (!eng.reportsTo) return true;
    // Reports to someone outside this department = root for this view
    if (!deptIds.has(eng.reportsTo)) return true;
    return false;
  });

  // Sort roots by position level (highest first)
  rootEngineers.sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    return posA - posB;
  });

  // Get direct reports for a person
  const getDirectReports = (managerId) => {
    return engineers
      .filter(e => e.reportsTo === managerId)
      .sort((a, b) => {
        const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
        const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
        return posA - posB;
      });
  };

  return (
    <div className="flex flex-col items-center min-w-fit">
      {rootEngineers.map((root, idx) => (
        <div key={root.id} className="flex flex-col items-center">
          {idx > 0 && <div className="h-8" />}
          <PersonNode 
            engineer={root}
            engineers={engineers}
            getDirectReports={getDirectReports}
            getEngineerProjects={getEngineerProjects}
            onEdit={onEdit}
            onDelete={onDelete}
            isRoot={true}
          />
        </div>
      ))}
    </div>
  );
}

// Recursive Person Node with their reports
function PersonNode({ engineer, engineers, getDirectReports, getEngineerProjects, onEdit, onDelete, isRoot }) {
  const directReports = getDirectReports(engineer.id);
  const hasReports = directReports.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* The person card */}
      <TreeCard 
        engineer={engineer}
        projects={getEngineerProjects(engineer.id)}
        onEdit={() => onEdit(engineer)}
        onDelete={() => onDelete(engineer.id)}
      />

      {/* Connector and children */}
      {hasReports && (
        <>
          {/* Vertical line down from card */}
          <div className="w-0.5 h-6 bg-slate-300" />

          {/* Horizontal connector bar if multiple children */}
          {directReports.length > 1 && (
            <div className="relative flex justify-center">
              <div 
                className="h-0.5 bg-slate-300"
                style={{ 
                  width: `${(directReports.length - 1) * 200 + 100}px`,
                  maxWidth: '90vw'
                }}
              />
            </div>
          )}

          {/* Children */}
          <div className="flex gap-4 justify-center">
            {directReports.map((report, idx) => (
              <div key={report.id} className="flex flex-col items-center">
                {/* Vertical connector from horizontal bar */}
                <div className="w-0.5 h-6 bg-slate-300" />
                
                {/* Recursive child node */}
                <PersonNode 
                  engineer={report}
                  engineers={engineers}
                  getDirectReports={getDirectReports}
                  getEngineerProjects={getEngineerProjects}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isRoot={false}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Tree Card Component
function TreeCard({ engineer, projects, onEdit, onDelete }) {
  const pos = POSITIONS.find(p => p.id === engineer.position);
  
  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-300 transition-all group min-w-[180px] max-w-[200px] relative">
      {/* Position color indicator */}
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 rounded-t-xl"
        style={{ backgroundColor: pos?.color || '#94A3B8' }}
      />
      
      <div className="flex flex-col items-center text-center pt-1">
        {/* Avatar */}
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2"
          style={{ backgroundColor: pos?.color || '#94A3B8' }}
        >
          {engineer.name?.charAt(0) || '?'}
        </div>
        
        {/* Name */}
        <p className="font-semibold text-slate-900 text-sm truncate w-full" title={engineer.name}>
          {engineer.name}
        </p>
        
        {/* Position */}
        <p className="text-[10px] text-slate-500 mt-0.5 truncate w-full">
          {pos?.label || 'Unknown'}
        </p>
        
        {/* Phone */}
        {engineer.phone && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
            <Icon name="phone" size={10} />
            <span>{engineer.phone}</span>
          </div>
        )}
        
        {/* Assigned Projects */}
        {projects.length > 0 && !['executive', 'head'].includes(engineer.position) && (
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {projects.slice(0, 2).map(p => (
              <span key={p.id} className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                {p.name}
              </span>
            ))}
            {projects.length > 2 && (
              <span className="text-[8px] text-slate-400">+{projects.length - 2}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button 
          onClick={onEdit}
          className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50"
        >
          <Icon name="pencil" size={12} className="text-slate-500" />
        </button>
        <button 
          onClick={onDelete}
          className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-red-50"
        >
          <Icon name="trash-2" size={12} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

// Team List View
function TeamListView({ engineers, allEngineers, getEngineerProjects, onEdit, onDelete }) {
  // Get manager name
  const getManagerName = (reportsTo) => {
    if (!reportsTo) return '—';
    const manager = allEngineers.find(e => e.id === reportsTo);
    return manager?.name || '—';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Name</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Position</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Reports To</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Projects</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Contact</th>
            <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {engineers.map(eng => {
            const pos = POSITIONS.find(p => p.id === eng.position);
            const engProjects = getEngineerProjects(eng.id);
            return (
              <tr key={eng.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: pos?.color || '#94A3B8' }}
                    >
                      {eng.name?.charAt(0) || '?'}
                    </div>
                    <span className="font-medium text-slate-900 text-sm truncate">{eng.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{pos?.label || 'Unknown'}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs text-slate-500">{getManagerName(eng.reportsTo)}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {engProjects.slice(0, 2).map(p => (
                      <span key={p.id} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p.name}</span>
                    ))}
                    {engProjects.length > 2 && <span className="text-[10px] text-slate-400">+{engProjects.length - 2}</span>}
                    {engProjects.length === 0 && <span className="text-[10px] text-slate-300">None</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{eng.phone || eng.email || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onEdit(eng)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                    <Icon name="pencil" size={14} />
                  </button>
                  <button onClick={() => onDelete(eng.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 ml-1">
                    <Icon name="trash-2" size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {engineers.length === 0 && <div className="text-center py-12 text-slate-400">No team members yet</div>}
    </div>
  );
}

// Assignment Matrix
function AssignmentMatrix({ engineers, projects, assignments, onAssign }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 sticky left-0 bg-slate-50 min-w-[200px]">Team Member</th>
              {projects.map(p => (
                <th key={p.id} className="text-center text-xs font-semibold text-slate-600 px-3 py-3 min-w-[100px]">
                  <div className="truncate max-w-[100px]" title={p.name}>{p.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {engineers.map(eng => {
              const pos = POSITIONS.find(p => p.id === eng.position);
              const skipAssignment = ['executive', 'head'].includes(eng.position);
              
              return (
                <tr key={eng.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pos?.color || '#94A3B8' }}></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{eng.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{pos?.label || 'Unknown'}</p>
                      </div>
                    </div>
                  </td>
                  {projects.map(p => {
                    const isAssigned = assignments.some(a => a.engineerId === eng.id && a.projectId === p.id);
                    if (skipAssignment) {
                      return <td key={p.id} className="text-center px-3 py-3"><span className="text-[10px] text-slate-300">—</span></td>;
                    }
                    return (
                      <td key={p.id} className="text-center px-3 py-3">
                        <button
                          onClick={() => onAssign(eng.id, p.id)}
                          className={`w-8 h-8 rounded-lg transition-all ${isAssigned ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                        >
                          <Icon name={isAssigned ? 'check' : 'plus'} size={16} className="mx-auto" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {engineers.length === 0 && <div className="text-center py-12 text-slate-400">Add team members to start</div>}
      </div>
    </div>
  );
}

// Engineer Modal
function EngineerModal({ engineer, engineers, onClose, onSave, loading }) {
  const [formData, setFormData] = useState({
    name: engineer?.name || '',
    position: engineer?.position || 'toe',
    phone: engineer?.phone || '',
    email: engineer?.email || '',
    reportsTo: engineer?.reportsTo || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) return alert('Name is required');
    onSave(formData);
  };

  const currentPos = POSITIONS.find(p => p.id === formData.position);
  
  // Potential managers: anyone with a higher level position (lower level number)
  const potentialManagers = engineers.filter(e => {
    if (e.id === engineer?.id) return false; // Can't report to self
    const pos = POSITIONS.find(p => p.id === e.position);
    return pos && currentPos && pos.level < currentPos.level;
  }).sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    return posA - posB;
  });

  const positionsByDept = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = POSITIONS.filter(p => p.department === dept);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{engineer ? 'Edit' : 'Add'} Team Member</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <Icon name="x" size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Eng. Ahmed Hassan"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Position *</label>
            <select
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value, reportsTo: '' })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            >
              {DEPARTMENTS.map(dept => (
                <optgroup key={dept} label={dept}>
                  {positionsByDept[dept].map(pos => (
                    <option key={pos.id} value={pos.id}>{pos.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Reports To *</label>
            <select
              value={formData.reportsTo}
              onChange={(e) => setFormData({ ...formData, reportsTo: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            >
              <option value="">— No Manager (Top Level) —</option>
              {potentialManagers.map(m => {
                const mPos = POSITIONS.find(p => p.id === m.position);
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} ({mPos?.label})
                  </option>
                );
              })}
            </select>
            <p className="text-[9px] text-slate-400 mt-1">Who does this person directly report to?</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+201234567890"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ahmed@sigma.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Icon name="loader-2" size={16} className="animate-spin" />Saving...</> : <><Icon name="check" size={16} />{engineer ? 'Update' : 'Add'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
