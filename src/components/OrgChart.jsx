import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_ID, COLORS } from '../config';
import Icon from './Icon';

// Position hierarchy levels
const POSITIONS = [
  { id: 'head', label: 'Head of Technical Office', level: 0, color: '#0A1628' },
  { id: 'team_leader', label: 'Team Leader', level: 1, color: '#1E40AF' },
  { id: 'senior', label: 'Senior Engineer', level: 2, color: '#0369A1' },
  { id: 'toe', label: 'Technical Office Engineer', level: 3, color: '#0891B2' },
  { id: 'junior', label: 'Junior Engineer', level: 4, color: '#06B6D4' },
  { id: 'trainee', label: 'Trainee', level: 5, color: '#22D3EE' },
  { id: 'planning_senior', label: 'Senior Planning Engineer', level: 1, color: '#7C3AED', department: 'Planning' },
];

const DEPARTMENTS = ['Technical Office', 'Planning'];

export default function OrgChart({ projects }) {
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' or 'assignments'

  // Load engineers
  useEffect(() => {
    const engineersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'engineers');
    const unsubEngineers = onSnapshot(engineersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEngineers(data.sort((a, b) => {
        const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
        const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
        return posA - posB;
      }));
    });

    const assignmentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'assignments');
    const unsubAssignments = onSnapshot(assignmentsRef, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubEngineers();
      unsubAssignments();
    };
  }, []);

  // Add/Edit engineer
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

  // Delete engineer
  const handleDeleteEngineer = async (id) => {
    if (!confirm('Remove this engineer?')) return;
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'engineers', id));
  };

  // Assign engineer to project
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

  // Group engineers by department and level
  const toEngineers = engineers.filter(e => {
    const pos = POSITIONS.find(p => p.id === e.position);
    return !pos?.department || pos.department === 'Technical Office';
  });
  
  const planningEngineers = engineers.filter(e => {
    const pos = POSITIONS.find(p => p.id === e.position);
    return pos?.department === 'Planning';
  });

  const getEngineerProjects = (engineerId) => {
    return assignments
      .filter(a => a.engineerId === engineerId)
      .map(a => projects.find(p => p.id === a.projectId))
      .filter(Boolean);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organization</h1>
          <p className="text-slate-500 text-xs mt-0.5">Team structure & project assignments</p>
        </div>
        <button
          onClick={() => { setEditingEngineer(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all"
          style={{ backgroundColor: COLORS.blue }}
        >
          <Icon name="user-plus" size={16} />
          Add Engineer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'chart' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'
          }`}
        >
          <Icon name="git-branch" size={14} className="inline mr-2" />
          Org Chart
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'assignments' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'
          }`}
        >
          <Icon name="grid-3x3" size={14} className="inline mr-2" />
          Assignment Matrix
        </button>
      </div>

      {activeTab === 'chart' ? (
        /* Org Chart View */
        <div className="bg-white rounded-xl border border-slate-200 p-6 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Technical Office Tree */}
            <div className="flex flex-col items-center">
              {/* Head */}
              {toEngineers.filter(e => e.position === 'head').map(eng => (
                <EngineerCard 
                  key={eng.id} 
                  engineer={eng} 
                  projects={getEngineerProjects(eng.id)}
                  onEdit={() => { setEditingEngineer(eng); setIsModalOpen(true); }}
                  onDelete={() => handleDeleteEngineer(eng.id)}
                />
              ))}
              
              {/* Branches: Team Leaders + Planning */}
              <div className="flex gap-16 mt-4">
                {/* Technical Office Branch */}
                <div className="flex flex-col items-center">
                  <div className="w-px h-8 bg-slate-300"></div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Technical Office</p>
                  
                  {/* Team Leaders */}
                  <div className="flex gap-8">
                    {toEngineers.filter(e => e.position === 'team_leader').map(tl => (
                      <div key={tl.id} className="flex flex-col items-center">
                        <EngineerCard 
                          engineer={tl} 
                          projects={getEngineerProjects(tl.id)}
                          onEdit={() => { setEditingEngineer(tl); setIsModalOpen(true); }}
                          onDelete={() => handleDeleteEngineer(tl.id)}
                        />
                        
                        {/* Team members under this leader */}
                        <div className="mt-3 space-y-2">
                          {toEngineers
                            .filter(e => e.reportsTo === tl.id)
                            .map(member => (
                              <EngineerCard 
                                key={member.id}
                                engineer={member}
                                projects={getEngineerProjects(member.id)}
                                size="small"
                                onEdit={() => { setEditingEngineer(member); setIsModalOpen(true); }}
                                onDelete={() => handleDeleteEngineer(member.id)}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Unassigned engineers */}
                  {toEngineers.filter(e => 
                    !['head', 'team_leader'].includes(e.position) && !e.reportsTo
                  ).length > 0 && (
                    <div className="mt-6 pt-4 border-t border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-400 mb-2">Unassigned</p>
                      <div className="flex flex-wrap gap-2">
                        {toEngineers.filter(e => 
                          !['head', 'team_leader'].includes(e.position) && !e.reportsTo
                        ).map(eng => (
                          <EngineerCard 
                            key={eng.id}
                            engineer={eng}
                            projects={getEngineerProjects(eng.id)}
                            size="small"
                            onEdit={() => { setEditingEngineer(eng); setIsModalOpen(true); }}
                            onDelete={() => handleDeleteEngineer(eng.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Planning Branch */}
                <div className="flex flex-col items-center">
                  <div className="w-px h-8 bg-purple-300"></div>
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-4">Planning</p>
                  
                  {planningEngineers.map(eng => (
                    <EngineerCard 
                      key={eng.id}
                      engineer={eng}
                      projects={getEngineerProjects(eng.id)}
                      onEdit={() => { setEditingEngineer(eng); setIsModalOpen(true); }}
                      onDelete={() => handleDeleteEngineer(eng.id)}
                    />
                  ))}
                  
                  {planningEngineers.length === 0 && (
                    <div className="text-xs text-slate-400 italic">No planning engineers</div>
                  )}
                </div>
              </div>
            </div>

            {/* Empty state */}
            {engineers.length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="users" size={24} className="text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">No Engineers Yet</h3>
                <p className="text-slate-500 mt-1 text-sm">Add your team to get started</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Assignment Matrix View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 sticky left-0 bg-slate-50">Engineer</th>
                  {projects.map(p => (
                    <th key={p.id} className="text-center text-xs font-semibold text-slate-600 px-3 py-3 min-w-[100px]">
                      <div className="truncate max-w-[100px]" title={p.name}>{p.name}</div>
                      <div className="text-[10px] font-normal text-slate-400">{p.venue || '-'}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engineers.map(eng => {
                  const pos = POSITIONS.find(p => p.id === eng.position);
                  return (
                    <tr key={eng.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: pos?.color || '#94A3B8' }}
                          ></div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{eng.name}</p>
                            <p className="text-[10px] text-slate-400">{pos?.label || 'Unknown'}</p>
                          </div>
                        </div>
                      </td>
                      {projects.map(p => {
                        const isAssigned = assignments.some(a => a.engineerId === eng.id && a.projectId === p.id);
                        return (
                          <td key={p.id} className="text-center px-3 py-3">
                            <button
                              onClick={() => handleAssign(eng.id, p.id)}
                              className={`w-8 h-8 rounded-lg transition-all ${
                                isAssigned 
                                  ? 'bg-emerald-100 text-emerald-600' 
                                  : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                              }`}
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
            
            {engineers.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                Add engineers to start assigning
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
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

// Engineer Card Component
function EngineerCard({ engineer, projects, size = 'normal', onEdit, onDelete }) {
  const pos = POSITIONS.find(p => p.id === engineer.position);
  const isSmall = size === 'small';

  return (
    <div 
      className={`bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group ${
        isSmall ? 'p-2 min-w-[120px]' : 'p-4 min-w-[180px]'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div 
            className={`rounded-full flex items-center justify-center text-white font-semibold ${
              isSmall ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
            }`}
            style={{ backgroundColor: pos?.color || '#94A3B8' }}
          >
            {engineer.name?.charAt(0) || '?'}
          </div>
          <div>
            <p className={`font-medium text-slate-900 ${isSmall ? 'text-xs' : 'text-sm'}`}>
              {engineer.name}
            </p>
            <p className={`text-slate-400 ${isSmall ? 'text-[9px]' : 'text-[10px]'}`}>
              {pos?.label || 'Unknown'}
            </p>
          </div>
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button onClick={onEdit} className="p-1 hover:bg-slate-100 rounded">
            <Icon name="pencil" size={12} className="text-slate-400" />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded">
            <Icon name="trash-2" size={12} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Assigned projects */}
      {projects.length > 0 && !isSmall && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Projects</p>
          <div className="flex flex-wrap gap-1">
            {projects.slice(0, 3).map(p => (
              <span key={p.id} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {p.name}
              </span>
            ))}
            {projects.length > 3 && (
              <span className="text-[10px] text-slate-400">+{projects.length - 3}</span>
            )}
          </div>
        </div>
      )}

      {/* Phone */}
      {engineer.phone && !isSmall && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
          <Icon name="phone" size={10} />
          {engineer.phone}
        </div>
      )}
    </div>
  );
}

// Engineer Modal Component
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

  // Get potential managers (higher level positions)
  const currentPos = POSITIONS.find(p => p.id === formData.position);
  const potentialManagers = engineers.filter(e => {
    const pos = POSITIONS.find(p => p.id === e.position);
    return pos && currentPos && pos.level < currentPos.level && e.id !== engineer?.id;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {engineer ? 'Edit Engineer' : 'Add Engineer'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <Icon name="x" size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              {POSITIONS.map(pos => (
                <option key={pos.id} value={pos.id}>
                  {pos.label} {pos.department ? `(${pos.department})` : ''}
                </option>
              ))}
            </select>
          </div>

          {potentialManagers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Reports To</label>
              <select
                value={formData.reportsTo}
                onChange={(e) => setFormData({ ...formData, reportsTo: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
              >
                <option value="">— Select Manager —</option>
                {potentialManagers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

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
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Icon name="loader-2" size={16} className="animate-spin" />Saving...</>
              ) : (
                <><Icon name="check" size={16} />{engineer ? 'Update' : 'Add Engineer'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
