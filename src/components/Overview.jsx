import { useState, useEffect } from 'react';
import Icon from './Icon';
import { COLORS, SYNC_WORKER_URL } from '../config';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function Overview({ projects, onSelectProject }) {
  const [actionItems, setActionItems] = useState([]);
  const [unmappedItems, setUnmappedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState(null);

  useEffect(() => {
    // Listen to WhatsApp messages from Firestore
    const whatsappRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    
    let whatsappItems = [];
    let emailItems = [];
    
    const processItems = () => {
      const allItems = [...whatsappItems, ...emailItems];
      const mapped = [];
      const unmapped = [];
      
      allItems.forEach(item => {
        // Check if actionable and not done
        const isActionable = item.is_actionable || 
          (item.source === 'email' && ['rfi', 'approval', 'vo', 'submittal'].includes(item.doc_type));
        
        if (isActionable && item.status !== 'done') {
          if (item.project_name && item.project_name !== '__general__') {
            mapped.push(item);
          } else {
            unmapped.push(item);
          }
        }
      });
      
      // Sort by date (newest first)
      const sortByDate = (a, b) => {
        const dateA = new Date(a.created_at || a.date || 0);
        const dateB = new Date(b.created_at || b.date || 0);
        return dateB - dateA;
      };
      
      mapped.sort(sortByDate);
      unmapped.sort(sortByDate);
      
      setActionItems(mapped.slice(0, 15));
      setUnmappedItems(unmapped.slice(0, 10));
      setLoading(false);
    };
    
    // Listen to WhatsApp messages
    const unsubWhatsapp = onSnapshot(whatsappRef, (snapshot) => {
      whatsappItems = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        source: 'whatsapp'
      }));
      processItems();
    }, (error) => {
      console.error('WhatsApp error:', error);
      setLoading(false);
    });
    
    // Fetch emails from sync-worker API for all projects
    const fetchAllEmails = async () => {
      const allEmails = [];
      for (const project of projects) {
        try {
          const res = await fetch(`${SYNC_WORKER_URL}/emails?project=${encodeURIComponent(project.name)}&limit=10`);
          if (res.ok) {
            const data = await res.json();
            const emails = (data.emails || []).map(email => ({
              id: `email-${email.subject}-${email.date}`,
              source: 'email',
              project_name: project.name,
              subject: email.subject,
              from: email.from,
              date: email.date,
              created_at: email.date,
              doc_type: email.type || 'correspondence',
              text: email.subject,
              summary: email.subject,
              is_actionable: ['rfi', 'approval', 'vo', 'submittal'].includes(email.type),
              status: 'new'
            }));
            allEmails.push(...emails);
          }
        } catch (err) {
          console.error(`Error fetching emails for ${project.name}:`, err);
        }
      }
      emailItems = allEmails;
      processItems();
    };
    
    if (projects.length > 0) {
      fetchAllEmails();
    }

    return () => {
      unsubWhatsapp();
    };
  }, [projects]);

  // Mark item as done
  const markItemDone = async (item, e) => {
    e.stopPropagation();
    if (item.source === 'email') {
      // For emails, just remove from local state (can't update GCS from client)
      setActionItems(prev => prev.filter(i => i.id !== item.id));
      return;
    }
    try {
      const msgRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages', item.id);
      await updateDoc(msgRef, { 
        status: 'done',
        is_actionable: false,
        is_read: true,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error marking done:', err);
    }
  };

  // Source icon and color
  const getSourceStyle = (source) => {
    if (source === 'email') {
      return { icon: 'mail', color: 'text-blue-500', bg: 'bg-blue-50', label: 'Email' };
    }
    return { icon: 'message-circle', color: 'text-green-500', bg: 'bg-green-50', label: 'WhatsApp' };
  };

  // Action type labels and colors
  const getActionTypeStyle = (item) => {
    // Email doc types
    if (item.source === 'email') {
      switch (item.doc_type) {
        case 'rfi': return { label: 'RFI', color: 'bg-purple-100 text-purple-700', icon: 'help-circle' };
        case 'approval': return { label: 'Approval', color: 'bg-amber-100 text-amber-700', icon: 'check-circle' };
        case 'vo': return { label: 'Variation', color: 'bg-red-100 text-red-700', icon: 'file-plus' };
        case 'submittal': return { label: 'Submittal', color: 'bg-blue-100 text-blue-700', icon: 'file-text' };
        case 'invoice': return { label: 'Invoice', color: 'bg-emerald-100 text-emerald-700', icon: 'receipt' };
        default: return { label: 'Email', color: 'bg-slate-100 text-slate-600', icon: 'mail' };
      }
    }
    // WhatsApp types
    switch (item.action_type) {
      case 'task': return { label: 'Task', color: 'bg-blue-100 text-blue-700', icon: 'clipboard-list' };
      case 'query': return { label: 'Query', color: 'bg-purple-100 text-purple-700', icon: 'help-circle' };
      case 'info': return { label: 'Info', color: 'bg-slate-100 text-slate-600', icon: 'info' };
      case 'decision_needed': return { label: 'Decision', color: 'bg-red-100 text-red-700', icon: 'help-circle' };
      case 'approval_request': return { label: 'Approval', color: 'bg-amber-100 text-amber-700', icon: 'check-circle' };
      case 'deadline': return { label: 'Deadline', color: 'bg-red-100 text-red-700', icon: 'clock' };
      case 'invoice': return { label: 'Invoice', color: 'bg-emerald-100 text-emerald-700', icon: 'receipt' };
      default: return { label: 'Message', color: 'bg-slate-100 text-slate-600', icon: 'message-circle' };
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const handleItemClick = (item, e) => {
    e.stopPropagation();
    setExpandedItem(expandedItem === item.id ? null : item.id);
  };

  const handleGoToProject = (item, e) => {
    e.stopPropagation();
    const project = projects.find(p => p.name === item.project_name);
    if (project) onSelectProject(project);
  };

  const renderItem = (item, showProject = true) => {
    const isExpanded = expandedItem === item.id;
    const sourceStyle = getSourceStyle(item.source);
    const actionStyle = getActionTypeStyle(item);
    const isUnread = !item.is_read;
    
    return (
      <div 
        key={item.id} 
        onClick={(e) => handleItemClick(item, e)}
        className={`transition-all cursor-pointer ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'} ${isUnread ? 'border-l-2 border-l-blue-500' : ''}`}
      >
        <div className="p-3">
          <div className="flex items-start gap-2">
            {/* Source Icon */}
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${sourceStyle.bg}`}>
              <Icon name={sourceStyle.icon} size={12} className={sourceStyle.color} />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Type Badge */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${actionStyle.color}`}>
                  {actionStyle.label}
                </span>
                {isUnread && (
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" title="Unread" />
                )}
              </div>
              
              {/* Content */}
              <p className={`text-xs ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'} ${isExpanded ? '' : 'line-clamp-2'}`}>
                {item.summary || item.text || item.subject}
              </p>
              
              {/* Meta info */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {showProject && item.project_name && (
                  <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {item.project_name}
                  </span>
                )}
                <span className="text-[9px] text-slate-400">
                  {sourceStyle.label} • {formatTime(item.created_at || item.date)}
                </span>
                {item.from && (
                  <span className="text-[9px] text-slate-400 truncate max-w-[120px]">
                    • {item.from.split('<')[0].trim().substring(0, 20)}
                  </span>
                )}
              </div>
            </div>
            
            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} className="text-slate-300 flex-shrink-0" />
          </div>
          
          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-slate-200 ml-8">
              <p className="text-xs text-slate-700 whitespace-pre-wrap">
                {item.text || item.body || item.summary}
              </p>
              
              {item.from && (
                <p className="text-[10px] text-slate-500 mt-1">From: {item.from}</p>
              )}
              
              <div className="mt-2 flex gap-2 flex-wrap">
                <button 
                  onClick={(e) => markItemDone(item, e)}
                  className="px-2 py-1 bg-green-500 text-white rounded-lg text-[10px] font-medium hover:bg-green-600"
                >
                  ✓ Done
                </button>
                {item.project_name && (
                  <button 
                    onClick={(e) => handleGoToProject(item, e)}
                    className="px-2 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-medium"
                  >
                    Open Project →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-in pb-24">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-xs mt-0.5">
          {projects.length} {projects.length === 1 ? 'Project' : 'Projects'} Active
        </p>
      </div>

      {/* Projects */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 mb-3">Your Projects</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {projects.map(p => (
            <div 
              key={p.id} 
              onClick={() => onSelectProject(p)} 
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer p-3 group" 
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-1.5 bg-slate-50 rounded-lg text-slate-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Icon name="folder" size={14} />
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium uppercase ${
                  p.status === 'Syncing...' ? 'bg-amber-50 text-amber-600 animate-pulse' : 
                  p.status === 'Sync Error' ? 'bg-red-50 text-red-600' : 
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {p.status || 'Active'}
                </span>
              </div>
              
              <h3 className="text-xs font-semibold text-slate-900 truncate">{p.name}</h3>
              <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                {p.location || 'No location'}
              </p>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Icon name="folder-plus" size={20} style={{ color: COLORS.blue }} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">No Projects Yet</h3>
              <p className="text-slate-500 mt-1 text-xs">Register a project to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Needs Attention - Combined WhatsApp + Email */}
      {!loading && (actionItems.length > 0 || unmappedItems.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700">Needs Attention</h3>
            <div className="flex items-center gap-2 text-[9px] text-slate-400">
              <span className="flex items-center gap-1"><Icon name="message-circle" size={10} className="text-green-500" /> WhatsApp</span>
              <span className="flex items-center gap-1"><Icon name="mail" size={10} className="text-blue-500" /> Email</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Action Items (mapped to projects) */}
            {actionItems.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-red-50 to-amber-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-red-100 rounded-lg">
                      <Icon name="alert-triangle" size={12} className="text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900">Action Required</h3>
                      <p className="text-[9px] text-slate-500">Messages & emails needing response</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                    {actionItems.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                  {actionItems.map(item => renderItem(item, true))}
                </div>
              </div>
            )}

            {/* Unmapped Items (no project assigned) */}
            {unmappedItems.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-slate-100 rounded-lg">
                      <Icon name="inbox" size={12} className="text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900">No Project Assigned</h3>
                      <p className="text-[9px] text-slate-500">Assign these to a project in Settings</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {unmappedItems.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                  {unmappedItems.map(item => renderItem(item, false))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && actionItems.length === 0 && unmappedItems.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon name="check-circle" size={24} className="text-emerald-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">All Clear!</h3>
          <p className="text-slate-500 mt-1 text-xs">No pending action items</p>
        </div>
      )}
    </div>
  );
}
