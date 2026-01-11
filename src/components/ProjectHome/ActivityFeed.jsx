import { useState } from 'react';
import Icon from '../Icon';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const EMAIL_TYPE_STYLES = {
  rfi: { label: 'RFI', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  approval: { label: 'Approval', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  vo: { label: 'Variation', color: 'text-red-600 bg-red-50 border-red-200' },
  submittal: { label: 'Submittal', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  invoice: { label: 'Invoice', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  mom: { label: 'Meeting', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  default: { label: 'Email', color: 'text-slate-500 bg-slate-50 border-slate-200' },
};

const ACTION_TYPE_STYLES = {
  task: { label: 'Task', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  query: { label: 'Query', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  info: { label: 'Info', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  decision_needed: { label: 'Decision', color: 'text-red-600 bg-red-50 border-red-200' },
  approval_request: { label: 'Approval', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  deadline: { label: 'Deadline', color: 'text-red-600 bg-red-50 border-red-200' },
  invoice: { label: 'Invoice', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  default: { label: 'Message', color: 'text-slate-500 bg-slate-50 border-slate-200' },
};

const formatDate = (dateStr) => {
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
    console.error('Error marking done:', err);
  }
};

const markEmailRead = async (emailId) => {
  try {
    const emailRef = doc(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'emails', emailId);
    await updateDoc(emailRef, { is_read: true });
  } catch (err) {
    console.error('Error marking read:', err);
  }
};

/**
 * Activity Feed - emails and WhatsApp messages
 */
export default function ActivityFeed({ emails, messages, loadingEmails, loadingWhatsapp }) {
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [expandedMessage, setExpandedMessage] = useState(null);

  const actionableEmails = emails.filter(e => e.is_actionable && e.status !== 'done');
  const actionableMessages = messages.filter(m => m.is_actionable && m.status !== 'done');

  return (
    <div>
      <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">
        Activity Feed
      </h3>

      {/* Emails Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-3">
        <div className="p-2.5 border-b border-slate-100 bg-blue-50 flex items-center gap-2">
          <Icon name="mail" size={12} className="text-blue-500" />
          <span className="text-[10px] font-medium text-slate-700">Emails</span>
          {actionableEmails.length > 0 && (
            <span className="text-[8px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded ml-auto">
              {actionableEmails.length} action
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
          {loadingEmails ? (
            <div className="p-3 flex items-center justify-center">
              <Icon name="loader-2" size={14} className="animate-spin text-slate-400" />
            </div>
          ) : emails.length > 0 ? (
            emails.map((email) => {
              const typeStyle = EMAIL_TYPE_STYLES[email.doc_type] || EMAIL_TYPE_STYLES.default;
              const isUnread = !email.is_read;
              const isExpanded = expandedEmail === email.id;
              
              return (
                <div 
                  key={email.id} 
                  className={`cursor-pointer ${email.is_actionable && email.status !== 'done' ? 'border-l-2 border-l-blue-400' : ''} ${isUnread ? 'bg-blue-50/50' : ''} ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  onClick={() => { 
                    setExpandedEmail(isExpanded ? null : email.id); 
                    markEmailRead(email.id); 
                  }}
                >
                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {isUnread && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                          <p className={`text-[10px] font-medium text-slate-800 ${isExpanded ? '' : 'truncate'} ${isUnread ? 'font-semibold' : ''}`}>
                            {email.subject}
                          </p>
                        </div>
                        <p className="text-[9px] text-slate-500 truncate">
                          {email.from?.split('<')[0]?.trim() || 'Unknown'} • {formatDate(email.date)}
                        </p>
                      </div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${typeStyle.color}`}>
                        {typeStyle.label}
                      </span>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-[9px] text-slate-600 mb-1">From: {email.from}</p>
                        {email.to && <p className="text-[9px] text-slate-600 mb-2">To: {email.to}</p>}
                        <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-6">{email.body}</p>
                        {email.attachments_count > 0 && (
                          <p className="text-[9px] text-slate-500 mt-2 flex items-center gap-1">
                            <Icon name="paperclip" size={10} /> {email.attachments_count} attachment(s)
                          </p>
                        )}
                        {email.is_actionable && email.status !== 'done' && (
                          <div className="mt-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); markMessageDone(email.id, 'email'); }} 
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
              );
            })
          ) : (
            <div className="p-4 text-center text-slate-400 text-[10px]">No emails linked to this project yet</div>
          )}
        </div>
      </div>

      {/* WhatsApp Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-2.5 border-b border-slate-100 bg-green-50 flex items-center gap-2">
          <Icon name="message-circle" size={12} className="text-green-500" />
          <span className="text-[10px] font-medium text-slate-700">WhatsApp</span>
          {actionableMessages.length > 0 && (
            <span className="text-[8px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded ml-auto">
              {actionableMessages.length} action
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
          {loadingWhatsapp ? (
            <div className="p-3 flex items-center justify-center">
              <Icon name="loader-2" size={14} className="animate-spin text-slate-400" />
            </div>
          ) : messages.length > 0 ? (
            messages.map((msg) => {
              const actionStyle = ACTION_TYPE_STYLES[msg.action_type] || ACTION_TYPE_STYLES.default;
              const isExpanded = expandedMessage === msg.id;
              
              return (
                <div 
                  key={msg.id} 
                  className={`cursor-pointer ${msg.is_actionable && msg.status !== 'done' ? 'border-l-2 border-l-amber-400' : ''} ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  onClick={() => setExpandedMessage(isExpanded ? null : msg.id)}
                >
                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-medium text-slate-800 ${isExpanded ? '' : 'truncate'}`}>
                          {msg.summary || msg.text?.substring(0, 60)}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">
                          {msg.group_name || 'WhatsApp'} • {formatDate(msg.created_at)}
                        </p>
                      </div>
                      {msg.is_actionable && msg.status !== 'done' && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${actionStyle.color}`}>
                          {actionStyle.label}
                        </span>
                      )}
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{msg.text}</p>
                        {msg.is_actionable && msg.status !== 'done' && (
                          <div className="mt-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); markMessageDone(msg.id, 'whatsapp'); }} 
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
              );
            })
          ) : (
            <div className="p-3 text-center text-slate-400 text-[10px]">No messages linked to this project yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
