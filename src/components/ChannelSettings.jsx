import { useState, useEffect } from 'react';
import Icon from './Icon';
import { db } from '../firebase';
import { EMAIL_SYNC_URL } from '../config';
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
  
  // Email sync state
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [emailSyncResult, setEmailSyncResult] = useState(null);

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

  // Email sync functions
  const syncEmails = async (reset = false) => {
    setEmailSyncing(true);
    setEmailSyncResult(null);
    
    try {
      if (reset) {
        // First reset the state
        await fetch(EMAIL_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset: true })
        });
      }
      
      // Then process emails
      const res = await fetch(EMAIL_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 })
      });
      
      const result = await res.json();
      setEmailSyncResult(result);
      
      if (result.processed > 0) {
        alert(`✅ Email Sync Complete!\n\nProcessed: ${result.processed}\nSkipped: ${result.skipped || 0}\nErrors: ${result.errors || 0}`);
      } else if (result.skipped > 0) {
        alert(`ℹ️ No new emails to process.\n\nSkipped: ${result.skipped} (already processed)`);
      } else {
        alert(`ℹ️ No emails found to process.`);
      }
    } catch (err) {
      console.error('Email sync error:', err);
      setEmailSyncResult({ error: err.message });
      alert(`❌ Email Sync Failed\n\n${err.message}`);
    } finally {
      setEmailSyncing(false);
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
        <div className="space-y-6">
          {/* Email Sync Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                <Icon name="mail" size={28} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Email Sync</h3>
                <p className="text-sm text-slate-500">Sync emails from mail.sigmadd-egypt.com</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-xs text-green-600 font-medium">Connected</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => syncEmails(false)}
                disabled={emailSyncing}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {emailSyncing ? (
                  <Icon name="loader-2" size={18} className="animate-spin" />
                ) : (
                  <Icon name="refresh-cw" size={18} />
                )}
                {emailSyncing ? 'Syncing...' : 'Sync New Emails'}
              </button>
              
              <button
                onClick={() => syncEmails(true)}
                disabled={emailSyncing}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {emailSyncing ? (
                  <Icon name="loader-2" size={18} className="animate-spin" />
                ) : (
                  <Icon name="rotate-ccw" size={18} />
                )}
                Reprocess All Emails
              </button>
            </div>
            
            {/* Sync Result */}
            {emailSyncResult && (
              <div className={`mt-4 p-4 rounded-lg ${emailSyncResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                {emailSyncResult.error ? (
                  <div className="flex items-center gap-2 text-red-700">
                    <Icon name="alert-circle" size={16} />
                    <span className="text-sm">Error: {emailSyncResult.error}</span>
                  </div>
                ) : (
                  <div className="text-sm text-green-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="check-circle" size={16} />
                      <span className="font-medium">Sync Complete</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{emailSyncResult.processed || 0}</p>
                        <p className="text-xs text-green-600">Processed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{emailSyncResult.skipped || 0}</p>
                        <p className="text-xs text-green-600">Skipped</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{emailSyncResult.errors || 0}</p>
                        <p className="text-xs text-green-600">Errors</p>
                      </div>
                    </div>
                    {emailSyncResult.emails && emailSyncResult.emails.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <p className="text-xs font-medium mb-2">Recently Synced:</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {emailSyncResult.emails.slice(0, 5).map((email, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${email.project ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {email.project || 'Unclassified'}
                              </span>
                              <span className="truncate">{email.subject}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Email Classification Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Icon name="zap" size={20} className="text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-900">AI-Powered Classification</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Emails are automatically classified by project using AI. The system looks for:
                </p>
                <ul className="text-xs text-blue-700 mt-2 list-disc list-inside space-y-1">
                  <li>Project names in subject line and body</li>
                  <li>Common misspellings (AGURA → Agora-GEM)</li>
                  <li>Client names and site references</li>
                  <li>Document types: RFI, Approval, Submittal, VO, Invoice</li>
                </ul>
              </div>
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
