import { useState, useEffect } from 'react';
import Icon from './Icon';
import { COLORS } from '../config';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function Overview({ projects, onSelectProject }) {
  const [needsAttention, setNeedsAttention] = useState([]);
  const [unmappedMessages, setUnmappedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState(null);

  useEffect(() => {
    const messagesRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const items = [];
      const unmapped = [];
      
      snapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        
        // Only show actionable items that aren't done
        if (data.is_actionable && data.status !== 'done') {
          if (data.project_name && data.project_name !== '__general__') {
            items.push(data);
          } else {
            unmapped.push(data);
          }
        }
      });
      
      // Sort by date (newest first)
      const sortByDate = (a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateB - dateA;
      };
      
      items.sort(sortByDate);
      unmapped.sort(sortByDate);
      
      setNeedsAttention(items.slice(0, 10));
      setUnmappedMessages(unmapped.slice(0, 10));
      setLoading(false);
    }, (error) => {
      console.error('Error loading attention items:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Mark message as done
  const markItemDone = async (itemId, e) => {
    e.stopPropagation();
    try {
      const msgRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages', itemId);
      await updateDoc(msgRef, { 
        status: 'done',
        is_actionable: false,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error marking done:', err);
    }
  };

  // Action type labels and colors - same as ProjectHome
  const getActionTypeStyle = (actionType) => {
    switch (actionType) {
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
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
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

  const renderMessageItem = (item, showProject = true) => {
    const isExpanded = expandedItem === item.id;
    const actionStyle = getActionTypeStyle(item.action_type);
    
    return (
      <div 
        key={item.id} 
        onClick={(e) => handleItemClick(item, e)}
        className={`transition-all cursor-pointer ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
      >
        <div className="p-3">
          <div className="flex items-start gap-2">
            <div className={`p-1 rounded-lg flex-shrink-0 ${actionStyle.color}`}>
              <Icon name={actionStyle.icon} size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${actionStyle.color}`}>
                  {actionStyle.label}
                </span>
              </div>
              <p className={`text-xs text-slate-800 ${isExpanded ? '' : 'line-clamp-2'}`}>
                {item.summary || item.text}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {showProject && item.project_name && (
                  <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                    {item.project_name}
                  </span>
                )}
                <span className="text-[9px] text-slate-400">
                  {item.group_name || 'WhatsApp'} • {formatTime(item.created_at)}
                </span>
              </div>
            </div>
            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} className="text-slate-300 flex-shrink-0" />
          </div>
          
          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-slate-200 ml-6">
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{item.text}</p>
              
              <div className="mt-2 flex gap-2 flex-wrap">
                <button 
                  onClick={(e) => markItemDone(item.id, e)}
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

      {/* Projects FIRST */}
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

      {/* Needs Attention SECOND */}
      {!loading && (needsAttention.length > 0 || unmappedMessages.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-700">Needs Attention</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Action Items */}
            {needsAttention.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-red-50 to-amber-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-red-100 rounded-lg">
                      <Icon name="alert-triangle" size={12} className="text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900">Action Items</h3>
                      <p className="text-[9px] text-slate-500">Recent messages needing action</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                    {needsAttention.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                  {needsAttention.map(item => renderMessageItem(item, true))}
                </div>
              </div>
            )}

            {/* Unmapped Messages */}
            {unmappedMessages.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-blue-100 rounded-lg">
                      <Icon name="inbox" size={12} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900">Unmapped</h3>
                      <p className="text-[9px] text-slate-500">Assign in Settings</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                    {unmappedMessages.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                  {unmappedMessages.map(item => renderMessageItem(item, false))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
