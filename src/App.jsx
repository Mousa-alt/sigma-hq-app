import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { APP_ID, SYNC_WORKER_URL, COLORS, TABS } from './config';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './components/Overview';
import ProjectHome from './components/ProjectHome';
import AIChat from './components/AIChat';
import Vault from './components/Vault';
import Actions from './components/Actions';
import Modal from './components/Modal';
import ChatPanel from './components/ChatPanel';
import Icon from './components/Icon';

export default function App() {
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  // Auth
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Projects listener
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
        if (updated) setSelectedProject(updated);
      }
    });
  }, [user, selectedProject?.id]);

  // Handlers
  const handleCreateProject = async (formData) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects'), {
        ...formData,
        status: 'Syncing...',
        createdAt: serverTimestamp(),
        userId: user.uid
      });
      
      // Trigger sync
      fetch(SYNC_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          driveUrl: formData.driveLink, 
          projectName: formData.name.replace(/\s+/g, '_') 
        })
      });
      
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
      if (result.added !== undefined) {
        alert(`✅ Sync Complete\n\nAdded: ${result.added}\nUpdated: ${result.updated}\nDeleted: ${result.deleted}\nSkipped: ${result.skipped}`);
        handleUpdateStatus('Active');
      } else {
        throw new Error(result.error || "Sync failed");
      }
    } catch (err) {
      alert('Sync triggered! Check Cloud Run logs for progress.');
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedProject) return;
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', selectedProject.id), { status });
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    setView('project');
    setActiveTab('home');
  };

  const handleGoToOverview = () => {
    setView('overview');
    setSelectedProject(null);
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
        onOpenModal={() => setIsModalOpen(true)}
        onCloseSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          view={view}
          selectedProject={selectedProject}
          syncing={syncing}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onGoBack={handleGoToOverview}
          onSyncNow={handleSyncNow}
          onOpenModal={() => setIsModalOpen(true)}
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-10">
          {view === 'overview' ? (
            <Overview projects={projects} onSelectProject={handleSelectProject} />
          ) : (
            <div className="h-full flex flex-col animate-in">
              {/* Tabs */}
              <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
                {TABS.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id)} 
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeTab === t.id ? 'text-white shadow-lg' : 'text-slate-500 hover:bg-white'
                    }`} 
                    style={activeTab === t.id ? { backgroundColor: COLORS.navy } : {}}
                  >
                    <Icon name={t.icon} size={14} /> {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="bg-white rounded-[2.5rem] p-6 lg:p-12 shadow-sm flex-1 min-h-[400px] overflow-hidden">
                {activeTab === 'home' && (
                  <ProjectHome
                    project={selectedProject}
                    syncing={syncing}
                    onSyncNow={handleSyncNow}
                    onUpdateStatus={handleUpdateStatus}
                  />
                )}
                {activeTab === 'ai' && <AIChat project={selectedProject} />}
                {activeTab === 'vault' && <Vault project={selectedProject} />}
                {activeTab === 'actions' && <Actions />}
              </div>
            </div>
          )}
        </div>
      </main>

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
