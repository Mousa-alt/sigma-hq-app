import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import FolderPopup from './FolderPopup';

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
  { id: 'mom', label: 'Minutes of Meeting', folder: '07-Correspondence/MOM', icon: 'users', color: 'blue' },
  { id: 'progress', label: 'Progress Reports', folder: '06-Site Reports/Progress', icon: 'trending-up', color: 'purple' },
  { id: 'invoices', label: 'Latest Invoices', folder: '05-Quantity Surveying/Invoices', icon: 'receipt', color: 'amber' },
];

export default function Vault({ project }) {
  const [loading, setLoading] = useState(false);
  const [activePopup, setActivePopup] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);

  useEffect(() => {
    if (project) {
      loadRecentFiles();
    }
  }, [project?.id]);

  const loadRecentFiles = async () => {
    // In future, this would fetch recently modified files
    setRecentFiles([
      { name: '45_AGORA-CAI-Kitchen_Layout-MH-Rev_02.pdf', folder: 'Shop Drawings', date: '2 hours ago' },
      { name: '15_AGORA-CAI-Invoice_015-FIN-Rev_00.pdf', folder: 'Invoices', date: '5 hours ago' },
      { name: 'MOM_2026_01_05.pdf', folder: 'Correspondence', date: 'Yesterday' },
    ]);
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-500 border-blue-200',
      indigo: 'bg-indigo-50 text-indigo-500 border-indigo-200',
      violet: 'bg-violet-50 text-violet-500 border-violet-200',
      purple: 'bg-purple-50 text-purple-500 border-purple-200',
      emerald: 'bg-emerald-50 text-emerald-500 border-emerald-200',
      amber: 'bg-amber-50 text-amber-500 border-amber-200',
      sky: 'bg-sky-50 text-sky-500 border-sky-200',
      green: 'bg-green-50 text-green-500 border-green-200',
      red: 'bg-red-50 text-red-500 border-red-200',
      teal: 'bg-teal-50 text-teal-500 border-teal-200',
      pink: 'bg-pink-50 text-pink-500 border-pink-200',
      slate: 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return colors[color] || colors.slate;
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Project Documents</h2>
          <p className="text-sm text-slate-500">Quick access to key folders and recent files</p>
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
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">Recently Modified</h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {recentFiles.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
            >
              <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                <Icon name="file-text" size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400">{file.folder} • {file.date}</p>
              </div>
              <Icon name="chevron-right" size={14} className="text-slate-300" />
            </div>
          ))}
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
