import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Icon from './Icon';
import { APP_ID, SYNC_WORKER_URL, SUBMISSION_CATEGORIES } from '../config';

export default function Vault({ project }) {
  const [submissions, setSubmissions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubmission, setNewSubmission] = useState({ 
    item: '', 
    category: 'shop_drawing', 
    submittedDate: new Date().toISOString().split('T')[0] 
  });
  const [vaultFiles, setVaultFiles] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);

  // Load submissions from Firestore
  useEffect(() => {
    if (!project?.id) return;
    
    const q = query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'submissions'),
      where('projectId', '==', project.id),
      orderBy('submittedDate', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [project?.id]);

  // Load vault files
  useEffect(() => {
    if (!project) return;
    loadVaultFiles();
  }, [project?.id]);

  const loadVaultFiles = async () => {
    if (!project) return;
    setVaultLoading(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: project.name.replace(/\s+/g, '_') })
      });
      const data = await res.json();
      setVaultFiles(data.files || []);
    } catch (err) {
      console.error('Error loading vault:', err);
      setVaultFiles([]);
    } finally {
      setVaultLoading(false);
    }
  };

  const getDaysPending = (dateStr) => {
    return Math.ceil((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  };

  const handleAddSubmission = async () => {
    if (!newSubmission.item.trim()) return;
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'submissions'), {
      ...newSubmission,
      projectId: project.id,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    setNewSubmission({ item: '', category: 'shop_drawing', submittedDate: new Date().toISOString().split('T')[0] });
    setShowAddForm(false);
  };

  const handleUpdateStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'submissions', id), { status });
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this submission?')) {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'submissions', id));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'file-text';
    if (['doc', 'docx'].includes(ext)) return 'file-text';
    if (['xls', 'xlsx'].includes(ext)) return 'table';
    if (['ppt', 'pptx'].includes(ext)) return 'presentation';
    return 'file';
  };

  const statusConfig = {
    pending: { color: 'bg-amber-50 border-amber-200', icon: 'clock', text: 'text-amber-600' },
    approved: { color: 'bg-emerald-50 border-emerald-200', icon: 'check-circle', text: 'text-emerald-600' },
    rejected: { color: 'bg-red-50 border-red-200', icon: 'x-circle', text: 'text-red-600' },
    revise: { color: 'bg-blue-50 border-blue-200', icon: 'rotate-ccw', text: 'text-blue-600' }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar space-y-6">
      {/* Quick Access */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Quick Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => project?.subcontractorsLink ? window.open(project.subcontractorsLink, '_blank') : alert('No subcontractors link set.')} 
            className="bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95"
          >
            <Icon name="users" size={24} />
            <span className="text-[10px] font-black uppercase">Subcontractors</span>
          </button>
          <button 
            onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')} 
            className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95"
          >
            <Icon name="file-text" size={24} />
            <span className="text-[10px] font-black uppercase">Contract</span>
          </button>
          <button 
            onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')} 
            className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95"
          >
            <Icon name="clipboard-list" size={24} />
            <span className="text-[10px] font-black uppercase">Latest MOM</span>
          </button>
          <button 
            onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')} 
            className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95"
          >
            <Icon name="hard-hat" size={24} />
            <span className="text-[10px] font-black uppercase">Site Reports</span>
          </button>
        </div>
      </div>

      {/* Submission Tracker */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
            Submission Tracker
            {submissions.filter(s => s.status === 'pending').length > 0 && (
              <span className="bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full">
                {submissions.filter(s => s.status === 'pending').length} pending
              </span>
            )}
          </h3>
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
        
        {showAddForm && (
          <div className="bg-slate-50 p-4 rounded-2xl mb-4 space-y-3">
            <input 
              type="text" 
              placeholder="Item name (e.g. Kitchen Shop Drawing Rev2)" 
              value={newSubmission.item} 
              onChange={e => setNewSubmission({...newSubmission, item: e.target.value})} 
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none text-black" 
            />
            <div className="flex gap-3">
              <select 
                value={newSubmission.category} 
                onChange={e => setNewSubmission({...newSubmission, category: e.target.value})} 
                className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none text-black"
              >
                {SUBMISSION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input 
                type="date" 
                value={newSubmission.submittedDate} 
                onChange={e => setNewSubmission({...newSubmission, submittedDate: e.target.value})} 
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none text-black" 
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddSubmission} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold text-xs uppercase hover:bg-blue-600">Add</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-3 text-slate-500 hover:text-slate-900">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {submissions.map(s => {
            const days = getDaysPending(s.submittedDate);
            const config = statusConfig[s.status] || statusConfig.pending;
            return (
              <div key={s.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${config.color}`}>
                <Icon name={config.icon} size={20} className={config.text} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{s.item}</p>
                  <p className="text-[10px] text-slate-500">
                    {s.submittedDate} • {SUBMISSION_CATEGORIES.find(c => c.value === s.category)?.label || 'Other'}
                  </p>
                </div>
                {s.status === 'pending' && (
                  <span className={`text-[10px] font-black ${days > 7 ? 'text-red-500' : 'text-amber-500'}`}>{days}d</span>
                )}
                <select 
                  value={s.status} 
                  onChange={e => handleUpdateStatus(s.id, e.target.value)} 
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none text-black"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="revise">Revise</option>
                </select>
                <button onClick={() => handleDelete(s.id)} className="p-1 text-slate-400 hover:text-red-500">
                  <Icon name="trash-2" size={14} />
                </button>
              </div>
            );
          })}
          {submissions.length === 0 && !showAddForm && (
            <div className="text-center py-8 text-slate-400">
              <Icon name="inbox" size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold">No submissions tracked yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Files */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recent Files ({vaultFiles.length})</h3>
          <button onClick={loadVaultFiles} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900">
            <Icon name="refresh-cw" size={14} />
          </button>
        </div>
        {vaultLoading ? (
          <div className="flex justify-center py-8"><Icon name="loader-2" size={24} className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="space-y-2">
            {vaultFiles.slice(0, 5).map((f, i) => (
              <a 
                key={i} 
                href={f.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
              >
                <Icon name={getFileIcon(f.name)} size={16} className="text-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{f.name}</p>
                  <p className="text-[9px] text-slate-400 truncate">{f.path}</p>
                </div>
                <span className="text-[9px] text-slate-400">{formatFileSize(f.size)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
