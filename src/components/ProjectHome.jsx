import { useState } from 'react';
import Icon from './Icon';
import FolderPopup from './FolderPopup';

export default function ProjectHome({ project, syncing, lastSyncTime, onSyncNow, onUpdateStatus }) {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Review shop drawings for Kitchen area', done: false, source: 'manual' },
    { id: 2, text: 'Send RFI response to consultant', done: false, source: 'manual' },
    { id: 3, text: 'Update BOQ with variation orders', done: true, source: 'manual' },
  ]);
  const [newTask, setNewTask] = useState('');
  const [activePopup, setActivePopup] = useState(null);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask, done: false, source: 'manual' }]);
    setNewTask('');
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never synced';
    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    const timeStr = date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
    
    if (diffMins < 1) return `Just now (${timeStr})`;
    if (diffMins < 60) return `${diffMins} min ago (${timeStr})`;
    if (diffHours < 24) return `${diffHours}h ago (${timeStr})`;
    return `${diffDays}d ago (${timeStr})`;
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Quick link configurations matching actual Drive structure
  const quickLinks = [
    { id: 'contract', label: 'Contract', icon: 'file-text', color: 'blue', folder: '01.Contract_Documents' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt', color: 'emerald', folder: '01.Contract_Documents/01.4_Invoices' },
    { id: 'shop-drawings', label: 'Shop Drawings', icon: 'ruler', color: 'purple', folder: '04.Shop_Drawings' },
    { id: 'drive', label: 'Open Drive', icon: 'external-link', color: 'orange', folder: null },
  ];

  const handleQuickLink = (link) => {
    if (link.folder === null) {
      project?.driveLink && window.open(project.driveLink, '_blank');
    } else {
      setActivePopup(link);
    }
  };

  const colorClasses = {
    blue: 'hover:border-blue-300 hover:bg-blue-50 text-blue-500',
    emerald: 'hover:border-emerald-300 hover:bg-emerald-50 text-emerald-500',
    purple: 'hover:border-purple-300 hover:bg-purple-50 text-purple-500',
    orange: 'hover:border-orange-300 hover:bg-orange-50 text-orange-500',
  };

  // Get task source icon
  const getSourceIcon = (source) => {
    switch (source) {
      case 'ai': return 'sparkles';
      case 'email': return 'mail';
      case 'mom': return 'users';
      case 'fireflies': return 'mic';
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Sync Status Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${syncing ? 'bg-amber-100' : 'bg-emerald-100'}`}>
            <Icon 
              name={syncing ? 'loader-2' : 'cloud-check'} 
              size={20} 
              className={syncing ? 'animate-spin text-amber-600' : 'text-emerald-600'} 
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {syncing ? 'Syncing...' : 'Synced with Google Drive'}
            </p>
            <p className="text-xs text-slate-500">
              Last sync: {formatLastSync()}
            </p>
          </div>
        </div>
        <button 
          onClick={onSyncNow} 
          disabled={syncing} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        >
          <Icon name="refresh-cw" size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Status & Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Status</p>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${project?.status === 'Active' || !project?.status ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-sm font-medium text-slate-900">{project?.status || 'Active'}</span>
          </div>
        </div>
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Documents</p>
          <span className="text-2xl font-semibold text-slate-900">277</span>
        </div>
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Start Date</p>
          <span className="text-sm font-semibold text-slate-900">{formatDate(project?.startDate)}</span>
        </div>
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">End Date</p>
          <span className="text-sm font-semibold text-slate-900">{formatDate(project?.endDate)}</span>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-4">Quick Links</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickLinks.map(link => (
            <button 
              key={link.id}
              onClick={() => handleQuickLink(link)} 
              className={`flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl transition-all group ${colorClasses[link.color]}`}
            >
              <Icon name={link.icon} size={18} className={colorClasses[link.color].split(' ').pop()} />
              <span className="text-xs font-medium text-slate-700">{link.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Hub */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Tasks Hub</h3>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-400 bg-slate-100 px-2 py-1 rounded-full">AI extraction coming soon</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Add task input */}
          <div className="p-4 border-b border-slate-100 flex gap-3">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add a new task..."
              className="flex-1 text-sm outline-none text-slate-900 placeholder:text-slate-400"
            />
            <button 
              onClick={addTask}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
            >
              Add
            </button>
          </div>
          
          {/* Task list */}
          <div className="divide-y divide-slate-100">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                <button 
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-blue-400'}`}
                >
                  {task.done && <Icon name="check" size={12} />}
                </button>
                <span className={`flex-1 text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {task.text}
                </span>
                {getSourceIcon(task.source) && (
                  <span className="text-[9px] text-slate-400 flex items-center gap-1">
                    <Icon name={getSourceIcon(task.source)} size={10} />
                    {task.source.toUpperCase()}
                  </span>
                )}
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                No tasks yet. Add one above.
              </div>
            )}
          </div>
        </div>
        
        {/* Future integrations teaser */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full flex items-center gap-1">
            <Icon name="mail" size={10} /> Outlook
          </span>
          <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full flex items-center gap-1">
            <Icon name="users" size={10} /> MOMs
          </span>
          <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full flex items-center gap-1">
            <Icon name="mic" size={10} /> Fireflies
          </span>
          <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full flex items-center gap-1">
            <Icon name="check-square" size={10} /> OneDrive To-Do
          </span>
        </div>
      </div>

      {/* Folder Popup */}
      {activePopup && (
        <FolderPopup
          project={project}
          folder={activePopup.folder}
          title={activePopup.label}
          onClose={() => setActivePopup(null)}
        />
      )}
    </div>
  );
}
