import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import FolderPopup from './FolderPopup';
import FileViewer from './FileViewer';
import { parseFilename, getFileIcon } from '../utils/documentUtils';

const FOLDER_ICONS = {
  'contract': { icon: 'file-text', color: 'blue' },
  'design': { icon: 'compass', color: 'indigo' },
  'drawing': { icon: 'ruler', color: 'purple' },
  'shop': { icon: 'ruler', color: 'purple' },
  'spec': { icon: 'book-open', color: 'violet' },
  'quantity': { icon: 'calculator', color: 'emerald' },
  'boq': { icon: 'calculator', color: 'emerald' },
  'qs': { icon: 'calculator', color: 'emerald' },
  'site': { icon: 'clipboard-list', color: 'amber' },
  'report': { icon: 'clipboard-list', color: 'amber' },
  'correspondence': { icon: 'mail', color: 'sky' },
  'letter': { icon: 'mail', color: 'sky' },
  'quality': { icon: 'shield-check', color: 'green' },
  'qc': { icon: 'shield-check', color: 'green' },
  'health': { icon: 'hard-hat', color: 'red' },
  'safety': { icon: 'hard-hat', color: 'red' },
  'hse': { icon: 'hard-hat', color: 'red' },
  'handover': { icon: 'package', color: 'teal' },
  'photo': { icon: 'camera', color: 'pink' },
  'image': { icon: 'camera', color: 'pink' },
  'archive': { icon: 'archive', color: 'slate' },
  'old': { icon: 'archive', color: 'slate' },
  'invoice': { icon: 'receipt', color: 'emerald' },
  'payment': { icon: 'receipt', color: 'emerald' },
  'meeting': { icon: 'users', color: 'purple' },
  'mom': { icon: 'users', color: 'purple' },
  'sample': { icon: 'box', color: 'amber' },
  'material': { icon: 'box', color: 'amber' },
};

const LATEST_DOC_CONFIG = {
  cvi: { icon: 'alert-circle', color: 'red', label: 'Latest CVI' },
  mom: { icon: 'users', color: 'purple', label: 'Latest MOM' },
  shop_drawing: { icon: 'ruler', color: 'indigo', label: 'Latest Shop Drawing' },
  invoice: { icon: 'receipt', color: 'emerald', label: 'Latest Invoice' },
  rfi: { icon: 'help-circle', color: 'blue', label: 'Latest RFI' },
  submittal: { icon: 'package', color: 'amber', label: 'Latest Submittal' },
};

const getFolderStyle = (folderName) => {
  const lower = folderName.toLowerCase();
  for (const [keyword, style] of Object.entries(FOLDER_ICONS)) {
    if (lower.includes(keyword)) return style;
  }
  return { icon: 'folder', color: 'slate' };
};

const cleanFolderName = (name) => name.replace(/^\d+[\.-_]\s*/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

export default function Vault({ project }) {
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [activePopup, setActivePopup] = useState(null);
  const [latestDocs, setLatestDocs] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [viewingFile, setViewingFile] = useState(null);

  useEffect(() => {
    if (project) {
      loadFolders();
      loadLatestDocs();
    }
  }, [project?.id]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: project.name.replace(/\s+/g, '_'), folderPath: '' })
      });
      if (res.ok) {
        const data = await res.json();
        setFolders((data.files || []).filter(f => f.type === 'folder'));
      } else setFolders([]);
    } catch (err) {
      console.error('Error loading folders:', err);
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadLatestDocs = async () => {
    setLoadingLatest(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/latest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: project.name.replace(/\s+/g, '_') })
      });
      if (res.ok) {
        const data = await res.json();
        setLatestDocs(data.latest || []);
      } else setLatestDocs([]);
    } catch (err) {
      console.error('Error loading latest docs:', err);
      setLatestDocs([]);
    } finally {
      setLoadingLatest(false);
    }
  };

  const colorClasses = {
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

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const handleLatestDocClick = (doc) => {
    const filePath = `${project.name.replace(/\s+/g, '_')}/${doc.path}`;
    setViewingFile({ name: doc.name, path: filePath });
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Project Documents</h2>
          <p className="text-sm text-slate-500">Browse and access all project files</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadFolders(); loadLatestDocs(); }} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-600">
            <Icon name="refresh-cw" size={12} />Refresh
          </button>
          <button onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs font-medium text-white">
            <Icon name="external-link" size={14} />Open in Drive
          </button>
        </div>
      </div>

      {/* Latest Documents by Type */}
      <div className="mb-8">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">Latest Documents</h3>
        {loadingLatest ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <Icon name="loader-2" size={20} className="animate-spin text-slate-400 mx-auto" />
          </div>
        ) : latestDocs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <Icon name="file" size={24} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No documents found yet</p>
            <p className="text-xs text-slate-400 mt-1">Sync your project to load documents</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {latestDocs.map((doc, i) => {
              const config = LATEST_DOC_CONFIG[doc.type] || { icon: 'file', color: 'slate', label: doc.typeLabel };
              const parsed = parseFilename(doc.name);
              return (
                <button
                  key={i}
                  onClick={() => handleLatestDocClick(doc)}
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colorClasses[config.color]?.split(' ').slice(0, 2).join(' ') || 'bg-slate-100 text-slate-500'}`}>
                      <Icon name={config.icon} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium uppercase text-slate-400 mb-1">{config.label}</p>
                      <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">
                        {parsed.description || doc.name}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {formatTimeAgo(doc.updated)}
                        {parsed.revision && ` • Rev ${parsed.revision}`}
                      </p>
                    </div>
                    <Icon name="chevron-right" size={14} className="text-slate-300 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Folders Grid */}
      <div>
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">All Folders</h3>
        {loadingFolders ? (
          <div className="flex items-center justify-center py-12"><Icon name="loader-2" size={24} className="animate-spin text-slate-400" /></div>
        ) : folders.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
            <Icon name="folder" size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No folders found</p>
            <p className="text-xs text-slate-400 mt-1">Sync your project to load folders from Drive</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {folders.map((folder, i) => {
              const style = getFolderStyle(folder.name);
              const displayName = cleanFolderName(folder.name);
              return (
                <button key={i} onClick={() => setActivePopup({ folder: folder.name, title: displayName })} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses[style.color]}`}>
                    <Icon name={style.icon} size={18} />
                  </div>
                  <p className="text-xs font-medium text-slate-900 group-hover:text-blue-600 truncate">{displayName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{folder.name}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activePopup && <FolderPopup project={project} folder={activePopup.folder} title={activePopup.title} onClose={() => setActivePopup(null)} />}
      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}
