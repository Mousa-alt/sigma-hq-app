import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import FolderPopup from './FolderPopup';
import { parseFilename, getFileIcon, detectDocumentType, getDocTypeInfo } from '../utils/documentUtils';

// Standard 12-folder structure
const FOLDER_STRUCTURE = [
  { id: '01', name: '01-Contract Documents', icon: 'file-signature', color: 'blue' },
  { id: '02', name: '02-Design Drawings', icon: 'drafting-compass', color: 'indigo' },
  { id: '03', name: '03-Specifications', icon: 'book-open', color: 'violet' },
  { id: '04', name: '04-Shop Drawings', icon: 'pencil-ruler', color: 'purple' },
  { id: '05', name: '05-Quantity Surveying', icon: 'calculator', color: 'emerald' },
  { id: '06', name: '06-Site Reports', icon: 'clipboard-list', color: 'amber' },
  { id: '07', name: '07-Correspondence', icon: 'mail', color: 'sky' },
  { id: '08', name: '08-Quality Control', icon: 'shield-check', color: 'green' },
  { id: '09', name: '09-Health Safety', icon: 'hard-hat', color: 'red' },
  { id: '10', name: '10-Handover', icon: 'package-check', color: 'teal' },
  { id: '11', name: '11-Photos', icon: 'camera', color: 'pink' },
  { id: '12', name: '12-Archive', icon: 'archive', color: 'slate' },
];

// Quick access sections
const QUICK_ACCESS = [
  { id: 'approved-sd', label: 'Approved Shop Drawings', folder: '04-Shop Drawings/Approved', icon: 'check-circle', color: 'emerald' },
  { id: 'mom', label: 'Meeting Minutes', folder: '07-Correspondence/MOM', icon: 'users', color: 'purple' },
  { id: 'progress', label: 'Progress Reports', folder: '06-Site Reports/Progress', icon: 'trending-up', color: 'blue' },
  { id: 'invoices', label: 'Invoices', folder: '05-Quantity Surveying/Invoices', icon: 'receipt', color: 'amber' },
];

