import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_ID, COLORS, BRANDING } from '../config';
import Icon from './Icon';

// Position hierarchy - Planning now part of Technical Office group
const POSITIONS = [
  { id: 'executive', label: 'Executive Manager', level: 0, color: '#1e3a5f', department: 'Management' },
  { id: 'head', label: 'Head of Technical Office', level: 1, color: '#1e3a5f', department: 'Technical Office' },
  { id: 'team_leader', label: 'Team Leader', level: 2, color: '#2d5a87', department: 'Technical Office' },
  { id: 'senior', label: 'Senior TOE', level: 3, color: '#3d7ab0', department: 'Technical Office' },
  { id: 'toe', label: 'Technical Office Engineer', level: 4, color: '#5a9bd4', department: 'Technical Office' },
  { id: 'junior', label: 'Junior TOE', level: 5, color: '#7fb8e8', department: 'Technical Office' },
  { id: 'trainee', label: 'Trainee', level: 6, color: '#a8d4f5', department: 'Technical Office' },
  // Planning is part of Technical Office - orange tones
  { id: 'planning_head', label: 'Head of Planning', level: 2, color: '#c2410c', department: 'Technical Office' },
  { id: 'planning_senior', label: 'Senior Planning Engineer', level: 3, color: '#ea580c', department: 'Technical Office' },
  { id: 'planning_engineer', label: 'Planning Engineer', level: 4, color: '#fb923c', department: 'Technical Office' },
  // Other departments
  { id: 'senior_pm', label: 'Senior Project Manager', level: 1, color: '#5b21b6', department: 'Project Management' },
  { id: 'pm', label: 'Project Manager', level: 2, color: '#7c3aed', department: 'Project Management' },
  { id: 'site_manager', label: 'Site Manager', level: 2, color: '#047857', department: 'Site' },
  { id: 'site_engineer', label: 'Site Engineer', level: 3, color: '#059669', department: 'Site' },
  { id: 'supervisor', label: 'Supervisor', level: 4, color: '#10b981', department: 'Site' },
  { id: 'mep_team_leader', label: 'MEP Team Leader', level: 2, color: '#b91c1c', department: 'MEP' },
  { id: 'mep_senior', label: 'Senior MEP Engineer', level: 3, color: '#dc2626', department: 'MEP' },
  { id: 'mep_toe', label: 'MEP Technical Office Engineer', level: 4, color: '#ef4444', department: 'MEP' },
  { id: 'mep_junior', label: 'Junior MEP Engineer', level: 5, color: '#f87171', department: 'MEP' },
];

const DEPARTMENTS = ['Management', 'Technical Office', 'Project Management', 'Site', 'MEP'];

const DEPARTMENT_COLORS = {
  'Management': '#1e3a5f',
  'Technical Office': '#1e3a5f',
  'Project Management': '#5b21b6',
  'Site': '#047857',
  'MEP': '#b91c1c'
};

// Pastel background colors for different hierarchy levels
const LEVEL_BG_COLORS = [
  '#f0f9ff', // Level 0 - lightest blue
  '#e0f2fe', // Level 1
  '#bae6fd', // Level 2
  '#7dd3fc', // Level 3
  '#38bdf8', // Level 4
  '#0ea5e9', // Level 5
  '#0284c7', // Level 6
];

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

          {/* Org Chart */}
          {getEngineersByDepartment(selectedDepartment).length > 0 ? (
            <PremiumOrgChart 
              engineers={getEngineersByDepartment(selectedDepartment)}
              allEngineers={engineers}
              getEngineerProjects={getEngineerProjects}
              onEdit={(eng) => { setEditingEngineer(eng); setIsModalOpen(true); }}
              onDelete={handleDeleteEngineer}
              department={selectedDepartment}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="users" size={24} className="text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">No Team Members</h3>
                <p className="text-slate-500 mt-1 text-sm">Add members to {selectedDepartment}</p>
              </div>
            </div>
          )}
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

