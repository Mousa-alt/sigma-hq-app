import { useState, useEffect } from 'react';
import Icon from './Icon';
import { COLORS } from '../config';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function Overview({ projects, onSelectProject }) {
  const [needsAttention, setNeedsAttention] = useState([]);
  const [unmappedMessages, setUnmappedMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for actionable items across all projects
    const messagesRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    
    const actionableQuery = query(
      messagesRef,
      where('is_actionable', '==', true),
      orderBy('created_at', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(actionableQuery, (snapshot) => {
      const items = [];
      const unmapped = [];
      
      snapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        if (data.project_name && data.project_name !== '__general__') {
          items.push(data);
        } else {
          unmapped.push(data);
        }
      });
      
      setNeedsAttention(items.slice(0, 5));
      setUnmappedMessages(unmapped.slice(0, 5));
      setLoading(false);
    }, (error) => {
      console.error('Error loading attention items:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getUrgencyStyle = (urgency) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'decision_needed': return 'help-circle';
      case 'approval_request': return 'check-circle';
      case 'task': return 'clipboard-list';
      case 'deadline': return 'clock';
      case 'invoice': return 'receipt';
      default: return 'message-circle';
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'} Active
          </p>
        </div>
      </div>

      {/* Needs Attention Section */}
      {(needsAttention.length > 0 || unmappedMessages.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Action Items Across Projects */}
          {needsAttention.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-red-50 to-amber-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 rounded-lg">
                    <Icon name="alert-triangle" size={16} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Needs Your Attention</h3>
                    <p className="text-[10px] text-slate-500">Action items from all channels</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
                  {needsAttention.length} items
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {needsAttention.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => {
                      const project = projects.find(p => p.name === item.project_name);
                      if (project) onSelectProject(project);
                    }}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg ${getUrgencyStyle(item.urgency)}`}>
                        <Icon name={getActionIcon(item.action_type)} size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 line-clamp-2">{item.summary || item.text}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {item.project_name}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Icon name="message-circle" size={10} className="text-green-500" />
                            {item.group_name || 'WhatsApp'}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatTime(item.created_at)}</span>
                        </div>
                      </div>
                      <Icon name="chevron-right" size={16} className="text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmapped / Cross-Project Messages */}
          {unmappedMessages.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Icon name="inbox" size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Unmapped Messages</h3>
                    <p className="text-[10px] text-slate-500">Assign to projects in Settings</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {unmappedMessages.length} items
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {unmappedMessages.map(item => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-slate-100">
                        <Icon name="message-circle" size={14} className="text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 line-clamp-2">{item.summary || item.text}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.group_name || 'Unknown Group'}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatTime(item.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Project Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Your Projects</h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {projects.map(p => (
            <div 
              key={p.id} 
              onClick={() => onSelectProject(p)} 
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden p-3 sm:p-4 group" 
            >
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <div className="p-1.5 sm:p-2 bg-slate-50 rounded-lg text-slate-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Icon name="file-text" size={16} className="sm:w-5 sm:h-5" />
                </div>
                <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[8px] sm:text-[10px] font-medium uppercase tracking-wide ${
                  p.status === 'Syncing...' ? 'bg-amber-50 text-amber-600 animate-pulse' : 
                  p.status === 'Sync Error' ? 'bg-red-50 text-red-600' : 
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {p.status || 'Active'}
                </span>
              </div>
              
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-0.5 sm:mb-1 truncate">{p.name}</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1 mb-2 sm:mb-3">
                <Icon name="map-pin" size={10} /> {p.location || 'No location'}
              </p>
              
              <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-blue-500 font-medium text-[10px] sm:text-xs uppercase tracking-wide">Open</span>
                <Icon name="arrow-right" size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Icon name="folder-plus" size={24} style={{ color: COLORS.blue }} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No Projects Yet</h3>
              <p className="text-slate-500 mt-1 text-sm">Register a project to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
