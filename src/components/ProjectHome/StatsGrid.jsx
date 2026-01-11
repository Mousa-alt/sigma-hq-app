import Icon from '../Icon';

const STATUS_CONFIG = {
  tender: { color: 'bg-amber-500', label: 'Tender' },
  planning: { color: 'bg-purple-500', label: 'Planning' },
  active: { color: 'bg-emerald-500', label: 'Active' },
  on_hold: { color: 'bg-slate-400', label: 'On Hold' },
  completed: { color: 'bg-blue-500', label: 'Completed' },
  overdue: { color: 'bg-red-500', label: 'Overdue' },
};

/**
 * Get smart status based on dates
 */
export const getSmartStatus = (project) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  if (project?.status === 'on_hold') return 'on_hold';
  if (project?.status === 'tender') return 'tender';
  if (project?.status === 'planning') return 'planning';
  
  if (project?.completionDate) {
    const completionDate = new Date(project.completionDate);
    completionDate.setHours(0, 0, 0, 0);
    if (completionDate <= now) return 'completed';
  }
  
  if (project?.expectedEndDate && !project?.completionDate) {
    const expectedEnd = new Date(project.expectedEndDate);
    expectedEnd.setHours(0, 0, 0, 0);
    if (expectedEnd < now) return 'overdue';
  }
  
  if (project?.startDate) {
    const startDate = new Date(project.startDate);
    startDate.setHours(0, 0, 0, 0);
    if (startDate <= now) return 'active';
    return 'planning';
  }
  
  return project?.status || 'active';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
};

/**
 * Stats grid - shows project status, docs count, dates
 */
export default function StatsGrid({ project, stats, loadingStats }) {
  const currentStatus = getSmartStatus(project);
  const statusDisplay = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.active;

  const getCompletionDisplay = () => {
    if (project?.completionDate) return { text: formatDate(project.completionDate), color: 'text-emerald-600' };
    if (currentStatus === 'overdue') return { text: 'Overdue', color: 'text-red-500' };
    return { text: 'Ongoing', color: 'text-slate-400' };
  };

  const completionDisplay = getCompletionDisplay();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
      <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Status</p>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusDisplay.color}`} />
          <span className="text-xs sm:text-sm font-medium text-slate-900">{statusDisplay.label}</span>
        </div>
      </div>
      
      <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Docs</p>
        {loadingStats ? (
          <Icon name="loader-2" size={14} className="animate-spin text-slate-400" />
        ) : (
          <span className="text-lg sm:text-xl font-semibold text-slate-900">{stats.fileCount}</span>
        )}
      </div>
      
      <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Start</p>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-900">{formatDate(project?.startDate)}</span>
      </div>
      
      <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Target</p>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-900">{formatDate(project?.expectedEndDate)}</span>
      </div>
      
      <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
        <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Completed</p>
        <span className={`text-[10px] sm:text-xs font-semibold ${completionDisplay.color}`}>{completionDisplay.text}</span>
      </div>
    </div>
  );
}