// Premium Org Chart - Spacious with color-coded levels
function PremiumOrgChart({ engineers, allEngineers, getEngineerProjects, onEdit, onDelete, department }) {
  const chartRef = useRef(null);
  
  if (!engineers || engineers.length === 0) return null;

  // Build tree structure based on reportsTo
  const buildTree = () => {
    const getChildren = (parentId) => {
      return engineers
        .filter(e => e.reportsTo === parentId)
        .sort((a, b) => {
          const posA = POSITIONS.find(p => p.id === a.position)?.level ?? 99;
          const posB = POSITIONS.find(p => p.id === b.position)?.level ?? 99;
          if (posA !== posB) return posA - posB;
          return (a.name || '').localeCompare(b.name || '');
        });
    };

    // Find roots - people without a manager in this department
    const roots = engineers.filter(e => {
      if (!e.reportsTo) return true;
      return !engineers.find(m => m.id === e.reportsTo);
    }).sort((a, b) => {
      const posA = POSITIONS.find(p => p.id === a.position)?.level ?? 99;
      const posB = POSITIONS.find(p => p.id === b.position)?.level ?? 99;
      return posA - posB;
    });

    const buildNode = (person, depth = 0) => ({
      person,
      depth,
      children: getChildren(person.id).map(c => buildNode(c, depth + 1))
    });

    return roots.map(r => buildNode(r, 0));
  };

  const trees = buildTree();

  // Download as PNG
  const handleDownload = async () => {
    if (!chartRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      link.download = `Sigma-OrgChart-${department}-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed');
    }
  };

  // Person Card Component - Color coded by depth
  const PersonCard = ({ person, depth, isRoot }) => {
    const pos = POSITIONS.find(p => p.id === person.position);
    const projects = getEngineerProjects(person.id);
    const bgColor = LEVEL_BG_COLORS[Math.min(depth, LEVEL_BG_COLORS.length - 1)];
    
    return (
      <div 
        className="relative rounded-2xl shadow-lg border-2 transition-all hover:shadow-xl hover:-translate-y-1 group"
        style={{ 
          width: 220,
          backgroundColor: bgColor,
          borderColor: pos?.color || '#64748B'
        }}
      >
        {/* Color accent bar */}
        <div 
          className="h-2 rounded-t-xl" 
          style={{ backgroundColor: pos?.color || '#64748B' }} 
        />
        
        <div className="p-5">
          {/* Avatar */}
          <div className="flex justify-center mb-4">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md border-4 border-white"
              style={{ backgroundColor: pos?.color || '#64748B' }}
            >
              {person.name?.charAt(0) || '?'}
            </div>
          </div>
          
          {/* Name */}
          <h3 className="font-bold text-slate-800 text-base text-center truncate mb-2">
            {person.name}
          </h3>
          
          {/* Position badge */}
          <div className="flex justify-center mb-3">
            <span 
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-white shadow-sm"
              style={{ backgroundColor: pos?.color || '#64748B' }}
            >
              {pos?.label || 'Team Member'}
            </span>
          </div>
          
          {/* Phone */}
          {person.phone && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-600 mb-2">
              <Icon name="phone" size={12} />
              <span>{person.phone}</span>
            </div>
          )}
          
          {/* Projects */}
          {projects.length > 0 && !['executive', 'head'].includes(person.position) && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {projects.slice(0, 2).map(p => (
                <span key={p.id} className="text-[10px] bg-white/80 text-slate-700 px-2 py-1 rounded-lg font-medium shadow-sm">
                  {p.name}
                </span>
              ))}
              {projects.length > 2 && (
                <span className="text-[10px] text-slate-500 font-medium">+{projects.length - 2}</span>
              )}
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="absolute -top-3 -right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={() => onEdit(person)} 
            className="p-2 bg-white border border-slate-200 rounded-full shadow-md hover:bg-blue-50 hover:border-blue-300"
          >
            <Icon name="pencil" size={12} className="text-slate-600" />
          </button>
          <button 
            onClick={() => onDelete(person.id)} 
            className="p-2 bg-white border border-slate-200 rounded-full shadow-md hover:bg-red-50 hover:border-red-300"
          >
            <Icon name="trash-2" size={12} className="text-red-500" />
          </button>
        </div>
      </div>
    );
  };

  // Tree Node with spacious connectors
  const TreeNode = ({ node, isRoot = false }) => {
    const { person, depth, children } = node;
    const hasChildren = children.length > 0;
    const cardWidth = 220;
    const horizontalGap = 40;
    
    return (
      <div className="flex flex-col items-center">
        {/* Person Card */}
        <PersonCard person={person} depth={depth} isRoot={isRoot} />
        
        {/* Children with connectors */}
        {hasChildren && (
          <>
            {/* Vertical line down from parent */}
            <div 
              className="w-1 rounded-full" 
              style={{ 
                height: 40, 
                background: 'linear-gradient(to bottom, #94a3b8, #cbd5e1)'
              }} 
            />
            
            {/* Horizontal line spanning all children */}
            {children.length > 1 && (
              <div 
                className="h-1 rounded-full" 
                style={{ 
                  width: `${(children.length - 1) * (cardWidth + horizontalGap)}px`,
                  background: 'linear-gradient(to right, #cbd5e1, #94a3b8, #cbd5e1)'
                }}
              />
            )}
            
            {/* Children row with spacing */}
            <div className="flex" style={{ gap: horizontalGap }}>
              {children.map((child) => (
                <div key={child.person.id} className="flex flex-col items-center">
                  {/* Vertical line down to each child */}
                  <div 
                    className="w-1 rounded-full" 
                    style={{ 
                      height: 40, 
                      background: 'linear-gradient(to bottom, #cbd5e1, #94a3b8)'
                    }} 
                  />
                  {/* Recurse */}
                  <TreeNode node={child} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">{department}</h2>
          <p className="text-xs text-slate-500">{currentDate}</p>
        </div>
        
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm hover:bg-slate-800 transition-all shadow-md"
        >
          <Icon name="download" size={14} />
          Export PNG
        </button>
      </div>
      
      {/* Chart with padding and logo */}
      <div ref={chartRef} className="p-12 overflow-x-auto bg-gradient-to-br from-white via-slate-50 to-white min-h-[500px] relative">
        {/* Main chart content */}
        <div className="flex flex-col items-center gap-12 min-w-fit pb-16">
          {trees.map((tree, idx) => (
            <TreeNode key={tree.person.id} node={tree} isRoot={idx === 0 && trees.length === 1} />
          ))}
        </div>
        
        {/* Logo watermark in bottom right */}
        <div className="absolute bottom-6 right-6 flex items-center gap-3 opacity-80">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-slate-100">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center" 
              style={{ backgroundColor: COLORS.blue }}
            >
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-800 text-sm">{BRANDING?.companyName || 'Sigma Contractors'}</p>
              <p className="text-[10px] text-slate-500">Technical Office HQ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Team List View
function TeamListView({ engineers, allEngineers, getEngineerProjects, onEdit, onDelete }) {
  const getManagerName = (reportsTo) => {
    if (!reportsTo) return '—';
    const manager = allEngineers.find(e => e.id === reportsTo);
    return manager?.name || '—';
  };

  const sortedEngineers = [...engineers].sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    if (posA !== posB) return posA - posB;
    return (a.name || '').localeCompare(b.name || '');
  });

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
          {sortedEngineers.map(eng => {
            const pos = POSITIONS.find(p => p.id === eng.position);
            const engProjects = getEngineerProjects(eng.id);
            return (
              <tr key={eng.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ backgroundColor: pos?.color || '#94A3B8' }}
                    >
                      {eng.name?.charAt(0) || '?'}
                    </div>
                    <span className="font-medium text-slate-900 text-sm">{eng.name}</span>
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
  const sortedEngineers = [...engineers].sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    return posA - posB;
  });

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
            {sortedEngineers.map(eng => {
              const pos = POSITIONS.find(p => p.id === eng.position);
              const skipAssignment = ['executive', 'head'].includes(eng.position);
              
              return (
                <tr key={eng.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pos?.color || '#94A3B8' }}></div>
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
  
  // Get managers from all engineers
  const potentialManagers = engineers.filter(e => {
    if (e.id === engineer?.id) return false;
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
        <div className="p-6 border-b border-slate-100">
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
            <label className="block text-xs font-medium text-slate-700 mb-2">Reports To</label>
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
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Saving...' : (engineer ? 'Update' : 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
