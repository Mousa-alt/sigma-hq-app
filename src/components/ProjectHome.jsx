import { useState, useEffect } from 'react';
import Icon from './Icon';
import FolderPopup from './FolderPopup';
import { SYNC_WORKER_URL } from '../config';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function ProjectHome({ project, syncing, lastSyncTime, onSyncNow, onUpdateProject }) {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Review shop drawings for Kitchen area', done: false, source: 'manual' },
    { id: 2, text: 'Send RFI response to consultant', done: false, source: 'manual' },
    { id: 3, text: 'Update BOQ with variation orders', done: true, source: 'manual' },
  ]);
  const [newTask, setNewTask] = useState('');
  const [activePopup, setActivePopup] = useState(null);
  const [editingDates, setEditingDates] = useState(false);
  const [dates, setDates] = useState({
    startDate: project?.startDate || '',
    expectedEndDate: project?.expectedEndDate || '',
    completionDate: project?.completionDate || ''
  });
  const [stats, setStats] = useState({ fileCount: 0, totalSize: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentEmails, setRecentEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [whatsappMessages, setWhatsappMessages] = useState([]);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [expandedMessage, setExpandedMessage] = useState(null);

  useEffect(() => {
    if (project) {
      loadStats();
      loadRecentEmails();
      setDates({
        startDate: project.startDate || '',
        expectedEndDate: project.expectedEndDate || '',
        completionDate: project.completionDate || ''
      });
    }
  }, [project?.id]);

  // Real-time WhatsApp messages listener - simple query, sort client-side
  useEffect(() => {
    if (!project?.name) return;
    
    setLoadingWhatsapp(true);
    const messagesRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    
    // Simple query without orderBy (no index needed)
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter by project and sort by created_at descending (client-side)
      const projectMessages = allMessages
        .filter(msg => msg.project_name === project.name)
        .sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 10);
      
      setWhatsappMessages(projectMessages);
      setLoadingWhatsapp(false);
    }, (error) => {
      console.error('WhatsApp messages error:', error);
      setLoadingWhatsapp(false);
    });

    return () => unsubscribe();
  }, [project?.name]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: project.name.replace(/\s+/g, '_') })
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadRecentEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/emails?project=${encodeURIComponent(project.name)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setRecentEmails(data.emails || []);
      }
    } catch (err) {
      console.error('Error loading emails:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  // Mark message as done - removes red badge
  const markMessageDone = async (msgId) => {
    try {
      const msgRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages', msgId);
      await updateDoc(msgRef, { 
        status: 'done',
        is_actionable: false,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error marking message done:', err);
    }
  };

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

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatEmailDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const saveDates = () => {
    if (onUpdateProject) {
      onUpdateProject({ ...project, ...dates });
    }
    setEditingDates(false);
  };

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

  const getUrgencyColor = (urgency) => {
    switch (urgency?.toLowerCase()) {
      case 'high': return 'text-red-500 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-500 bg-amber-50 border-amber-200';
      case 'low': return 'text-green-500 bg-green-50 border-green-200';
      default: return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-36 sm:pb-24">
      {/* Sync Status Bar */}
      <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${syncing ? 'bg-amber-100' : 'bg-emerald-100'}`}>
              <Icon name={syncing ? 'loader-2' : 'cloud-check'} size={16} className={`sm:w-5 sm:h-5 ${syncing ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                {syncing ? 'Syncing...' : 'Synced'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500">{formatLastSync()}</p>
            </div>
          </div>
          <button 
            onClick={onSyncNow} 
            disabled={syncing} 
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] sm:text-xs font-medium transition-all disabled:opacity-50 flex-shrink-0"
          >
            <Icon name="refresh-cw" size={12} className={`sm:w-3.5 sm:h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Now'}</span>
            <span className="sm:hidden">Sync</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Status</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${project?.completionDate ? 'bg-blue-500' : project?.status === 'Active' || !project?.status ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-xs sm:text-sm font-medium text-slate-900">{project?.completionDate ? 'Done' : (project?.status || 'Active')}</span>
          </div>
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Docs</p>
          {loadingStats ? (
            <Icon name="loader-2" size={14} className="animate-spin text-slate-400" />
          ) : (
            <span className="text-lg sm:text-xl font-semibold text-slate-900">{stats.fileCount}</span>
          )}
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Start</p>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-900">{formatDate(project?.startDate)}</span>
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">End</p>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-900">{formatDate(project?.expectedEndDate)}</span>
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Completion</p>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-900">{formatDate(project?.completionDate)}</span>
        </div>
      </div>

      {/* Edit Dates */}
      <div className="flex justify-end">
        {editingDates ? (
          <div className="w-full p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
              <div>
                <label className="block text-[9px] sm:text-[10px] text-slate-500 mb-1">Start</label>
                <input type="date" value={dates.startDate} onChange={(e) => setDates({...dates, startDate: e.target.value})} className="w-full px-2 py-1.5 border rounded text-xs" />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] text-slate-500 mb-1">Expected End</label>
                <input type="date" value={dates.expectedEndDate} onChange={(e) => setDates({...dates, expectedEndDate: e.target.value})} className="w-full px-2 py-1.5 border rounded text-xs" />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] text-slate-500 mb-1">Completion</label>
                <input type="date" value={dates.completionDate} onChange={(e) => setDates({...dates, completionDate: e.target.value})} className="w-full px-2 py-1.5 border rounded text-xs" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingDates(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-[10px] sm:text-xs font-medium">Cancel</button>
              <button onClick={saveDates} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] sm:text-xs font-medium">Save</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditingDates(true)} className="flex items-center gap-1.5 px-2 py-1 text-slate-500 hover:text-slate-700 text-[10px] sm:text-xs">
            <Icon name="edit-2" size={10} />Edit Dates
          </button>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2 sm:mb-3">Quick Links</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quickLinks.map(link => (
            <button key={link.id} onClick={() => handleQuickLink(link)} className={`flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl transition-all group ${colorClasses[link.color]}`}>
              <Icon name={link.icon} size={14} className={colorClasses[link.color].split(' ').pop()} />
              <span className="text-[10px] sm:text-xs font-medium text-slate-700">{link.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Hub */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400">Tasks Hub</h3>
          <span className="text-[8px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">AI coming soon</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex gap-2">
            <input 
              type="text" 
              value={newTask} 
              onChange={(e) => setNewTask(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && addTask()} 
              placeholder="Add task..." 
              className="flex-1 text-xs outline-none text-slate-900 placeholder:text-slate-400 min-w-0" 
            />
            <button onClick={addTask} className="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-medium hover:bg-blue-600 flex-shrink-0">Add</button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[150px] overflow-y-auto">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2 p-3 hover:bg-slate-50">
                <button onClick={() => toggleTask(task.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                  {task.done && <Icon name="check" size={10} />}
                </button>
                <span className={`flex-1 text-xs ${task.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</span>
                <button onClick={() => deleteTask(task.id)} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><Icon name="x" size={12} /></button>
              </div>
            ))}
            {tasks.length === 0 && <div className="p-4 text-center text-slate-400 text-xs">No tasks yet</div>}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400">Activity Feed</h3>
          <button onClick={loadRecentEmails} className="text-[9px] text-blue-500 hover:text-blue-600 flex items-center gap-1">
            <Icon name="refresh-cw" size={10} /> Refresh
          </button>
        </div>
        
        {/* Recent Emails */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Icon name="mail" size={12} className="text-blue-500" />
            <span className="text-[10px] font-medium text-slate-700">Recent Emails</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[100px] overflow-y-auto">
            {loadingEmails ? (
              <div className="p-3 flex items-center justify-center">
                <Icon name="loader-2" size={14} className="animate-spin text-slate-400" />
              </div>
            ) : recentEmails.length > 0 ? (
              recentEmails.map((email, idx) => (
                <div key={idx} className="p-2.5 hover:bg-slate-50">
                  <p className="text-[10px] font-medium text-slate-800 truncate">{email.subject}</p>
                  <p className="text-[9px] text-slate-500 truncate mt-0.5">{email.from}</p>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-slate-400 text-[10px]">No emails yet</div>
            )}
          </div>
        </div>

        {/* WhatsApp Messages */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Icon name="message-circle" size={12} className="text-green-500" />
            <span className="text-[10px] font-medium text-slate-700">WhatsApp</span>
            {whatsappMessages.filter(m => m.is_actionable && m.status !== 'done').length > 0 && (
              <span className="text-[8px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded ml-auto">
                {whatsappMessages.filter(m => m.is_actionable && m.status !== 'done').length} action
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
            {loadingWhatsapp ? (
              <div className="p-3 flex items-center justify-center">
                <Icon name="loader-2" size={14} className="animate-spin text-slate-400" />
              </div>
            ) : whatsappMessages.length > 0 ? (
              whatsappMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`cursor-pointer ${msg.is_actionable && msg.status !== 'done' ? 'border-l-2 border-l-amber-400' : ''} ${expandedMessage === msg.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  onClick={() => setExpandedMessage(expandedMessage === msg.id ? null : msg.id)}
                >
                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-medium text-slate-800 ${expandedMessage === msg.id ? '' : 'truncate'}`}>
                          {msg.summary || msg.text?.substring(0, 60)}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">
                          {msg.group_name || 'WhatsApp'} • {formatEmailDate(msg.created_at)}
                        </p>
                      </div>
                      {msg.is_actionable && msg.status !== 'done' && (
                        <span className={`text-[8px] px-1 py-0.5 rounded border flex-shrink-0 ${getUrgencyColor(msg.urgency)}`}>
                          {msg.urgency?.toUpperCase() || 'ACTION'}
                        </span>
                      )}
                    </div>
                    
                    {expandedMessage === msg.id && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{msg.text}</p>
                        {msg.is_actionable && msg.status !== 'done' && (
                          <div className="mt-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); markMessageDone(msg.id); }}
                              className="px-2 py-1 bg-green-500 text-white rounded text-[9px] font-medium hover:bg-green-600"
                            >
                              ✓ Mark Done
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-slate-400 text-[10px]">
                No WhatsApp messages yet
              </div>
            )}
          </div>
        </div>
      </div>

      {activePopup && <FolderPopup project={project} folder={activePopup.folder} title={activePopup.label} onClose={() => setActivePopup(null)} />}
    </div>
  );
}
