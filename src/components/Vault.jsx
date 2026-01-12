import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import FolderPopup from './FolderPopup';
import FileViewer from './FileViewer';

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

const DOC_TYPE_CONFIG = {
  vo: { icon: 'file-signature', color: 'orange', label: 'VO' },
  approval: { icon: 'check-circle', color: 'green', label: 'Approval' },
  mom: { icon: 'users', color: 'purple', label: 'MOM' },
  shop_drawing: { icon: 'ruler', color: 'indigo', label: 'Shop Dwg' },
  invoice: { icon: 'receipt', color: 'emerald', label: 'Invoice' },
  rfi: { icon: 'help-circle', color: 'blue', label: 'RFI' },
  submittal: { icon: 'package', color: 'amber', label: 'Submittal' },
  correspondence: { icon: 'mail', color: 'sky', label: 'Letter' },
  report: { icon: 'clipboard-list', color: 'teal', label: 'Report' },
  specification: { icon: 'book-open', color: 'violet', label: 'Spec' },
  drawing: { icon: 'compass', color: 'indigo', label: 'Drawing' },
  contract: { icon: 'file-text', color: 'blue', label: 'Contract' },
  boq: { icon: 'calculator', color: 'emerald', label: 'BOQ' },
  other: { icon: 'file', color: 'slate', label: 'Document' },
};

const SUBJECT_LABELS = {
  flooring: 'Flooring', kitchen: 'Kitchen', bathroom: 'Bathroom', ceiling: 'Ceiling',
  wall: 'Wall', door: 'Door', window: 'Window', electrical: 'Electrical',
  mechanical: 'Mechanical', plumbing: 'Plumbing', fire: 'Fire', furniture: 'Furniture',
  signage: 'Signage', landscape: 'Landscape', structure: 'Structure',
  architectural: 'Architectural', mep: 'MEP', interior: 'Interior', lighting: 'Lighting',
  general: 'General',
};

const getFolderStyle = (folderName) => {
  const lower = folderName.toLowerCase();
  for (const [keyword, style] of Object.entries(FOLDER_ICONS)) {
    if (lower.includes(keyword)) return style;
  }
  return { icon: 'folder', color: 'slate' };
};

