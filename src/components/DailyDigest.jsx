import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_ID } from '../config';
import Icon from './Icon';

/**
 * DailyDigest - Auto-summary of WhatsApp activity per project
 * 
 * Shows:
 * - Message counts per project for today
 * - Key highlights (decisions, action items, urgent)
 * - Actionable items that need attention
 */
export default function DailyDigest({ projects }) {
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('today');
  const [expandedProject, setExpandedProject] = useState(null);

  // Get date range based on selection
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (selectedDate) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: today };
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekAgo, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      default:
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    }
  };

  // Fetch all WhatsApp messages
  useEffect(() => {
    const messagesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'whatsapp_messages');
    const groupsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'whatsapp_groups');

    const unsubMessages = onSnapshot(messagesRef, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(allMessages);
      setLoading(false);
    });

    const unsubGroups = onSnapshot(groupsRef, (snapshot) => {
      const allGroups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroups(allGroups);
    });

    return () => { unsubMessages(); unsubGroups(); };
  }, []);

  // Build group to project mapping
  const groupToProject = useMemo(() => {
    const mapping = {};
    groups.forEach(g => {
      const wahaId = g.wahaId || g.group_id;
      if (wahaId && g.project) {
        mapping[wahaId] = g.project;
      }
    });
    return mapping;
  }, [groups]);

  // Filter messages by date range and group by project
  const digestData = useMemo(() => {
    const { start, end } = getDateRange();
    
    // Filter messages in date range
    const filtered = messages.filter(m => {
      if (!m.created_at) return false;
      const msgDate = new Date(m.created_at);
      return msgDate >= start && msgDate < end;
    });

    // Group by project
    const byProject = {};
    
    filtered.forEach(msg => {
      const projectName = groupToProject[msg.group_id] || 'Unassigned';
      
      if (!byProject[projectName]) {
        byProject[projectName] = {
          name: projectName,
          messages: [],
          actionItems: [],
          decisions: [],
          urgent: [],
          totalCount: 0
        };
      }
      
      byProject[projectName].messages.push(msg);
      byProject[projectName].totalCount++;
      
      // Categorize by tag or action type
      if (msg.user_tag === 'action' || msg.action_type === 'task') {
        byProject[projectName].actionItems.push(msg);
      }
      if (msg.user_tag === 'decision' || msg.action_type === 'decision_needed') {
        byProject[projectName].decisions.push(msg);
      }
      if (msg.user_tag === 'urgent' || msg.action_type === 'deadline') {
        byProject[projectName].urgent.push(msg);
      }
    });

    // Sort by message count
    return Object.values(byProject).sort((a, b) => b.totalCount - a.totalCount);
  }, [messages, groupToProject, selectedDate]);

  // Calculate totals
  const totals = useMemo(() => {
    return digestData.reduce((acc, p) => ({
      messages: acc.messages + p.totalCount,
      actions: acc.actions + p.actionItems.length,
      decisions: acc.decisions + p.decisions.length,
      urgent: acc.urgent + p.urgent.length
    }), { messages: 0, actions: 0, decisions: 0, urgent: 0 });
  }, [digestData]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch { return ''; }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Icon name="loader-2" size={24} className="animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Icon name="file-text" size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Daily Digest</h3>
              <p className="text-[10px] text-slate-500">WhatsApp activity summary</p>
            </div>
          </div>
          
          {/* Date Selector */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: '7 Days' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setSelectedDate(opt.id)}
                className={`px-3 py-1.5 rounded text-[10px] font-medium transition-all ${
                  selectedDate === opt.id 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
            <Icon name="message-circle" size={12} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">{totals.messages}</span>
            <span className="text-[10px] text-slate-400">messages</span>
          </div>
          {totals.actions > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-xs font-semibold text-blue-700">{totals.actions}</span>
              <span className="text-[10px] text-blue-500">actions</span>
            </div>
          )}
          {totals.decisions > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-xs font-semibold text-emerald-700">{totals.decisions}</span>
              <span className="text-[10px] text-emerald-500">decisions</span>
            </div>
          )}
          {totals.urgent > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
              <span className="text-xs font-semibold text-red-700">{totals.urgent}</span>
              <span className="text-[10px] text-red-500">urgent</span>
            </div>
          )}
        </div>
      </div>

      {/* Project Summaries */}
      <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
        {digestData.length > 0 ? (
          digestData.map((project) => {
            const isExpanded = expandedProject === project.name;
            
            return (
              <div key={project.name} className="hover:bg-slate-50">
                <div 
                  className="p-3 cursor-pointer"
                  onClick={() => setExpandedProject(isExpanded ? null : project.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        project.name === 'Unassigned' 
                          ? 'bg-slate-100 text-slate-500' 
                          : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {project.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{project.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {project.totalCount} message{project.totalCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Tag indicators */}
                      {project.actionItems.length > 0 && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                          {project.actionItems.length} action
                        </span>
                      )}
                      {project.decisions.length > 0 && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">
                          {project.decisions.length} decision
                        </span>
                      )}
                      {project.urgent.length > 0 && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                          {project.urgent.length} urgent
                        </span>
                      )}
                      <Icon 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={14} 
                        className="text-slate-400" 
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {/* Action Items */}
                    {project.actionItems.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <p className="text-[9px] font-semibold text-blue-700 mb-1.5">📋 Action Items</p>
                        {project.actionItems.slice(0, 3).map(msg => (
                          <div key={msg.id} className="text-[10px] text-blue-800 py-1 border-b border-blue-100 last:border-0">
                            <p className="truncate">{msg.summary || msg.text?.substring(0, 80)}</p>
                            <p className="text-[8px] text-blue-500 mt-0.5">{formatTime(msg.created_at)}</p>
                          </div>
                        ))}
                        {project.actionItems.length > 3 && (
                          <p className="text-[9px] text-blue-500 mt-1">+{project.actionItems.length - 3} more</p>
                        )}
                      </div>
                    )}

                    {/* Decisions */}
                    {project.decisions.length > 0 && (
                      <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                        <p className="text-[9px] font-semibold text-emerald-700 mb-1.5">✅ Decisions</p>
                        {project.decisions.slice(0, 3).map(msg => (
                          <div key={msg.id} className="text-[10px] text-emerald-800 py-1 border-b border-emerald-100 last:border-0">
                            <p className="truncate">{msg.summary || msg.text?.substring(0, 80)}</p>
                            <p className="text-[8px] text-emerald-500 mt-0.5">{formatTime(msg.created_at)}</p>
                          </div>
                        ))}
                        {project.decisions.length > 3 && (
                          <p className="text-[9px] text-emerald-500 mt-1">+{project.decisions.length - 3} more</p>
                        )}
                      </div>
                    )}

                    {/* Urgent */}
                    {project.urgent.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                        <p className="text-[9px] font-semibold text-red-700 mb-1.5">⚠️ Urgent</p>
                        {project.urgent.slice(0, 3).map(msg => (
                          <div key={msg.id} className="text-[10px] text-red-800 py-1 border-b border-red-100 last:border-0">
                            <p className="truncate">{msg.summary || msg.text?.substring(0, 80)}</p>
                            <p className="text-[8px] text-red-500 mt-0.5">{formatTime(msg.created_at)}</p>
                          </div>
                        ))}
                        {project.urgent.length > 3 && (
                          <p className="text-[9px] text-red-500 mt-1">+{project.urgent.length - 3} more</p>
                        )}
                      </div>
                    )}

                    {/* Recent Messages Preview */}
                    {project.actionItems.length === 0 && project.decisions.length === 0 && project.urgent.length === 0 && (
                      <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                        <p className="text-[9px] font-semibold text-slate-600 mb-1.5">Recent Messages</p>
                        {project.messages.slice(0, 3).map(msg => (
                          <div key={msg.id} className="text-[10px] text-slate-700 py-1 border-b border-slate-100 last:border-0">
                            <p className="truncate">{msg.summary || msg.text?.substring(0, 80)}</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">{formatTime(msg.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center">
            <Icon name="inbox" size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No messages for this period</p>
            <p className="text-[10px] text-slate-400 mt-1">WhatsApp activity will appear here</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {digestData.length > 0 && (
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <p className="text-[9px] text-slate-400 text-center">
            💡 Tip: Tag messages in Activity Feed to see them highlighted here
          </p>
        </div>
      )}
    </div>
  );
}
