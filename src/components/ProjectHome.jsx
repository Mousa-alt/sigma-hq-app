import { useState } from 'react';
import Icon from './Icon';
import FolderPopup from './FolderPopup';

export default function ProjectHome({ project, syncing, onSyncNow, onUpdateStatus }) {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Review shop drawings for Kitchen area', done: false },
    { id: 2, text: 'Send RFI response to consultant', done: false },
    { id: 3, text: 'Update BOQ with variation orders', done: true },
  ]);
  const [newTask, setNewTask] = useState('');
  const [activePopup, setActivePopup] = useState(null);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask, done: false }]);
    setNewTask('');
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // Quick link configurations matching 12-folder structure
  const quickLinks = [
    { id: 'contract', label: 'Contract', icon: 'file-text', color: 'blue', folder: '01-Contract Documents' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt', color: 'emerald', folder: '05-Quantity Surveying/Invoices' },
    { id: 'shop-drawings', label: 'Shop Drawings', icon: 'pencil-ruler', color: 'purple', folder: '04-Shop Drawings/Approved' },
    { id: 'drive', label: 'Open Drive', icon: 'external-link', color: 'orange', folder: null },
  ];

  const handleQuickLink = (link) => {
    if (link.folder === null) {
      // Open Drive directly
      project?.driveLink && window.open(project.driveLink, '_blank');
    } else {
      // Open popup with folder contents
      setActivePopup(link);
    }
  };

  const colorClasses = {
    blue: 'hover:border-blue-300 hover:bg-blue-50 text-blue-500',
    emerald: 'hover:border-emerald-300 hover:bg-emerald-50 text-emerald-500',
    purple: 'hover:border-purple-300 hover:bg-purple-50 text-purple-500',
    orange: 'hover:border-orange-300 hover:bg-orange-50 text-orange-500',
  };

  return (
    <div className="space-y-8">
      {/* Status & Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Area</p>
          <span className="text-2xl font-semibold text-slate-900">{project?.area || '—'} <span className="text-sm font-normal text-slate-400">m²</span></span>
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

      {/* Tasks */}
      <div>
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-4">Tasks</h3>
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
      </div>

      {/* Recent Actions (placeholder for WhatsApp/Outlook integration) */}
      <div>
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-4">Recent Actions</h3>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center">
          <Icon name="inbox" size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">WhatsApp & Outlook integration coming soon</p>
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
