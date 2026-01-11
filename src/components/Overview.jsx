import { useState, useEffect } from 'react';
import Icon from './Icon';
import { COLORS, SYNC_WORKER_URL } from '../config';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';

export default function Overview({ projects, onSelectProject }) {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    urgentTasks: 0,
    recentActivity: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to WhatsApp messages for stats
    const whatsappRef = collection(db, 'artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages');
    
    const unsubWhatsapp = onSnapshot(whatsappRef, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Calculate stats
      const actionable = messages.filter(m => m.is_actionable);
      const completed = actionable.filter(m => m.status === 'done');
      const pending = actionable.filter(m => m.status !== 'done');
      const urgent = pending.filter(m => m.urgency === 'high');
      
      // Recent activity (last 24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = messages.filter(m => {
        const date = new Date(m.created_at || 0);
        return date > yesterday;
      });
      
      setStats({
        totalTasks: actionable.length,
        completedTasks: completed.length,
        pendingTasks: pending.length,
        urgentTasks: urgent.length,
        recentActivity: recent.length
      });
      
      // Get recent activity for timeline (summarized by project)
      const activityByProject = {};
      recent.forEach(msg => {
        const proj = msg.project_name || 'General';
        if (!activityByProject[proj]) {
          activityByProject[proj] = { count: 0, urgent: 0, lastTime: null };
        }
        activityByProject[proj].count++;
        if (msg.urgency === 'high') activityByProject[proj].urgent++;
        const msgTime = new Date(msg.created_at || 0);
        if (!activityByProject[proj].lastTime || msgTime > activityByProject[proj].lastTime) {
          activityByProject[proj].lastTime = msgTime;
        }
      });
      
      const activityList = Object.entries(activityByProject)
        .map(([project, data]) => ({ project, ...data }))
        .sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0))
        .slice(0, 5);
      
      setRecentActivity(activityList);
      setLoading(false);
    }, (error) => {
      console.error('Firestore error:', error);
      setLoading(false);
    });

    return () => unsubWhatsapp();
  }, [projects]);

  // Calculate project health
  const getProjectHealth = (project) => {
    // This would ideally come from real data
    // For now, simulate based on project existence
    const statuses = ['healthy', 'attention', 'healthy', 'healthy'];
    const index = projects.findIndex(p => p.id === project.id);
    return statuses[index % statuses.length];
  };

  const healthConfig = {
    healthy: { color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'On Track', icon: 'check-circle' },
    attention: { color: 'text-amber-500', bg: 'bg-amber-50', label: 'Needs Review', icon: 'alert-circle' },
    critical: { color: 'text-red-500', bg: 'bg-red-50', label: 'Critical', icon: 'alert-triangle' }
  };

  const statusConfig = {
    tender: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Tender', icon: 'file-text' },
    active: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Active', icon: 'play-circle' },
    on_hold: { color: 'text-slate-600', bg: 'bg-slate-100', label: 'On Hold', icon: 'pause-circle' },
    completed: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Completed', icon: 'check-circle' },
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 100;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Command Center</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            System Online
          </span>
        </div>
      </div>

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Active Projects */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon name="briefcase" size={18} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{projects.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Projects</p>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Icon name="clipboard-list" size={18} className="text-amber-600" />
            </div>
            {stats.urgentTasks > 0 && (
              <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {stats.urgentTasks} urgent
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.pendingTasks}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pending Actions</p>
        </div>

        {/* Completion Rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Icon name="trending-up" size={18} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
          <p className="text-xs text-slate-500 mt-0.5">Task Completion</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Activity (24h) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Icon name="activity" size={18} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.recentActivity}</p>
          <p className="text-xs text-slate-500 mt-0.5">Messages (24h)</p>
        </div>
      </div>

      {/* Projects Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Projects Overview</h2>
          <span className="text-xs text-slate-400">{projects.length} total</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => {
            const health = getProjectHealth(project);
            const healthStyle = healthConfig[health];
            const projectStatus = project.status || 'active';
            const statusStyle = statusConfig[projectStatus] || statusConfig.active;
            
            return (
              <div 
                key={project.id} 
                onClick={() => onSelectProject(project)} 
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
              >
                {/* Header stripe based on status */}
                <div className={`h-1 ${
                  projectStatus === 'active' ? 'bg-emerald-500' : 
                  projectStatus === 'tender' ? 'bg-amber-500' :
                  projectStatus === 'on_hold' ? 'bg-slate-400' :
                  projectStatus === 'completed' ? 'bg-blue-500' : 'bg-emerald-500'
                }`} />
                
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                        <Icon name="folder" size={20} className="text-slate-600 group-hover:text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{project.name}</h3>
                        {project.venue && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Icon name="map-pin" size={10} />
                            {project.venue}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Status badge */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusStyle.bg}`}>
                      <Icon name={statusStyle.icon} size={10} className={statusStyle.color} />
                      <span className={`text-[9px] font-medium ${statusStyle.color}`}>{statusStyle.label}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {project.startDate && (
                        <span className="flex items-center gap-1">
                          <Icon name="calendar" size={10} />
                          {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${healthStyle.bg}`}>
                      <Icon name={healthStyle.icon} size={10} className={healthStyle.color} />
                      <span className={`text-[9px] font-medium ${healthStyle.color}`}>{healthStyle.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Icon name="folder-plus" size={24} className="text-blue-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No Projects Yet</h3>
              <p className="text-slate-500 mt-1 text-sm">Register your first project to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Summary */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg">
                <Icon name="clock" size={18} className="text-slate-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
                <p className="text-xs text-slate-500">Last 24 hours</p>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {recentActivity.map((activity, index) => (
              <div key={index} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${activity.urgent > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{activity.project}</p>
                      <p className="text-xs text-slate-500">
                        {activity.count} message{activity.count !== 1 ? 's' : ''}
                        {activity.urgent > 0 && (
                          <span className="text-amber-600"> • {activity.urgent} urgent</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{formatTimeAgo(activity.lastTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">AI-Powered Technical Office</h3>
            <p className="text-slate-400 text-xs mt-1">
              WhatsApp commands • Document search • Smart task tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <Icon name="message-circle" size={18} className="text-green-400" />
            </div>
            <div className="p-2 bg-white/10 rounded-lg">
              <Icon name="search" size={18} className="text-blue-400" />
            </div>
            <div className="p-2 bg-white/10 rounded-lg">
              <Icon name="zap" size={18} className="text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* All Clear State */}
      {!loading && stats.pendingTasks === 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon name="check-circle" size={24} className="text-emerald-600" />
          </div>
          <h3 className="text-sm font-semibold text-emerald-900">All Clear!</h3>
          <p className="text-emerald-700 mt-1 text-xs">No pending action items across all projects</p>
        </div>
      )}
    </div>
  );
}
