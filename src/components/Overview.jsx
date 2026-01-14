import { useState, useEffect } from 'react';
import Icon from './Icon';
import { COLORS, SYNC_WORKER_URL } from '../config';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import DailyDigest from './DailyDigest';

export default function Overview({ projects, onSelectProject }) {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    urgentTasks: 0,
    recentActivity: 0
  });
  const [recentMessages, setRecentMessages] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Quick Add Task state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ text: '', project: '', urgency: 'medium' });
  const [addingTask, setAddingTask] = useState(false);

  useEffect(() => {
    // Listen to WhatsApp messages for stats
    const whatsappRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    
    const unsubWhatsapp = onSnapshot(whatsappRef, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Calculate stats
      const actionable = messages.filter(m => m.is_actionable);
      const completed = actionable.filter(m => m.status === 'done');
      const pending = actionable.filter(m => m.status !== 'done');
      const urgent = pending.filter(m => m.urgency === 'high');
      
      // Recent activity (last 24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = messages.filter(m => {
        const date = new Date(m.created_at || 0);
        return date > yesterday;
      });
      
      setStats({
        totalTasks: actionable.length,
        completedTasks: completed.length,
        pendingTasks: pending.length,
        urgentTasks: urgent.length,
        recentActivity: recent.length
      });
      
      // Get actual recent messages (not just counts)
      const recentList = messages
        .filter(m => m.is_actionable && m.status !== 'done')
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 8)
        .map(m => ({
          id: m.id,
          summary: m.summary || m.text?.substring(0, 60) || 'No summary',
          project: m.project_name || 'General',
          urgency: m.urgency || 'low',
          type: m.action_type || 'task',
          sender: m.sender_name || 'Unknown',
          time: m.created_at
        }));
      
      setRecentMessages(recentList);
      setLoading(false);
    }, (error) => {
      console.error('Firestore error:', error);
      setLoading(false);
    });

    // Load assignments for team counts
    const assignmentsRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'assignments');
    const unsubAssignments = onSnapshot(assignmentsRef, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Load engineers for counts
    const engineersRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'engineers');
    const unsubEngineers = onSnapshot(engineersRef, (snapshot) => {
      setEngineers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubWhatsapp();
      unsubAssignments();
      unsubEngineers();
    };
  }, [projects]);

  // Quick add task handler
  const handleAddTask = async () => {
    if (!newTask.text.trim()) {
      alert('Please enter a task description');
      return;
    }
    
    setAddingTask(true);
    try {
      // Add to whatsapp_messages collection as a manual task
      await addDoc(collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages'), {
        text: newTask.text.trim(),
        summary: newTask.text.trim(),
        project_name: newTask.project || 'General',
        is_actionable: true,
        action_type: 'task',
        urgency: newTask.urgency,
        status: 'pending',
        sender_name: 'Dashboard',
        group_name: 'Manual Entry',
        created_at: new Date().toISOString(),
        source: 'dashboard'
      });
      
      setNewTask({ text: '', project: '', urgency: 'medium' });
      setShowAddTask(false);
    } catch (err) {
      console.error('Error adding task:', err);
      alert('Error adding task');
    } finally {
      setAddingTask(false);
    }
  };

  // Get team count for a project
  const getProjectTeamCount = (projectId) => {
    return assignments.filter(a => a.projectId === projectId).length;
  };

  // Calculate project health
  const getProjectHealth = (project) => {
    const statuses = ['healthy', 'attention', 'healthy', 'healthy'];
    const index = projects.findIndex(p => p.id === project.id);
    return statuses[index % statuses.length];
  };

  const healthConfig = {
    healthy: { color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'On Track', icon: 'check-circle' },
    attention: { color: 'text-amber-500', bg: 'bg-amber-50', label: 'Needs Review', icon: 'alert-circle' },
    critical: { color: 'text-red-500', bg: 'bg-red-50', label: 'Critical', icon: 'alert-triangle' }
  };

  const statusConfig = {
    tender: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Tender', icon: 'file-text' },
    active: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Active', icon: 'play-circle' },
    on_hold: { color: 'text-slate-600', bg: 'bg-slate-100', label: 'On Hold', icon: 'pause-circle' },
    completed: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Completed', icon: 'check-circle' },
    planning: { color: 'text-purple-600', bg: 'bg-purple-50', label: 'Planning', icon: 'compass' },
  };

  const urgencyConfig = {
    high: { color: 'text-red-600', bg: 'bg-red-50', icon: 'alert-triangle' },
    medium: { color: 'text-amber-600', bg: 'bg-amber-50', icon: 'clock' },
    low: { color: 'text-slate-500', bg: 'bg-slate-50', icon: 'minus' }
  };

  const typeConfig = {
    task: { icon: 'check-square', label: 'Task' },
    approval_request: { icon: 'stamp', label: 'Approval' },
    decision_needed: { icon: 'help-circle', label: 'Decision' },
    invoice: { icon: 'receipt', label: 'Invoice' },
    deadline: { icon: 'calendar', label: 'Deadline' },
    info: { icon: 'info', label: 'Info' }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // FIXED: Proper date display logic
  const formatProjectDates = (project) => {
    const opts = { month: 'short', year: '2-digit' };
    const startStr = project.startDate 
      ? new Date(project.startDate).toLocaleDateString('en-US', opts) 
      : null;
    
    // Check if completed first
    if (project.status === 'completed' || project.completionDate) {
      const completedStr = project.completionDate 
        ? new Date(project.completionDate).toLocaleDateString('en-US', opts)
        : 'Completed';
      return startStr ? `${startStr} → ${completedStr}` : completedStr;
    }
    
    // For active/ongoing projects, show expected end date
    if (project.expectedEndDate) {
      const endStr = new Date(project.expectedEndDate).toLocaleDateString('en-US', opts);
      return startStr ? `${startStr} → ${endStr}` : `Target: ${endStr}`;
    }
    
    // Only start date known
    if (startStr) {
      return `${startStr} → ongoing`;
    }
    
    return null;
  };

  // Check if project is overdue
  const isProjectOverdue = (project) => {
    if (project.status === 'completed' || project.completionDate) return false;
    if (!project.expectedEndDate) return false;
    return new Date(project.expectedEndDate) < new Date();
  };

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 100;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Command Center</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick Add Task Button */}
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all"
          >
            <Icon name="plus" size={16} />
            Add Task
          </button>
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            System Online
          </span>
        </div>
      </div>

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Active Projects */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon name="briefcase" size={18} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{projects.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Projects</p>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Icon name="clipboard-list" size={18} className="text-amber-600" />
            </div>
            {stats.urgentTasks > 0 && (
              <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {stats.urgentTasks} urgent
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.pendingTasks}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pending Actions</p>
        </div>

        {/* Team Size */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Icon name="users" size={18} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{engineers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Team Members</p>
        </div>

        {/* Completion Rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Icon name="trending-up" size={18} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
          <p className="text-xs text-slate-500 mt-0.5">Task Completion</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Projects + Daily Digest */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects Grid - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Projects Overview</h2>
            <span className="text-xs text-slate-400">{projects.length} total</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(project => {
              const health = getProjectHealth(project);
              const healthStyle = healthConfig[health];
              const projectStatus = project.status || 'active';
              const statusStyle = statusConfig[projectStatus] || statusConfig.active;
              const teamCount = getProjectTeamCount(project.id);
              const dateDisplay = formatProjectDates(project);
              const overdue = isProjectOverdue(project);
              
              return (
                <div 
                  key={project.id} 
                  onClick={() => onSelectProject(project)} 
                  className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
                >
                  {/* Header stripe based on status */}
                  <div className={`h-1 ${
                    projectStatus === 'active' ? 'bg-emerald-500' : 
                    projectStatus === 'tender' ? 'bg-amber-500' :
                    projectStatus === 'on_hold' ? 'bg-slate-400' :
                    projectStatus === 'completed' ? 'bg-blue-500' :
                    projectStatus === 'planning' ? 'bg-purple-500' : 'bg-emerald-500'
                  }`} />
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors flex-shrink-0">
                          <Icon name="folder" size={20} className="text-slate-600 group-hover:text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">{project.name}</h3>
                          {project.client && (
                            <p className="text-[10px] text-slate-400 truncate">{project.client}</p>
                          )}
                        </div>
                      </div>
                      {/* Status badge */}
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0 ${statusStyle.bg}`}>
                        <Icon name={statusStyle.icon} size={10} className={statusStyle.color} />
                        <span className={`text-[9px] font-medium ${statusStyle.color}`}>{statusStyle.label}</span>
                      </div>
                    </div>
                    
                    {/* Project Details */}
                    <div className="space-y-2 mb-3">
                      {project.venue && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Icon name="map-pin" size={12} className="text-slate-400" />
                          <span className="truncate">{project.venue}</span>
                        </div>
                      )}
                      
                      {project.area && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Icon name="maximize-2" size={12} className="text-slate-400" />
                          <span>{project.area} m²</span>
                        </div>
                      )}

                      {dateDisplay && (
                        <div className={`flex items-center gap-2 text-xs ${overdue ? 'text-red-500' : 'text-slate-500'}`}>
                          <Icon name="calendar" size={12} className={overdue ? 'text-red-400' : 'text-slate-400'} />
                          <span>{dateDisplay}</span>
                          {overdue && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Overdue</span>}
                        </div>
                      )}
                    </div>
                    
                    {/* Footer with team count and sync status */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        {/* Team count */}
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Icon name="users" size={12} className="text-slate-400" />
                          <span>{teamCount} assigned</span>
                        </div>
                      </div>
                      
                      {/* Last sync indicator */}
                      {project.lastSyncAt && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Icon name="refresh-cw" size={10} />
                          <span>{formatTimeAgo(project.lastSyncAt?.toDate ? project.lastSyncAt.toDate() : project.lastSyncAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {projects.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Icon name="folder-plus" size={24} className="text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">No Projects Yet</h3>
                <p className="text-slate-500 mt-1 text-sm">Register your first project to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Daily Digest - Takes 1 column */}
        <div className="lg:col-span-1">
          <DailyDigest projects={projects} />
        </div>
      </div>

      {/* Recent Pending Items */}
      {recentMessages.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Icon name="inbox" size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pending Items</h2>
                <p className="text-xs text-slate-500">Requires your attention</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">{stats.pendingTasks} total</span>
          </div>
          
          <div className="divide-y divide-slate-100">
            {recentMessages.map((item) => {
              const urgencyStyle = urgencyConfig[item.urgency] || urgencyConfig.low;
              const typeInfo = typeConfig[item.type] || typeConfig.task;
              
              return (
                <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Urgency indicator */}
                    <div className={`p-1.5 rounded-lg ${urgencyStyle.bg} flex-shrink-0`}>
                      <Icon name={urgencyStyle.icon} size={14} className={urgencyStyle.color} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 line-clamp-2">{item.summary}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              {item.project}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Icon name={typeInfo.icon} size={10} />
                              {typeInfo.label}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              from {item.sender}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTimeAgo(item.time)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">AI-Powered Technical Office</h3>
            <p className="text-slate-400 text-xs mt-1">
              WhatsApp commands • Document search • Smart task tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <Icon name="message-circle" size={18} className="text-green-400" />
            </div>
            <div className="p-2 bg-white/10 rounded-lg">
              <Icon name="search" size={18} className="text-blue-400" />
            </div>
            <div className="p-2 bg-white/10 rounded-lg">
              <Icon name="zap" size={18} className="text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* All Clear State */}
      {!loading && stats.pendingTasks === 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon name="check-circle" size={24} className="text-emerald-600" />
          </div>
          <h3 className="text-sm font-semibold text-emerald-900">All Clear!</h3>
          <p className="text-emerald-700 mt-1 text-xs">No pending action items across all projects</p>
        </div>
      )}

      {/* Quick Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Icon name="check-square" size={20} className="text-amber-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">Quick Add Task</h2>
                </div>
                <button onClick={() => setShowAddTask(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <Icon name="x" size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Task Description *</label>
                <textarea
                  value={newTask.text}
                  onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
                  placeholder="e.g., Review shop drawings for Zone A, Follow up with consultant on RFI..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Project</label>
                  <select
                    value={newTask.project}
                    onChange={(e) => setNewTask({ ...newTask, project: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-400"
                  >
                    <option value="">General</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Urgency</label>
                  <select
                    value={newTask.urgency}
                    onChange={(e) => setNewTask({ ...newTask, urgency: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Urgent)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={addingTask}
                  className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingTask ? (
                    <><Icon name="loader-2" size={16} className="animate-spin" />Adding...</>
                  ) : (
                    <><Icon name="plus" size={16} />Add Task</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
