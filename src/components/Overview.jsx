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
    <div className="max-w-7xl mx-auto space-y-8 animate-in">
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
      
      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map(p => (
          <div 
            key={p.id} 
            onClick={() => onSelectProject(p)} 
            className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden p-6 group" 
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Icon name="file-text" size={20} />
              </div>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wide ${p.status === 'Syncing...' ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}>
                {p.status || 'Active'}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{p.name}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1 mb-4">
              <Icon name="map-pin" size={10} /> {p.location}
            </p>
            
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-blue-500 font-medium text-xs uppercase tracking-wide">Command Room</span>
              <Icon name="arrow-right" size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="folder-plus" size={28} style={{ color: COLORS.blue }} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No Projects Yet</h3>
            <p className="text-slate-500 mt-1 text-sm">Register a project to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
