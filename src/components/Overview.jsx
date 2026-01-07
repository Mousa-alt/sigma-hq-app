import Icon from './Icon';
import { COLORS } from '../config';

export default function Overview({ projects, onSelectProject }) {
  const getLastSyncTime = () => {
    const now = new Date();
    return now.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in">
      {/* Header with sync info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs font-medium">
            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'} Active
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Icon name="refresh-cw" size={12} />
          <span className="font-medium">Last sync: {getLastSyncTime()}</span>
        </div>
      </div>
      
      {/* Project Cards - 2 cols on mobile, 3 on tablet, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {projects.map(p => (
          <div 
            key={p.id} 
            onClick={() => onSelectProject(p)} 
            className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden p-3 sm:p-4 group" 
          >
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-slate-50 rounded-lg text-slate-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Icon name="file-text" size={16} className="sm:w-5 sm:h-5" />
              </div>
              <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[8px] sm:text-[10px] font-medium uppercase tracking-wide ${p.status === 'Syncing...' ? 'bg-amber-50 text-amber-600 animate-pulse' : p.status === 'Sync Error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {p.status || 'Active'}
              </span>
            </div>
            
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-0.5 sm:mb-1 truncate">{p.name}</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1 mb-2 sm:mb-3">
              <Icon name="map-pin" size={10} /> {p.location}
            </p>
            
            <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-blue-500 font-medium text-[10px] sm:text-xs uppercase tracking-wide">Open</span>
              <Icon name="arrow-right" size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <Icon name="folder-plus" size={24} style={{ color: COLORS.blue }} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Projects Yet</h3>
            <p className="text-slate-500 mt-1 text-sm">Register a project to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
