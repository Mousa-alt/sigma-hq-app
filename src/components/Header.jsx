import Icon from './Icon';
import { COLORS, BRANDING } from '../config';

export default function Header({ 
  view, 
  selectedProject, 
  syncing, 
  onOpenSidebar, 
  onGoBack, 
  onSyncNow, 
  onOpenModal 
}) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenSidebar} 
          className="lg:hidden p-2 bg-slate-50 rounded-xl text-slate-600"
        >
          <Icon name="menu" size={20} />
        </button>
        
        {view === 'project' && (
          <button 
            onClick={onGoBack} 
            className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900"
          >
            <Icon name="arrow-left" size={18} />
          </button>
        )}
        
        <div className="truncate">
          <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate">
            {view === 'overview' ? BRANDING.overviewTitle : selectedProject?.name}
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: COLORS.blue }}>
            {view === 'overview' ? BRANDING.overviewSubtitle : BRANDING.subtitle}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {view === 'project' && (
          <button 
            onClick={onSyncNow} 
            disabled={syncing} 
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
          >
            <Icon name={syncing ? "loader-2" : "refresh-cw"} size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
        <button 
          onClick={onOpenModal} 
          className="p-2.5 text-white rounded-xl shadow-xl active:scale-95 transition-all" 
          style={{ backgroundColor: COLORS.navy }}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </header>
  );
}
