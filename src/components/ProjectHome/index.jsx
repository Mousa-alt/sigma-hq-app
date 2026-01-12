import { useState, useEffect } from 'react';
import { SYNC_WORKER_URL } from '../../config';

// Hooks
import { useProjectEmails, useProjectMessages, useProjectTasks } from '../../hooks';

// Sub-components
import SyncBar from './SyncBar';
import StatsGrid from './StatsGrid';
import TeamSection from './TeamSection';
import QuickLinks from './QuickLinks';
import DateEditor from './DateEditor';
import TasksHub from './TasksHub';
import ActivityFeed from './ActivityFeed';

// Helper to get GCS folder name - uses gcsFolderName field if set, otherwise project.name
const getGcsFolderName = (project) => {
  if (!project) return '';
  const folderName = project.gcsFolderName || project.name || '';
  return folderName.replace(/\s+/g, '_');
};

/**
 * ProjectHome - Main project dashboard
 * 
 * This is the orchestrating component that:
 * 1. Uses hooks for data fetching (emails, messages, tasks)
 * 2. Manages stats loading
 * 3. Renders sub-components
 */
export default function ProjectHome({ project, syncing, lastSyncTime, onSyncNow, onUpdateProject }) {
  const [stats, setStats] = useState({ fileCount: 0, totalSize: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  // Use custom hooks for data
  const { emails, loading: loadingEmails, actionableEmails } = useProjectEmails(project);
  const { messages, loading: loadingWhatsapp, actionableMessages } = useProjectMessages(project);
  const { tasks, loading: loadingTasks, incompleteTasks, addTask, toggleTask, deleteTask } = useProjectTasks(project);

  // Load stats from sync worker
  useEffect(() => {
    if (project?.name) {
      loadStats();
    }
  }, [project?.id, project?.gcsFolderName]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const gcsFolderName = getGcsFolderName(project);
      const res = await fetch(`${SYNC_WORKER_URL}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: gcsFolderName })
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-36 sm:pb-24">
      {/* Sync Status */}
      <SyncBar 
        syncing={syncing} 
        lastSyncTime={lastSyncTime} 
        onSyncNow={onSyncNow} 
      />

      {/* Stats Grid */}
      <StatsGrid 
        project={project} 
        stats={stats} 
        loadingStats={loadingStats} 
      />

      {/* Date Editor */}
      <DateEditor 
        project={project} 
        onUpdateProject={onUpdateProject} 
      />

      {/* Team Section - Shows assigned engineers */}
      <TeamSection project={project} />

      {/* Quick Links */}
      <QuickLinks project={project} />

      {/* Tasks Hub */}
      <TasksHub 
        tasks={tasks}
        loadingTasks={loadingTasks}
        actionableWhatsapp={actionableMessages}
        actionableEmails={actionableEmails}
        loadingWhatsapp={loadingWhatsapp}
        loadingEmails={loadingEmails}
        addTask={addTask}
        toggleTask={toggleTask}
        deleteTask={deleteTask}
      />

      {/* Activity Feed */}
      <ActivityFeed 
        emails={emails}
        messages={messages}
        loadingEmails={loadingEmails}
        loadingWhatsapp={loadingWhatsapp}
      />
    </div>
  );
}