const cleanFolderName = (name) => name.replace(/^\d+[\.-_]\s*/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

// Helper to get GCS folder name - combines name + venue to match original sync format
const getGcsFolderName = (project) => {
  if (!project) return '';
  const name = project.name || '';
  const venue = project.venue || '';
  // If venue exists, combine with dash (matching original sync format)
  if (venue) {
    return `${name}-${venue}`.replace(/\s+/g, '_');
  }
  return name.replace(/\s+/g, '_');
};

export default function Vault({ project }) {
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [activePopup, setActivePopup] = useState(null);
  const [approvedDocs, setApprovedDocs] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [viewingFile, setViewingFile] = useState(null);

  const gcsFolderName = getGcsFolderName(project);

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
        body: JSON.stringify({ projectName: gcsFolderName, folderPath: '' })
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
    setLoadingDocs(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/latest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: gcsFolderName })
      });
      if (res.ok) {
        const data = await res.json();
        setApprovedDocs(data.approved || []);
        setRecentDocs(data.recent || []);
      } else {
        setApprovedDocs([]);
        setRecentDocs([]);
      }
    } catch (err) {
      console.error('Error loading docs:', err);
      setApprovedDocs([]);
      setRecentDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    violet: 'bg-violet-50 text-violet-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    orange: 'bg-orange-50 text-orange-600',
    sky: 'bg-sky-50 text-sky-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    teal: 'bg-teal-50 text-teal-600',
    pink: 'bg-pink-50 text-pink-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  const handleDocClick = (doc) => {
    const filePath = `${gcsFolderName}/${doc.path}`;
    setViewingFile({ name: doc.name, path: filePath });
  };

  const DocCard = ({ doc, isApproved }) => {
    const config = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.other;
    const subjectLabel = SUBJECT_LABELS[doc.subject] || doc.subject;
    
    return (
      <button
        onClick={() => handleDocClick(doc)}
        className={`flex-shrink-0 w-40 sm:w-48 p-2.5 sm:p-3 bg-white border rounded-xl hover:shadow-md transition-all text-left group ${
          isApproved ? 'border-green-200 hover:border-green-400' : 'border-slate-200 hover:border-blue-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <div className={`p-1 rounded ${colorClasses[config.color] || 'bg-slate-100 text-slate-500'}`}>
              <Icon name={config.icon} size={10} />
            </div>
            <span className="text-[8px] font-bold uppercase text-slate-500">{config.label}</span>
          </div>
          {doc.revisionStr && (
            <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-1 py-0.5 rounded">{doc.revisionStr}</span>
          )}
        </div>
        
        <p className="text-xs font-semibold text-slate-900 mb-0.5 capitalize truncate">{subjectLabel}</p>
        <p className="text-[9px] text-slate-500 truncate mb-1" title={doc.name}>{doc.name}</p>
        
        <div className="flex items-center justify-between text-[8px] text-slate-400">
          <span>{doc.updated ? new Date(doc.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
          <Icon name="chevron-right" size={10} className="text-slate-300 group-hover:text-blue-500" />
        </div>
      </button>
    );
  };

  const DocSection = ({ title, docs, isApproved, icon, emptyText }) => (
    <div className="mb-4 sm:mb-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <Icon name={icon} size={12} className={isApproved ? 'text-green-500' : 'text-blue-500'} />
        <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400">{title}</h3>
        <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{docs.length}</span>
      </div>
      {loadingDocs ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Icon name="loader-2" size={18} className="animate-spin text-slate-400 mx-auto" />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-[10px] text-slate-400">{emptyText}</p>
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
          <div className="flex gap-2 sm:gap-3 pb-2 w-max">
            {docs.map((doc, i) => <DocCard key={i} doc={doc} isApproved={isApproved} />)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-x-hidden overflow-y-auto no-scrollbar pb-40 sm:pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-0.5">Project Documents</h2>
          <p className="text-xs sm:text-sm text-slate-500">Browse and access all project files</p>
        </div>
        <div className="flex items-stretch gap-2">
          <button 
            onClick={() => { loadFolders(); loadLatestDocs(); }} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] sm:text-xs font-medium text-slate-600"
          >
            <Icon name="refresh-cw" size={12} />
            <span>Refresh</span>
          </button>
          <button 
            onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-[10px] sm:text-xs font-medium text-white"
          >
            <Icon name="external-link" size={12} />
            <span>Open Drive</span>
          </button>
        </div>
      </div>

      {/* Approved Documents */}
      <DocSection 
        title="Approved Drawings" 
        docs={approvedDocs} 
        isApproved={true}
        icon="check-circle"
        emptyText="No approved drawings yet"
      />

      {/* Recent Documents */}
      <DocSection 
        title="Recent Revisions" 
        docs={recentDocs} 
        isApproved={false}
        icon="clock"
        emptyText="No recent documents found"
      />

      {/* Folders Grid */}
      <div>
        <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2 sm:mb-3">All Folders</h3>
        {loadingFolders ? (
          <div className="flex items-center justify-center py-8"><Icon name="loader-2" size={20} className="animate-spin text-slate-400" /></div>
        ) : folders.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <Icon name="folder" size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No folders found</p>
            <p className="text-[10px] text-slate-400 mt-1">Sync your project to load folders</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {folders.map((folder, i) => {
              const style = getFolderStyle(folder.name);
              const displayName = cleanFolderName(folder.name);
              return (
                <button key={i} onClick={() => setActivePopup({ folder: folder.name, title: displayName })} className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorClasses[style.color]}`}>
                    <Icon name={style.icon} size={16} />
                  </div>
                  <p className="text-[10px] sm:text-xs font-medium text-slate-900 group-hover:text-blue-600 truncate">{displayName}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 truncate">{folder.name}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activePopup && <FolderPopup project={project} folder={activePopup.folder} title={activePopup.title} gcsFolderName={gcsFolderName} onClose={() => setActivePopup(null)} />}
      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}
