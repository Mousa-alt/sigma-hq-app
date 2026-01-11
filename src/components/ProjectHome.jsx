import { useState, useEffect } from 'react';
import Icon from './Icon';
import FolderPopup from './FolderPopup';
import { SYNC_WORKER_URL } from '../config';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, where, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';

// Project name aliases/abbreviations for fuzzy matching
const PROJECT_ALIASES = {
  'gem': ['grand egyptian museum', 'egyptian museum', 'gem'],
  'agora': ['agora', 'agora gem', 'agora-gem'],
  'eichholtz': ['eichholtz', 'eich'],
  'bahra': ['bahra', 'al bahra'],
  'ecolab': ['ecolab', 'eco lab', 'eco-lab'],
};

export default function ProjectHome({ project, syncing, lastSyncTime, onSyncNow, onUpdateProject }) {
  const [tasks, setTasks] = useState([]);
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
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskHubTab, setTaskHubTab] = useState('all');

  const statusConfig = {
    tender: { color: 'bg-amber-500', label: 'Tender' },
    planning: { color: 'bg-purple-500', label: 'Planning' },
    active: { color: 'bg-emerald-500', label: 'Active' },
    on_hold: { color: 'bg-slate-400', label: 'On Hold' },
    completed: { color: 'bg-blue-500', label: 'Completed' },
    overdue: { color: 'bg-red-500', label: 'Overdue' },
  };

  const getSmartStatus = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (project?.status === 'on_hold') return 'on_hold';
    if (project?.status === 'tender') return 'tender';
    if (project?.status === 'planning') return 'planning';
    if (project?.completionDate) {
      const completionDate = new Date(project.completionDate);
      completionDate.setHours(0, 0, 0, 0);
      if (completionDate <= now) return 'completed';
    }
    if (project?.expectedEndDate && !project?.completionDate) {
      const expectedEnd = new Date(project.expectedEndDate);
      expectedEnd.setHours(0, 0, 0, 0);
      if (expectedEnd < now) return 'overdue';
    }
    if (project?.startDate) {
      const startDate = new Date(project.startDate);
      startDate.setHours(0, 0, 0, 0);
      if (startDate <= now) return 'active';
      return 'planning';
    }
    return project?.status || 'active';
  };

  // Normalize text for matching
  const normalizeText = (text) => {
    if (!text) return '';
    return text.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  };

  // Fuzzy match: check if text contains project name or any of its aliases
  const fuzzyMatchProject = (text, projectName, projectVenue) => {
    if (!text) return false;
    const normalizedText = normalizeText(text);
    const normalizedProject = normalizeText(projectName);
    const normalizedVenue = normalizeText(projectVenue);
    
    // Direct match with project name
    if (normalizedText.includes(normalizedProject)) return true;
    
    // Match with venue (e.g., "Grand Egyptian Museum")
    if (normalizedVenue && normalizedText.includes(normalizedVenue)) return true;
    
    // Check project aliases
    const projectKey = normalizedProject.split(' ')[0]; // First word of project name
    const aliases = PROJECT_ALIASES[projectKey] || [];
    for (const alias of aliases) {
      if (normalizedText.includes(alias)) return true;
    }
    
    // Check venue aliases
    if (normalizedVenue) {
      const venueKey = normalizedVenue.split(' ')[0];
      const venueAliases = PROJECT_ALIASES[venueKey] || [];
      for (const alias of venueAliases) {
        if (normalizedText.includes(alias)) return true;
      }
    }
    
    return false;
  };

  // Check if email/message belongs to this project (smart matching)
  const belongsToProject = (item, checkBody = false) => {
    // If item has explicit project_name, use strict matching
    if (item.project_name) {
      const normalized = normalizeText(item.project_name);
      // Exclude command center items
      if (normalized === '__general__' || normalized === 'general' || normalized === 'command') {
        return false;
      }
      // Check if project_name matches this project
      if (fuzzyMatchProject(item.project_name, project?.name, project?.venue)) {
        return true;
      }
    }
    
    // For emails, also check subject and body
    if (item.subject) {
      if (fuzzyMatchProject(item.subject, project?.name, project?.venue)) return true;
    }
    if (checkBody && item.body) {
      if (fuzzyMatchProject(item.body.substring(0, 500), project?.name, project?.venue)) return true;
    }
    
    return false;
  };

  useEffect(() => {
    if (project) {
      loadStats();
      setDates({
        startDate: project.startDate || '',
        expectedEndDate: project.expectedEndDate || '',
        completionDate: project.completionDate || ''
      });
    }
  }, [project?.id]);

  // Tasks listener
  useEffect(() => {
    if (!project?.name) return;
    setLoadingTasks(true);
    const tasksRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'tasks');
    
    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const projectTasks = allTasks
        .filter(task => fuzzyMatchProject(task.project_name, project.name, project.venue))
        .sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 20);
      setTasks(projectTasks);
      setLoadingTasks(false);
    }, (error) => {
      console.error('Tasks error:', error);
      setLoadingTasks(false);
    });

    return () => unsubscribe();
  }, [project?.name, project?.venue]);

  // Emails listener - SMART MATCHING
  useEffect(() => {
    if (!project?.name) return;
    setLoadingEmails(true);
    const emailsRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'emails');
    
    const unsubscribe = onSnapshot(emailsRef, (snapshot) => {
      const allEmails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Smart filter: check project_name, subject, and body
      const projectEmails = allEmails
        .filter(email => belongsToProject(email, true))
        .sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(0);
          const dateB = b.date ? new Date(b.date) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 10);
      
      setRecentEmails(projectEmails);
      setLoadingEmails(false);
    }, (error) => {
      console.error('Emails error:', error);
      setLoadingEmails(false);
    });

    return () => unsubscribe();
  }, [project?.name, project?.venue]);

  // WhatsApp listener - SMART MATCHING
  useEffect(() => {
    if (!project?.name) return;
    setLoadingWhatsapp(true);
    const messagesRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Smart filter using fuzzy matching
      const projectMessages = allMessages
        .filter(msg => belongsToProject(msg, false))
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
  }, [project?.name, project?.venue]);

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

  const markMessageDone = async (msgId, type = 'whatsapp') => {
    try {
      const collectionName = type === 'email' ? 'emails' : 'whatsapp_messages';
      const msgRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', collectionName, msgId);
      await updateDoc(msgRef, { 
        status: 'done',
        is_actionable: false,
        is_read: true,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error marking message done:', err);
    }
  };

  const markEmailRead = async (emailId) => {
    try {
      const emailRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'emails', emailId);
      await updateDoc(emailRef, { is_read: true });
    } catch (err) {
      console.error('Error marking email read:', err);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const tasksRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'tasks');
      await addDoc(tasksRef, {
        text: newTask.trim(),
        done: false,
        source: 'manual',
        project_name: project.name,
        created_at: new Date().toISOString(),
        created_by: 'dashboard'
      });
      setNewTask('');
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  const toggleTask = async (taskId, currentDone) => {
    try {
      const taskRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'tasks', taskId);
      await updateDoc(taskRef, { 
        done: !currentDone,
        completed_at: !currentDone ? new Date().toISOString() : null
      });
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const taskRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'tasks', taskId);
      await deleteDoc(taskRef);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
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

  const getActionTypeStyle = (actionType) => {
    switch (actionType) {
      case 'task': return { label: 'Task', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'query': return { label: 'Query', color: 'text-purple-600 bg-purple-50 border-purple-200' };
      case 'info': return { label: 'Info', color: 'text-slate-600 bg-slate-50 border-slate-200' };
      case 'decision_needed': return { label: 'Decision', color: 'text-red-600 bg-red-50 border-red-200' };
      case 'approval_request': return { label: 'Approval', color: 'text-amber-600 bg-amber-50 border-amber-200' };
      case 'deadline': return { label: 'Deadline', color: 'text-red-600 bg-red-50 border-red-200' };
      case 'invoice': return { label: 'Invoice', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
      default: return { label: 'Message', color: 'text-slate-500 bg-slate-50 border-slate-200' };
    }
  };

  const getEmailTypeStyle = (docType) => {
    switch (docType) {
      case 'rfi': return { label: 'RFI', color: 'text-purple-600 bg-purple-50 border-purple-200' };
      case 'approval': return { label: 'Approval', color: 'text-amber-600 bg-amber-50 border-amber-200' };
      case 'vo': return { label: 'Variation', color: 'text-red-600 bg-red-50 border-red-200' };
      case 'submittal': return { label: 'Submittal', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'invoice': return { label: 'Invoice', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
      case 'mom': return { label: 'Meeting', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
      default: return { label: 'Email', color: 'text-slate-500 bg-slate-50 border-slate-200' };
    }
  };

  const getTaskSourceStyle = (source) => {
    switch (source) {
      case 'whatsapp': return { label: 'WhatsApp', color: 'text-green-600 bg-green-50', icon: 'message-circle' };
      case 'email': return { label: 'Email', color: 'text-blue-600 bg-blue-50', icon: 'mail' };
      case 'meeting': return { label: 'Meeting', color: 'text-purple-600 bg-purple-50', icon: 'users' };
      default: return { label: 'Manual', color: 'text-slate-600 bg-slate-50', icon: 'edit-2' };
    }
  };

  const currentStatus = getSmartStatus();
  const statusDisplay = statusConfig[currentStatus] || statusConfig.active;

  const actionableWhatsapp = whatsappMessages.filter(m => m.is_actionable && m.status !== 'done');
  const actionableEmails = recentEmails.filter(e => e.is_actionable && e.status !== 'done');
  const incompleteTasks = tasks.filter(t => !t.done);

  const buildUnifiedTasks = () => {
    let items = [];
    if (taskHubTab === 'all' || taskHubTab === 'manual') {
      items.push(...tasks.map(t => ({
        id: t.id, type: 'task', text: t.text, done: t.done, source: t.source || 'manual',
        created_at: t.created_at, urgency: 'medium'
      })));
    }
    if (taskHubTab === 'all' || taskHubTab === 'whatsapp') {
      items.push(...actionableWhatsapp.map(m => ({
        id: m.id, type: 'whatsapp', text: m.summary || m.text?.substring(0, 80) || 'WhatsApp action',
        done: m.status === 'done', source: 'whatsapp', created_at: m.created_at,
        urgency: m.urgency || 'medium', action_type: m.action_type, sender: m.sender_name || m.group_name
      })));
    }
    if (taskHubTab === 'all' || taskHubTab === 'email') {
      items.push(...actionableEmails.map(e => ({
        id: e.id, type: 'email', text: e.subject || 'Email action', done: e.status === 'done',
        source: 'email', created_at: e.date, urgency: 'medium',
        action_type: e.doc_type, sender: e.from?.split('<')[0]?.trim()
      })));
    }
    return items.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });
  };

  const unifiedTasks = buildUnifiedTasks();
  const totalActionable = incompleteTasks.length + actionableWhatsapp.length + actionableEmails.length;

  const getCompletionDisplay = () => {
    if (project?.completionDate) return { text: formatDate(project.completionDate), color: 'text-emerald-600' };
    if (currentStatus === 'overdue') return { text: 'Overdue', color: 'text-red-500' };
    return { text: 'Ongoing', color: 'text-slate-400' };
  };

  const completionDisplay = getCompletionDisplay();

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
              <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{syncing ? 'Syncing...' : 'Synced'}</p>
              <p className="text-[10px] sm:text-xs text-slate-500">{formatLastSync()}</p>
            </div>
          </div>
          <button onClick={onSyncNow} disabled={syncing} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] sm:text-xs font-medium transition-all disabled:opacity-50 flex-shrink-0">
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
            <div className={`w-2 h-2 rounded-full ${statusDisplay.color}`} />
            <span className="text-xs sm:text-sm font-medium text-slate-900">{statusDisplay.label}</span>
          </div>
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Docs</p>
          {loadingStats ? <Icon name="loader-2" size={14} className="animate-spin text-slate-400" /> : <span className="text-lg sm:text-xl font-semibold text-slate-900">{stats.fileCount}</span>}
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Start</p>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-900">{formatDate(project?.startDate)}</span>
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Target</p>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-900">{formatDate(project?.expectedEndDate)}</span>
        </div>
        <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Completed</p>
          <span className={`text-[10px] sm:text-xs font-semibold ${completionDisplay.color}`}>{completionDisplay.text}</span>
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
                <label className="block text-[9px] sm:text-[10px] text-slate-500 mb-1">Target End</label>
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
          {totalActionable > 0 && (
            <span className="text-[8px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">{totalActionable} pending</span>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex gap-1 overflow-x-auto">
            {[
              { id: 'all', label: 'All', count: incompleteTasks.length + actionableWhatsapp.length + actionableEmails.length },
              { id: 'manual', label: 'Manual', count: incompleteTasks.length, icon: 'edit-2' },
              { id: 'whatsapp', label: 'WhatsApp', count: actionableWhatsapp.length, icon: 'message-circle' },
              { id: 'email', label: 'Email', count: actionableEmails.length, icon: 'mail' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setTaskHubTab(tab.id)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium whitespace-nowrap transition-colors ${taskHubTab === tab.id ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-200'}`}>
                {tab.icon && <Icon name={tab.icon} size={10} />}
                {tab.label}
                {tab.count > 0 && <span className={`ml-1 px-1 rounded text-[8px] ${taskHubTab === tab.id ? 'bg-blue-400' : 'bg-slate-300'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="p-3 border-b border-slate-100 flex gap-2">
            <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTask()} placeholder="Add task..." className="flex-1 text-xs outline-none text-slate-900 placeholder:text-slate-400 min-w-0" />
            <button onClick={addTask} className="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-medium hover:bg-blue-600 flex-shrink-0">Add</button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
            {loadingTasks && loadingWhatsapp && loadingEmails ? (
              <div className="p-4 text-center"><Icon name="loader-2" size={16} className="animate-spin text-slate-400 mx-auto" /></div>
            ) : unifiedTasks.length > 0 ? (
              unifiedTasks.slice(0, 15).map(item => {
                const sourceStyle = getTaskSourceStyle(item.source);
                return (
                  <div key={`${item.type}-${item.id}`} className={`flex items-start gap-2 p-3 hover:bg-slate-50 ${item.urgency === 'high' ? 'border-l-2 border-l-red-400' : ''}`}>
                    <button onClick={() => { if (item.type === 'task') { toggleTask(item.id, item.done); } else { markMessageDone(item.id, item.type === 'email' ? 'email' : 'whatsapp'); } }} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-blue-400'}`}>
                      {item.done && <Icon name="check" size={10} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs block ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.text}</span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Icon name={sourceStyle.icon} size={9} className={sourceStyle.color.split(' ')[0]} />
                          <span className={`text-[8px] ${sourceStyle.color.split(' ')[0]}`}>{sourceStyle.label}</span>
                        </div>
                        {item.sender && <span className="text-[8px] text-slate-400">• {item.sender}</span>}
                        {item.urgency === 'high' && <span className="text-[8px] text-red-500 font-medium">🔴 Urgent</span>}
                      </div>
                    </div>
                    {item.type === 'task' && (
                      <button onClick={() => deleteTask(item.id)} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><Icon name="x" size={12} /></button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-400 text-xs">✨ No pending tasks!</div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">Activity Feed</h3>
        
        {/* Emails */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3">
          <div className="p-2.5 border-b border-slate-100 bg-blue-50 flex items-center gap-2">
            <Icon name="mail" size={12} className="text-blue-500" />
            <span className="text-[10px] font-medium text-slate-700">Emails</span>
            {recentEmails.filter(e => e.is_actionable && e.status !== 'done').length > 0 && (
              <span className="text-[8px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded ml-auto">
                {recentEmails.filter(e => e.is_actionable && e.status !== 'done').length} action
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
            {loadingEmails ? (
              <div className="p-3 flex items-center justify-center"><Icon name="loader-2" size={14} className="animate-spin text-slate-400" /></div>
            ) : recentEmails.length > 0 ? (
              recentEmails.map((email) => {
                const typeStyle = getEmailTypeStyle(email.doc_type);
                const isUnread = !email.is_read;
                return (
                  <div key={email.id} className={`cursor-pointer ${email.is_actionable && email.status !== 'done' ? 'border-l-2 border-l-blue-400' : ''} ${isUnread ? 'bg-blue-50/50' : ''} ${expandedEmail === email.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`} onClick={() => { setExpandedEmail(expandedEmail === email.id ? null : email.id); markEmailRead(email.id); }}>
                    <div className="p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {isUnread && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                            <p className={`text-[10px] font-medium text-slate-800 ${expandedEmail === email.id ? '' : 'truncate'} ${isUnread ? 'font-semibold' : ''}`}>{email.subject}</p>
                          </div>
                          <p className="text-[9px] text-slate-500 truncate">{email.from?.split('<')[0]?.trim() || 'Unknown'} • {formatEmailDate(email.date)}</p>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${typeStyle.color}`}>{typeStyle.label}</span>
                      </div>
                      {expandedEmail === email.id && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-[9px] text-slate-600 mb-1">From: {email.from}</p>
                          {email.to && <p className="text-[9px] text-slate-600 mb-2">To: {email.to}</p>}
                          <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-6">{email.body}</p>
                          {email.attachments_count > 0 && <p className="text-[9px] text-slate-500 mt-2 flex items-center gap-1"><Icon name="paperclip" size={10} /> {email.attachments_count} attachment(s)</p>}
                          {email.is_actionable && email.status !== 'done' && (
                            <div className="mt-2">
                              <button onClick={(e) => { e.stopPropagation(); markMessageDone(email.id, 'email'); }} className="px-2 py-1 bg-green-500 text-white rounded text-[9px] font-medium hover:bg-green-600">✓ Mark Done</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-400 text-[10px]">No emails linked to this project yet</div>
            )}
          </div>
        </div>

        {/* WhatsApp */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-2.5 border-b border-slate-100 bg-green-50 flex items-center gap-2">
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
              <div className="p-3 flex items-center justify-center"><Icon name="loader-2" size={14} className="animate-spin text-slate-400" /></div>
            ) : whatsappMessages.length > 0 ? (
              whatsappMessages.map((msg) => {
                const actionStyle = getActionTypeStyle(msg.action_type);
                return (
                  <div key={msg.id} className={`cursor-pointer ${msg.is_actionable && msg.status !== 'done' ? 'border-l-2 border-l-amber-400' : ''} ${expandedMessage === msg.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`} onClick={() => setExpandedMessage(expandedMessage === msg.id ? null : msg.id)}>
                    <div className="p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] font-medium text-slate-800 ${expandedMessage === msg.id ? '' : 'truncate'}`}>{msg.summary || msg.text?.substring(0, 60)}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5 truncate">{msg.group_name || 'WhatsApp'} • {formatEmailDate(msg.created_at)}</p>
                        </div>
                        {msg.is_actionable && msg.status !== 'done' && <span className={`text-[8px] px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${actionStyle.color}`}>{actionStyle.label}</span>}
                      </div>
                      {expandedMessage === msg.id && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">{msg.text}</p>
                          {msg.is_actionable && msg.status !== 'done' && (
                            <div className="mt-2">
                              <button onClick={(e) => { e.stopPropagation(); markMessageDone(msg.id, 'whatsapp'); }} className="px-2 py-1 bg-green-500 text-white rounded text-[9px] font-medium hover:bg-green-600">✓ Mark Done</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-slate-400 text-[10px]">No messages linked to this project yet</div>
            )}
          </div>
        </div>
      </div>

      {activePopup && <FolderPopup project={project} folder={activePopup.folder} title={activePopup.label} onClose={() => setActivePopup(null)} />}
    </div>
  );
}
