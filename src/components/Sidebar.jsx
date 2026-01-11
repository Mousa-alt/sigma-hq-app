import { useState, useEffect } from 'react';
import Icon from './Icon';
import { COLORS, BRANDING } from '../config';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export default function Sidebar({ 
  projects, 
  selectedProject, 
  view, 
  isSidebarOpen, 
  onSelectProject, 
  onGoToOverview,
  onGoToSettings,
  onGoToOrgChart,
  onOpenModal,
  onCloseSidebar,
  onLogout
}) {
  const [projectBadges, setProjectBadges] = useState({});

  // Real-time badges from both WhatsApp AND Email
  useEffect(() => {
    const whatsappRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    const emailRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'emails');
    
    let whatsappBadges = {};
    let emailBadges = {};
    
    const updateBadges = () => {
      const combined = {};
      // Combine WhatsApp badges
      Object.entries(whatsappBadges).forEach(([project, count]) => {
        combined[project] = (combined[project] || 0) + count;
      });
      // Combine Email badges
      Object.entries(emailBadges).forEach(([project, count]) => {
        combined[project] = (combined[project] || 0) + count;
      });
      setProjectBadges(combined);
    };
    
    // Listen to WhatsApp
    const unsubWhatsapp = onSnapshot(whatsappRef, (snapshot) => {
      whatsappBadges = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const projectName = data.project_name;
        if (projectName && data.is_actionable === true && data.status !== 'done') {
          whatsappBadges[projectName] = (whatsappBadges[projectName] || 0) + 1;
        }
      });
      updateBadges();
    }, (error) => {
      console.error('Sidebar WhatsApp badges error:', error);
    });
    
    // Listen to Emails
    const unsubEmail = onSnapshot(emailRef, (snapshot) => {
      emailBadges = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const projectName = data.project_name;
        if (projectName && data.is_actionable === true && data.status !== 'done') {
          emailBadges[projectName] = (emailBadges[projectName] || 0) + 1;
        }
      });
      updateBadges();
    }, (error) => {
      console.error('Sidebar Email badges error:', error);
    });
    
    return () => {
      unsubWhatsapp();
      unsubEmail();
    };
  }, []);

  const totalPending = Object.values(projectBadges).reduce((a, b) => a + b, 0);

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col text-white shadow-2xl`} 
      style={{ backgroundColor: COLORS.navy }}
    >
      {/* Logo - aligned left */}
      <div className="px-5 py-5 border-b border-white/5 flex justify-start">
        <img src={BRANDING.logoWhite} alt="Sigma" className="h-12 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto no-scrollbar">
        <p className="px-4 mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation</p>
        
        <button 
          onClick={() => { onGoToOverview(); onCloseSidebar(); }} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-2 ${view === 'overview' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} 
          style={view === 'overview' ? { backgroundColor: COLORS.blue } : {}}
        >
          <Icon name="layout-dashboard" size={18} /> 
          <span className="font-medium text-sm">Dashboard</span>
          {totalPending > 0 && view !== 'overview' && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {totalPending}
            </span>
          )}
        </button>

        <button 
          onClick={() => { onGoToOrgChart?.(); onCloseSidebar(); }} 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-2 ${view === 'orgchart' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} 
          style={view === 'orgchart' ? { backgroundColor: COLORS.blue } : {}}
        >
          <Icon name="users" size={18} /> 
          <span className="font-medium text-sm">Organization</span>
        </button>

        {/* Projects */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Projects</span>
            <button 
              onClick={onOpenModal} 
              className="p-1 rounded text-white shadow-lg" 
              style={{ backgroundColor: COLORS.blue }}
            >
              <Icon name="plus" size={12} />
            </button>
          </div>

          <div className="space-y-1">
            {projects.map(p => {
              const badge = projectBadges[p.name] || 0;
              const projectStatus = p.status || 'active';
              return (
                <button 
                  key={p.id} 
                  onClick={() => { onSelectProject(p); onCloseSidebar(); }} 
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all ${
                    selectedProject?.id === p.id 
                      ? 'bg-white/10 text-white border border-white/10' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className={`shrink-0 w-2 h-2 rounded-full ${
                    projectStatus === 'tender' ? 'bg-amber-500' :
                    projectStatus === 'on_hold' ? 'bg-slate-400' :
                    projectStatus === 'completed' ? 'bg-blue-500' :
                    projectStatus === 'Syncing...' ? 'bg-amber-500 animate-pulse' : 
                    projectStatus === 'Sync Error' ? 'bg-red-500' :
                    badge > 0 ? 'bg-red-400' : 'bg-emerald-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate block">{p.name}</span>
                    {p.venue && (
                      <span className="text-[9px] text-slate-500 truncate block">{p.venue}</span>
                    )}
                  </div>
                  {badge > 0 && (
                    <span className="bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="mt-8">
          <p className="px-4 mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Settings</p>
          
          <button 
            onClick={() => { onGoToSettings?.(); onCloseSidebar(); }} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
              view === 'settings' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon name="sliders" size={16} /> 
            <span className="text-xs font-medium">Channel Mapping</span>
          </button>
        </div>
      </nav>

      {/* AI Search */}
      <div className="border-t border-white/5 bg-black/20 p-4">
        <div className="flex items-center gap-2 text-white/50 mb-3">
          <Icon name="sparkles" size={14} /> 
          <span className="text-[10px] font-medium uppercase tracking-widest">AI Search</span>
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

      {/* Logout */}
      <div className="border-t border-white/5 p-4">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <Icon name="log-out" size={16} /> 
          <span className="text-xs font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
