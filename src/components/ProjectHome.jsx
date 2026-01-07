import Icon from './Icon';

export default function ProjectHome({ project, syncing, onSyncNow, onUpdateStatus }) {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Site Status</p>
          <select 
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold uppercase outline-none" 
            value={project?.status || 'Active'} 
            onChange={(e) => onUpdateStatus(e.target.value)}
          >
            <option>Active</option>
            <option>Syncing...</option>
            <option>Completed</option>
            <option>Pending</option>
            <option>On Hold</option>
          </select>
        </div>
        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">GCS Vault</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-slate-900">277</span>
            <span className="text-[10px] font-black text-emerald-500 mb-1.5 uppercase tracking-widest">Documents</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={onSyncNow} 
            disabled={syncing} 
            className="flex items-center justify-between p-6 bg-slate-900 text-white rounded-[1.5rem] hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-tight">Sync Documents</p>
              <p className="text-[9px] opacity-70 font-bold mt-1 uppercase">Mirror Google Drive</p>
            </div>
            <Icon 
              name={syncing ? "loader-2" : "refresh-cw"} 
              size={20} 
              className={syncing ? "animate-spin text-blue-400" : "text-emerald-400"} 
            />
          </button>
          <button 
            onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')} 
            className="flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-[1.5rem] hover:border-blue-200 transition-all group"
          >
            <div className="text-left text-slate-900">
              <p className="text-xs font-black uppercase tracking-tight">Open Drive</p>
              <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">View source files</p>
            </div>
            <Icon name="external-link" size={20} className="text-slate-300 group-hover:text-blue-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
