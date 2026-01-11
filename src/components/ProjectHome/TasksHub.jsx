import { useState } from 'react';
import Icon from '../Icon';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const TASK_SOURCE_STYLES = {
  whatsapp: { label: 'WhatsApp', color: 'text-green-600 bg-green-50', icon: 'message-circle' },
  email: { label: 'Email', color: 'text-blue-600 bg-blue-50', icon: 'mail' },
  meeting: { label: 'Meeting', color: 'text-purple-600 bg-purple-50', icon: 'users' },
  manual: { label: 'Manual', color: 'text-slate-600 bg-slate-50', icon: 'edit-2' },
};

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'manual', label: 'Manual', icon: 'edit-2' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { id: 'email', label: 'Email', icon: 'mail' },
];

/**
 * Mark message/email as done
 */
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

/**
 * Tasks Hub - unified task management
 */
export default function TasksHub({ 
  tasks, 
  loadingTasks, 
  actionableWhatsapp, 
  actionableEmails,
  loadingWhatsapp,
  loadingEmails,
  addTask, 
  toggleTask, 
  deleteTask 
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [newTask, setNewTask] = useState('');

  const incompleteTasks = tasks.filter(t => !t.done);
  const totalPending = incompleteTasks.length + actionableWhatsapp.length + actionableEmails.length;

  // Build unified task list based on active tab
  const buildUnifiedTasks = () => {
    let items = [];
    
    if (activeTab === 'all' || activeTab === 'manual') {
      items.push(...tasks.map(t => ({
        id: t.id, 
        type: 'task', 
        text: t.text, 
        done: t.done, 
        source: t.source || 'manual',
        created_at: t.created_at, 
        urgency: 'medium'
      })));
    }
    
    if (activeTab === 'all' || activeTab === 'whatsapp') {
      items.push(...actionableWhatsapp.map(m => ({
        id: m.id, 
        type: 'whatsapp', 
        text: m.summary || m.text?.substring(0, 80) || 'WhatsApp action',
        done: m.status === 'done', 
        source: 'whatsapp', 
        created_at: m.created_at,
        urgency: m.urgency || 'medium', 
        action_type: m.action_type, 
        sender: m.sender_name || m.group_name
      })));
    }
    
    if (activeTab === 'all' || activeTab === 'email') {
      items.push(...actionableEmails.map(e => ({
        id: e.id, 
        type: 'email', 
        text: e.subject || 'Email action', 
        done: e.status === 'done',
        source: 'email', 
        created_at: e.date, 
        urgency: 'medium',
        action_type: e.doc_type, 
        sender: e.from?.split('<')[0]?.trim()
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

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    addTask(newTask);
    setNewTask('');
  };

  const handleToggle = (item) => {
    if (item.type === 'task') {
      toggleTask(item.id, item.done);
    } else {
      markMessageDone(item.id, item.type === 'email' ? 'email' : 'whatsapp');
    }
  };

  const getTabCount = (tabId) => {
    switch (tabId) {
      case 'all': return incompleteTasks.length + actionableWhatsapp.length + actionableEmails.length;
      case 'manual': return incompleteTasks.length;
      case 'whatsapp': return actionableWhatsapp.length;
      case 'email': return actionableEmails.length;
      default: return 0;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400">Tasks Hub</h3>
        {totalPending > 0 && (
          <span className="text-[8px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">
            {totalPending} pending
          </span>
        )}
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="p-2 border-b border-slate-100 bg-slate-50 flex gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const count = getTabCount(tab.id);
            return (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)} 
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.icon && <Icon name={tab.icon} size={10} />}
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1 px-1 rounded text-[8px] ${activeTab === tab.id ? 'bg-blue-400' : 'bg-slate-300'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add Task Input */}
        <div className="p-3 border-b border-slate-100 flex gap-2">
          <input 
            type="text" 
            value={newTask} 
            onChange={(e) => setNewTask(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleAddTask()} 
            placeholder="Add task..." 
            className="flex-1 text-xs outline-none text-slate-900 placeholder:text-slate-400 min-w-0" 
          />
          <button 
            onClick={handleAddTask} 
            className="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-medium hover:bg-blue-600 flex-shrink-0"
          >
            Add
          </button>
        </div>

        {/* Task List */}
        <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
          {loadingTasks && loadingWhatsapp && loadingEmails ? (
            <div className="p-4 text-center">
              <Icon name="loader-2" size={16} className="animate-spin text-slate-400 mx-auto" />
            </div>
          ) : unifiedTasks.length > 0 ? (
            unifiedTasks.slice(0, 15).map(item => {
              const sourceStyle = TASK_SOURCE_STYLES[item.source] || TASK_SOURCE_STYLES.manual;
              return (
                <div 
                  key={`${item.type}-${item.id}`} 
                  className={`flex items-start gap-2 p-3 hover:bg-slate-50 ${item.urgency === 'high' ? 'border-l-2 border-l-red-400' : ''}`}
                >
                  <button 
                    onClick={() => handleToggle(item)} 
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {item.done && <Icon name="check" size={10} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs block ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {item.text}
                    </span>
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
                    <button 
                      onClick={() => deleteTask(item.id)} 
                      className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Icon name="x" size={12} />
                    </button>
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
  );
}