export default function Vault({ project }) {
  const [loading, setLoading] = useState(false);
  const [activePopup, setActivePopup] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    if (project) {
      loadRecentFiles();
    }
  }, [project?.id]);

  const loadRecentFiles = async () => {
    setLoadingRecent(true);
    try {
      // Try to get recent files from multiple folders
      const foldersToCheck = [
        '04-Shop Drawings',
        '05-Quantity Surveying',
        '07-Correspondence',
        '06-Site Reports'
      ];
      
      const allFiles = [];
      
      for (const folder of foldersToCheck) {
        try {
          const res = await fetch(`${SYNC_WORKER_URL}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              projectName: project.name.replace(/\s+/g, '_'),
              folderPath: folder
            })
          });
          
          if (res.ok) {
            const data = await res.json();
            const files = (data.files || []).filter(f => f.type === 'file');
            files.forEach(f => {
              f.folder = folder.split('-')[1]; // e.g., "Shop Drawings"
            });
            allFiles.push(...files);
          }
        } catch (e) {
          // Continue with other folders
        }
      }
      
      // Sort by updated date and take top 5
      allFiles.sort((a, b) => new Date(b.updated) - new Date(a.updated));
      setRecentFiles(allFiles.slice(0, 5));
    } catch (err) {
      // Use demo files
      setRecentFiles([
        { name: '45_AGORA-GEM-Kitchen_Layout-MH-Rev_02.pdf', folder: 'Shop Drawings', updated: '2026-01-03T14:00:00Z' },
        { name: '15_AGORA-GEM-Invoice_015-FIN-Rev_00.pdf', folder: 'Invoices', updated: '2026-01-05T09:00:00Z' },
        { name: 'MOM_2026_01_05.pdf', folder: 'Correspondence', updated: '2026-01-05T17:00:00Z' },
      ]);
    } finally {
      setLoadingRecent(false);
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-500 border-blue-200 hover:border-blue-300',
      indigo: 'bg-indigo-50 text-indigo-500 border-indigo-200 hover:border-indigo-300',
      violet: 'bg-violet-50 text-violet-500 border-violet-200 hover:border-violet-300',
      purple: 'bg-purple-50 text-purple-500 border-purple-200 hover:border-purple-300',
      emerald: 'bg-emerald-50 text-emerald-500 border-emerald-200 hover:border-emerald-300',
      amber: 'bg-amber-50 text-amber-500 border-amber-200 hover:border-amber-300',
      sky: 'bg-sky-50 text-sky-500 border-sky-200 hover:border-sky-300',
      green: 'bg-green-50 text-green-500 border-green-200 hover:border-green-300',
      red: 'bg-red-50 text-red-500 border-red-200 hover:border-red-300',
      teal: 'bg-teal-50 text-teal-500 border-teal-200 hover:border-teal-300',
      pink: 'bg-pink-50 text-pink-500 border-pink-200 hover:border-pink-300',
      slate: 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300',
    };
    return colors[color] || colors.slate;
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleFileClick = (file) => {
    if (file.url) {
      window.open(file.url, '_blank');
    } else if (file.path) {
      const viewUrl = `${SYNC_WORKER_URL}/view?path=${encodeURIComponent(file.path)}`;
      window.open(viewUrl, '_blank');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Project Documents</h2>
          <p className="text-sm text-slate-500">Browse and access all project files</p>
        </div>
        <button
          onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
        >
          <Icon name="external-link" size={14} />
          Open in Drive
        </button>
      </div>

      {/* Quick Access Panels */}
      <div className="mb-8">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_ACCESS.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePopup({ folder: item.folder, title: item.label })}
              className={`p-4 rounded-xl border transition-all hover:shadow-md text-left ${getColorClasses(item.color)}`}
            >
              <Icon name={item.icon} size={20} className="mb-2" />
              <p className="text-xs font-medium text-slate-900">{item.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Files */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Recently Modified</h3>
          <button 
            onClick={loadRecentFiles}
            className="text-[10px] text-blue-500 hover:text-blue-600"
          >
            Refresh
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loadingRecent ? (
            <div className="p-6 text-center">
              <Icon name="loader-2" size={20} className="animate-spin text-slate-400 mx-auto" />
            </div>
          ) : recentFiles.length === 0 ? (
            <div className="p-6 text-center">
              <Icon name="file" size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No recent files</p>
            </div>
          ) : (
            recentFiles.map((file, i) => {
              const parsed = parseFilename(file.name);
              const docType = detectDocumentType(file.name, file.folder || '');
              const typeInfo = getDocTypeInfo(docType);
              
              return (
                <div
                  key={i}
                  onClick={() => handleFileClick(file)}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                >
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                    <Icon name={getFileIcon(file.name)} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-1 py-0.5 rounded text-[8px] font-semibold uppercase bg-${typeInfo.color}-100 text-${typeInfo.color}-700`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {parsed.description || file.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {file.folder} • {formatTimeAgo(file.updated)}
                    </p>
                  </div>
                  <Icon name="chevron-right" size={14} className="text-slate-300" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Standard Folder Structure */}
      <div>
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">All Folders</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FOLDER_STRUCTURE.map(folder => (
            <button
              key={folder.id}
              onClick={() => setActivePopup({ folder: folder.name, title: folder.name.split('-')[1] })}
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${getColorClasses(folder.color)}`}>
                <Icon name={folder.icon} size={18} />
              </div>
              <p className="text-xs font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                {folder.name.split('-')[1]}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{folder.id}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Folder Popup */}
      {activePopup && (
        <FolderPopup
          project={project}
          folder={activePopup.folder}
          title={activePopup.title}
          onClose={() => setActivePopup(null)}
        />
      )}
    </div>
  );
}
