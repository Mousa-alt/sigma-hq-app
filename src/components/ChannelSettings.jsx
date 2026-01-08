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
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function ChannelSettings({ projects }) {
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [savedId, setSavedId] = useState(null);
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

    // Real-time listener for messages
    const messagesRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    const messagesQuery = query(messagesRef, orderBy('created_at', 'desc'), limit(100));
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
      setRecentMessages(messages.slice(0, 6));
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
      await setDoc(groupRef, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
      setSavedId(groupId);
      setTimeout(() => setSavedId(null), 2000);
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

  const unmappedGroups = detectedGroups.filter(
    name => !groups.some(g => g.name === name)
  );

  const tabs = [
    { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', color: 'green', connected: true },
    { id: 'email', label: 'Outlook', icon: 'mail', color: 'blue', connected: true },
    { id: 'slack', label: 'Slack', icon: 'hash', color: 'purple', connected: false },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Channel Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Configure how messages from each channel are mapped to your projects</p>
      </div>

      {/* Channel Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? `bg-${tab.color}-100 text-${tab.color}-700` 
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
            {tab.connected ? (
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            ) : (
              <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Soon</span>
            )}
          </button>
        ))}
      </div>

      {/* WhatsApp Tab */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Command Group Info */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Icon name="zap" size={20} className="text-amber-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-900">Command Group</h3>
                <p className="text-xs text-amber-700 mt-1">
                  Create a WhatsApp group with just yourself, then set its type to "Command Group" below. Send commands like:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <code className="text-[10px] bg-amber-100 px-2 py-1 rounded">Task: Ecolab - Review drawings</code>
                  <code className="text-[10px] bg-amber-100 px-2 py-1 rounded">What's pending on Agora?</code>
                </div>
              </div>
            </div>
          </div>

          {/* Unmapped Groups Alert */}
          {unmappedGroups.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <Icon name="plus-circle" size={20} className="text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900">New Groups Detected</h3>
                  <p className="text-xs text-blue-700 mt-1">Click to add and map to a project:</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {unmappedGroups.map(name => (
                      <button
                        key={name}
                        onClick={() => addGroup(name)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100 transition-colors font-medium"
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
              <h3 className="text-sm font-medium text-slate-700">Group → Project Mapping</h3>
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
                <p className="text-xs mt-1">Send a message in WhatsApp to detect groups</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {groups.map(group => (
                  <div 
                    key={group.id} 
                    className={`p-4 transition-all ${
                      savedId === group.id ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Group Name */}
                      <div className="flex-1 min-w-[150px]">
                        <p className="text-sm font-medium text-slate-900">{group.name}</p>
                        {savedId === group.id && (
                          <p className="text-[10px] text-green-600 font-medium flex items-center gap-1 mt-0.5">
                            <Icon name="check" size={10} /> Saved!
                          </p>
                        )}
                      </div>

                      {/* Project Dropdown */}
                      <select
                        value={group.project || ''}
                        onChange={(e) => saveGroup(group.id, { project: e.target.value || null })}
                        disabled={saving === group.id}
                        className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[160px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        disabled={saving === group.id}
                        className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[130px]"
                      >
                        {GROUP_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      {/* Priority Dropdown */}
                      <select
                        value={group.priority || 'medium'}
                        onChange={(e) => saveGroup(group.id, { priority: e.target.value })}
                        disabled={saving === group.id}
                        className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[100px]"
                      >
                        {PRIORITY_OPTIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>

                      {/* Status Indicators */}
                      <div className="flex items-center gap-2">
                        {saving === group.id && (
                          <Icon name="loader-2" size={14} className="animate-spin text-blue-500" />
                        )}
                        <button
                          onClick={() => deleteGroup(group.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Icon name="trash-2" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Message Preview */}
          {recentMessages.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <h3 className="text-sm font-medium text-slate-700">Live Message Stream</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                {recentMessages.map(msg => (
                  <div key={msg.id} className="p-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-green-600">{msg.group_name || 'Unknown'}</span>
                          {msg.project_name && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                              → {msg.project_name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-1">{msg.text}</p>
                        {msg.summary && (
                          <p className="text-xs text-slate-500 mt-0.5">AI: {msg.summary}</p>
                        )}
                      </div>
                      {msg.is_actionable && (
                        <span className="text-[9px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                          ACTION
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="p-8 text-center text-slate-400">
          <Icon name="mail" size={48} className="mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium text-slate-700">Outlook Integration</h3>
          <p className="text-sm mt-2">Email sync is running. Messages are automatically classified and routed to projects.</p>
          <div className="flex justify-center gap-4 mt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Icon name="check" size={24} className="text-green-600" />
              </div>
              <p className="text-xs text-slate-500">Connected</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Icon name="zap" size={24} className="text-blue-600" />
              </div>
              <p className="text-xs text-slate-500">Auto-sync</p>
            </div>
          </div>
        </div>
      )}

      {/* Slack Tab */}
      {activeTab === 'slack' && (
        <div className="p-8 text-center text-slate-400">
          <Icon name="hash" size={48} className="mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium text-slate-700">Slack Integration</h3>
          <p className="text-sm mt-2">Coming soon. Connect your Slack workspace to sync channel messages to projects.</p>
          <button className="mt-6 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed">
            Connect Slack (Coming Soon)
          </button>
        </div>
      )}
    </div>
  );
}
