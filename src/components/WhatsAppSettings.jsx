import { useState, useEffect } from 'react';
import Icon from './Icon';
import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

const GROUP_TYPES = [
  { value: 'client', label: 'Client', color: 'blue' },
  { value: 'consultant', label: 'Consultant', color: 'purple' },
  { value: 'contractor', label: 'Contractor', color: 'orange' },
  { value: 'supplier', label: 'Supplier', color: 'emerald' },
  { value: 'internal', label: 'Internal', color: 'slate' },
  { value: 'command', label: 'Command Group', color: 'amber' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: 'red' },
  { value: 'medium', label: 'Medium', color: 'amber' },
  { value: 'low', label: 'Low', color: 'green' },
];

export default function WhatsAppSettings({ projects }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [detectedGroups, setDetectedGroups] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);

  useEffect(() => {
    // Real-time listener for mapped groups
    const groupsRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_groups');
    const unsubGroups = onSnapshot(groupsRef, (snapshot) => {
      const groupList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroups(groupList);
      setLoading(false);
    });

    // Real-time listener for messages to detect new groups
    const messagesRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(100));
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const groupNames = new Set();
      const messages = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        messages.push({ id: doc.id, ...data });
        if (data.group_name) {
          groupNames.add(data.group_name);
        }
      });
      setDetectedGroups(Array.from(groupNames));
      setRecentMessages(messages.slice(0, 10));
    });

    return () => {
      unsubGroups();
      unsubMessages();
    };
  }, []);

  const saveGroup = async (groupId, updates) => {
    setSaving(groupId);
    try {
      const groupRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_groups', groupId);
      await setDoc(groupRef, updates, { merge: true });
    } catch (err) {
      console.error('Error saving group:', err);
    } finally {
      setSaving(null);
    }
  };

  const addGroup = async (groupName) => {
    const groupId = groupName.replace(/[^a-zA-Z0-9]/g, '_');
    const newGroup = {
      id: groupId,
      name: groupName,
      project: null,
      type: 'internal',
      priority: 'medium',
      autoExtractTasks: true,
      createdAt: new Date().toISOString(),
    };
    
    try {
      const groupRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_groups', groupId);
      await setDoc(groupRef, newGroup);
    } catch (err) {
      console.error('Error adding group:', err);
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      const groupRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_groups', groupId);
      await deleteDoc(groupRef);
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  const getTypeColor = (type) => {
    const t = GROUP_TYPES.find(gt => gt.value === type);
    return t ? t.color : 'slate';
  };

  const unmappedGroups = detectedGroups.filter(
    name => !groups.some(g => g.name === name)
  );

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">WhatsApp Integration</h2>
          <p className="text-sm text-slate-500 mt-1">Map your WhatsApp groups to projects and configure how messages are processed</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live Sync
          </span>
        </div>
      </div>

      {/* Command Group Info */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Icon name="zap" size={20} className="text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-amber-900">Command Group Feature</h3>
            <p className="text-xs text-amber-700 mt-1">
              Create a WhatsApp group with just yourself and set it as "Command Group" type. 
              You can then send commands like:
            </p>
            <ul className="text-xs text-amber-700 mt-2 space-y-1">
              <li>• <code className="bg-amber-100 px-1 rounded">Task: Ecolab - Review shop drawings by Thursday</code></li>
              <li>• <code className="bg-amber-100 px-1 rounded">What's pending on Agora-GEM?</code></li>
              <li>• <code className="bg-amber-100 px-1 rounded">Summarize this week</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Unmapped Groups Alert */}
      {unmappedGroups.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Icon name="info" size={20} className="text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">New Groups Detected</h3>
              <p className="text-xs text-blue-700 mt-1">These groups have sent messages but aren't mapped yet:</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {unmappedGroups.map(name => (
                  <button
                    key={name}
                    onClick={() => addGroup(name)}
                    className="flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Icon name="plus" size={12} />
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Groups Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">Mapped Groups</h3>
          <span className="text-xs text-slate-500">{groups.length} groups</span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <Icon name="loader-2" size={24} className="animate-spin text-slate-400 mx-auto" />
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Icon name="message-circle" size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No groups mapped yet</p>
            <p className="text-xs mt-1">Groups will appear here once they send messages</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map(group => (
              <div key={group.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Group Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{group.name}</p>
                    <p className="text-xs text-slate-500">
                      {group.project ? `→ ${group.project}` : 'No project assigned'}
                    </p>
                  </div>

                  {/* Project Dropdown */}
                  <select
                    value={group.project || ''}
                    onChange={(e) => saveGroup(group.id, { project: e.target.value || null })}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white min-w-[140px]"
                  >
                    <option value="">No Project</option>
                    <option value="__general__">General (Cross-project)</option>
                    {projects?.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>

                  {/* Type Dropdown */}
                  <select
                    value={group.type || 'internal'}
                    onChange={(e) => saveGroup(group.id, { type: e.target.value })}
                    className={`text-xs border rounded-lg px-2 py-1.5 min-w-[120px] bg-${getTypeColor(group.type)}-50 border-${getTypeColor(group.type)}-200 text-${getTypeColor(group.type)}-700`}
                  >
                    {GROUP_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>

                  {/* Priority Dropdown */}
                  <select
                    value={group.priority || 'medium'}
                    onChange={(e) => saveGroup(group.id, { priority: e.target.value })}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white min-w-[90px]"
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>

                  {/* Auto Extract Toggle */}
                  <button
                    onClick={() => saveGroup(group.id, { autoExtractTasks: !group.autoExtractTasks })}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      group.autoExtractTasks 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon name="check-square" size={12} />
                    Tasks
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Icon name="trash-2" size={14} />
                  </button>

                  {/* Saving indicator */}
                  {saving === group.id && (
                    <Icon name="loader-2" size={14} className="animate-spin text-blue-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Messages */}
      {recentMessages.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <h3 className="text-sm font-medium text-slate-700">Live Message Stream</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {recentMessages.map(msg => (
              <div key={msg.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-medium text-green-600">{msg.group_name || 'Unknown'}</span>
                  <span className="text-xs text-slate-400">
                    {msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString() : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{msg.text}</p>
                {msg.summary && (
                  <p className="text-xs text-blue-500 mt-1">AI: {msg.summary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Rules */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-medium text-slate-700">How Messages Are Processed</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Icon name="users" size={16} className="text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Client / Consultant</span>
            </div>
            <p className="text-xs text-slate-500">All messages tracked. Decisions and requests highlighted. High priority notifications.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                <Icon name="home" size={16} className="text-slate-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Internal</span>
            </div>
            <p className="text-xs text-slate-500">Tracked quietly. Only actionable items extracted. No notifications unless urgent.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Icon name="zap" size={16} className="text-amber-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Command Group</span>
            </div>
            <p className="text-xs text-slate-500">Your personal AI interface. Send commands to create tasks, get summaries, or ask questions.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Icon name="truck" size={16} className="text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Supplier / Contractor</span>
            </div>
            <p className="text-xs text-slate-500">Track deliveries, invoices, and site coordination. Extract deadlines and commitments.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
