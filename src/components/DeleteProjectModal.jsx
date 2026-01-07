import { useState } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

export default function DeleteProjectModal({ project, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const expectedConfirm = `DELETE ${project.name}`;
  const isConfirmed = confirmText === expectedConfirm;

  const handleDelete = async () => {
    if (!isConfirmed || deleting) return;
    
    setDeleting(true);
    setError(null);
    
    try {
      // Delete from GCS
      const res = await fetch(`${SYNC_WORKER_URL}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: project.name.replace(/\s+/g, '_'),
          confirm: `DELETE ${project.name.replace(/\s+/g, '_')}`
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete from storage');
      }
      
      // Call parent to delete from Firestore
      onDeleted(project.id);
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <Icon name="alert-triangle" size={24} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Delete Project</h2>
              <p className="text-sm text-red-600 font-medium">{project.name}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-medium mb-2">This will permanently remove:</p>
            <ul className="text-sm text-amber-700 space-y-1">
              <li className="flex items-center gap-2">
                <Icon name="check" size={14} />
                Project from dashboard
              </li>
              <li className="flex items-center gap-2">
                <Icon name="check" size={14} />
                All synced files from cloud storage
              </li>
              <li className="flex items-center gap-2">
                <Icon name="check" size={14} />
                Search index entries
              </li>
            </ul>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm text-emerald-800">
              <Icon name="shield-check" size={14} className="inline mr-1" />
              Your <strong>Google Drive files will NOT be deleted</strong> and remain safe.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              To confirm, type: <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{expectedConfirm}</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type the confirmation text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-red-300 transition-colors font-mono"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {deleting ? (
              <><Icon name="loader-2" size={16} className="animate-spin" />Deleting...</>
            ) : (
              <><Icon name="trash-2" size={16} />Delete Project</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
