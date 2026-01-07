import Icon from './Icon';
import { COLORS, BRANDING } from '../config';

export default function Sidebar({ 
  projects, 
  selectedProject, 
  view, 
  isSidebarOpen, 
  onSelectProject, 
  onGoToOverview, 
  onOpenModal,
  onCloseSidebar 
}) {
  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col text-white shadow-2xl`} 
      style={{ backgroundColor: COLORS.navy }}
    >
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <img 
          src={BRANDING.logoWhite} 
          alt="Sigma" 
          className="w-full mb-4" 
        />
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
          {BRANDING.title}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto no-scrollbar">
        <button 
          onClick={() => { onGoToOverview(); onCloseSidebar(); }} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-4 ${view === 'overview' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} 
          style={view === 'overview' ? { backgroundColor: COLORS.blue } : {}}
        >
          <Icon name="layout-dashboard" size={18} /> 
          <span className="font-medium text-sm uppercase tracking-tight">Dashboard</span>
        </button>

        <div className="flex items-center justify-between px-4 mb-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Live Projects</span>
          <button 
            onClick={onOpenModal} 
            className="p-1 rounded text-white shadow-lg" 
            style={{ backgroundColor: COLORS.blue }}
          >
            <Icon name="plus" size={12} />
          </button>
        </div>

        <div className="space-y-1">
          {projects.map(p => (
            <button 
              key={p.id} 
              onClick={() => { onSelectProject(p); onCloseSidebar(); }} 
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all ${selectedProject?.id === p.id ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:text-white'}`}
            >
              <div className={`shrink-0 w-2 h-2 rounded-full ${p.status === 'Syncing...' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-xs font-medium truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Chat with all projects */}
      <div className="border-t border-white/5 bg-black/20 p-4">
        <div className="flex items-center gap-2 text-white/70 mb-3">
          <Icon name="message-circle" size={14} /> 
          <span className="text-[10px] font-medium uppercase tracking-widest">Chat with all projects</span>
        </div>
        <div className="relative">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs outline-none focus:border-blue-500 text-white placeholder:text-slate-500 font-medium" 
            placeholder="Ask across all projects..." 
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors">
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
