import Icon from './Icon';
import { COLORS } from '../config';

export default function Overview({ projects, onSelectProject }) {
  const metrics = [
    { label: 'Live Sites', val: projects.length, icon: 'activity', color: COLORS.blue },
    { label: 'Total Docs', val: '277', icon: 'file-text', color: '#6366F1' },
    { label: 'AI Status', val: 'Online', icon: 'zap', color: '#10B981' },
    { label: 'Last Sync', val: 'Today', icon: 'refresh-cw', color: COLORS.gold },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-white shadow-sm flex flex-col justify-between h-36">
            <div className="p-2.5 bg-slate-50 rounded-xl w-fit">
              <Icon name={m.icon} size={18} style={{ color: m.color }} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.label}</p>
              <p className="text-xl font-black text-slate-900 mt-1">{m.val}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map(p => (
          <div 
            key={p.id} 
            onClick={() => onSelectProject(p)} 
            className="project-card bg-white rounded-3xl border border-white shadow-sm hover:shadow-2xl transition-all cursor-pointer overflow-hidden border-t-8 p-6 md:p-8 group" 
            style={{ borderTopColor: p.status === 'Syncing...' ? COLORS.gold : COLORS.blue }}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Icon name="file-text" size={24} />
              </div>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${p.status === 'Syncing...' ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                {p.status || 'Active'}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 truncate uppercase tracking-tight">{p.name}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1">
              <Icon name="map-pin" size={10} /> {p.location}
            </p>
            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
              <span className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Command Room</span>
              <Icon name="arrow-right" size={14} className="text-slate-300 group-hover:text-blue-500" />
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Icon name="folder-plus" size={32} style={{ color: COLORS.blue }} />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase">No Projects Yet</h3>
            <p className="text-slate-500 mt-2 text-xs font-bold">Register a project to activate sync.</p>
          </div>
        )}
      </div>
    </div>
  );
}
