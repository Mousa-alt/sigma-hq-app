import Icon from '../Icon';

/**
 * Sync status bar - shows sync state and trigger button
 */
export default function SyncBar({ syncing, lastSyncTime, onSyncNow }) {
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${syncing ? 'bg-amber-100' : 'bg-emerald-100'}`}>
            <Icon 
              name={syncing ? 'loader-2' : 'cloud-check'} 
              size={16} 
              className={`sm:w-5 sm:h-5 ${syncing ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} 
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">
              {syncing ? 'Syncing...' : 'Synced'}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500">{formatLastSync()}</p>
          </div>
        </div>
        <button 
          onClick={onSyncNow} 
          disabled={syncing} 
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] sm:text-xs font-medium transition-all disabled:opacity-50 flex-shrink-0"
        >
          <Icon name="refresh-cw" size={12} className={`sm:w-3.5 sm:h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Now'}</span>
          <span className="sm:hidden">Sync</span>
        </button>
      </div>
    </div>
  );
}
