import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { APP_ID, SYNC_WORKER_URL, COLORS, TABS, BRANDING } from './config';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './components/Overview';
import ProjectHome from './components/ProjectHome';
import AIChat from './components/AIChat';
import Vault from './components/Vault';
import Actions from './components/Actions';
import ProjectSettings from './components/ProjectSettings';
import ChannelSettings from './components/ChannelSettings';
import Modal from './components/Modal';
import ChatPanel from './components/ChatPanel';
import Icon from './components/Icon';
import PasswordGate from './components/PasswordGate';
import OrgChart from './components/OrgChart';

// Add Settings tab
const ALL_TABS = [...TABS, { id: 'settings', label: 'Settings', icon: 'settings' }];

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('sigma_authenticated') === 'true';
  });
  
  // Core state
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('overview');
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  
  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Firebase Auth - runs always
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Projects listener - runs when user is authenticated
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(data);
      if (selectedProject) {
        const updated = data.find(p => p.id === selectedProject.id);
        if (updated) {
          setSelectedProject(updated);
          if (updated.lastSyncAt) {
            setLastSyncTime(updated.lastSyncAt.toDate ? updated.lastSyncAt.toDate() : updated.lastSyncAt);
          }
        }
      }
    });
  }, [user, selectedProject?.id]);

  // Update lastSyncTime when selecting a project
  useEffect(() => {
    if (selectedProject?.lastSyncAt) {
      setLastSyncTime(selectedProject.lastSyncAt.toDate ? selectedProject.lastSyncAt.toDate() : selectedProject.lastSyncAt);
    } else {
      setLastSyncTime(null);
    }
    setSyncError(null);
  }, [selectedProject?.id]);

  // Show password gate if not authenticated
  if (!isAuthenticated) {
    return <PasswordGate onAuthenticate={setIsAuthenticated} />;
  }

  // Handlers
  const handleCreateProject = async (formData) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects'), {
        ...formData,
        createdAt: serverTimestamp(),
        userId: user?.uid
      });
      
      // Trigger sync (fire and forget) - only if driveLink provided
      if (formData.driveLink) {
        fetch(SYNC_WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            driveUrl: formData.driveLink, 
            projectName: formData.name.replace(/\s+/g, '_') 
          })
        });
      }
      
      setIsModalOpen(false);
    } catch (err) {
      alert('Error creating project');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (!selectedProject?.driveLink) return alert('No Drive link found.');
    setSyncing(true);
    setSyncError(null);
    
    try {
      const res = await fetch(SYNC_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          driveUrl: selectedProject.driveLink, 
          projectName: selectedProject.name.replace(/\s+/g, '_') 
        })
      });
      const result = await res.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.added !== undefined) {
        alert(`✅ Sync Complete\n\nAdded: ${result.added}\nUpdated: ${result.updated}\nDeleted: ${result.deleted}\nSkipped: ${result.skipped}`);
        
        const now = new Date();
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', selectedProject.id), { 
          status: 'active',
          lastSyncAt: now
        });
        setLastSyncTime(now);
      } else {
        throw new Error("Sync failed - no results returned");
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncError(err.message);
      alert(`❌ Sync Failed\n\n${err.message}`);
      
      // Update status to show error
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', selectedProject.id), { 
        status: 'Sync Error'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateProject = async (updatedProject) => {
    if (!updatedProject?.id) return;
    const { id, ...data } = updatedProject;
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', id), data);
  };

  const handleDeleteProject = async (projectId) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', projectId));
    setView('overview');
    setSelectedProject(null);
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    setView('project');
    setActiveTab('home');
  };

  const handleGoToOverview = () => {
    setView('overview');
    setSelectedProject(null);
    setLastSyncTime(null);
    setSyncError(null);
  };

  const handleGoToSettings = () => {
    setView('settings');
    setSelectedProject(null);
    setLastSyncTime(null);
    setSyncError(null);
  };

  const handleGoToOrgChart = () => {
    setView('orgchart');
    setSelectedProject(null);
    setLastSyncTime(null);
    setSyncError(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sigma_authenticated');
    setIsAuthenticated(false);
  };

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ backgroundColor: COLORS.background }}>
      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        view={view}
        isSidebarOpen={isSidebarOpen}
        onSelectProject={handleSelectProject}
        onGoToOverview={handleGoToOverview}
        onGoToSettings={handleGoToSettings}
        onGoToOrgChart={handleGoToOrgChart}
        onOpenModal={() => setIsModalOpen(true)}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main content - prevent horizontal scroll */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-x-hidden overflow-y-hidden">
        <Header
          view={view}
          selectedProject={selectedProject}
          syncing={syncing}
          lastSyncTime={lastSyncTime}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onGoBack={handleGoToOverview}
          onSyncNow={handleSyncNow}
          onOpenModal={() => setIsModalOpen(true)}
        />

        {/* Scrollable content area - prevent horizontal scroll */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto no-scrollbar p-4 sm:p-6 lg:p-10">
          {view === 'overview' ? (
            <Overview projects={projects} onSelectProject={handleSelectProject} />
          ) : view === 'settings' ? (
            <div className="bg-white rounded-xl border border-slate-200 min-h-[600px] overflow-hidden animate-in pb-20">
              <ChannelSettings projects={projects} />
            </div>
          ) : view === 'orgchart' ? (
            <OrgChart projects={projects} />
          ) : (
            <div className="h-full flex flex-col animate-in">
              {/* Sync Error Banner */}
              {syncError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <Icon name="alert-circle" size={18} className="text-red-500" />
                  <span className="text-xs sm:text-sm text-red-700 flex-1">Sync failed: {syncError}</span>
                  <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-600">
                    <Icon name="x" size={16} />
                  </button>
                </div>
              )}

              {/* Tabs - scrollable on mobile */}
              <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                {ALL_TABS.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id)} 
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                      activeTab === t.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <Icon name={t.icon} size={12} className="sm:w-3.5 sm:h-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content - scrollable, prevent horizontal overflow */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 lg:p-8 flex-1 overflow-x-hidden overflow-y-auto">
                {activeTab === 'home' && (
                  <ProjectHome
                    project={selectedProject}
                    syncing={syncing}
                    lastSyncTime={lastSyncTime}
                    onSyncNow={handleSyncNow}
                    onUpdateProject={handleUpdateProject}
                  />
                )}
                {activeTab === 'search' && <AIChat project={selectedProject} />}
                {activeTab === 'vault' && <Vault project={selectedProject} />}
                {activeTab === 'actions' && <Actions />}
                {activeTab === 'settings' && (
                  <ProjectSettings
                    project={selectedProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Sigma icon - bottom right (visible when sidebar hidden) */}
      <div className="fixed bottom-4 right-4 z-30 lg:hidden">
        <img 
          src={BRANDING.logo} 
          alt="Sigma" 
          className="w-10 h-10 object-contain opacity-50"
        />
      </div>

      {/* Bottom chat panel (project view only) */}
      {view === 'project' && (
        <ChatPanel
          project={selectedProject}
          isExpanded={isChatExpanded}
          onToggle={() => setIsChatExpanded(!isChatExpanded)}
        />
      )}

      {/* Create project modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
        loading={loading}
      />
    </div>
  );
}
