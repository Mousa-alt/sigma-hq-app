import { useState } from 'react';
import Icon from '../Icon';
import FolderPopup from '../FolderPopup';

const QUICK_LINKS = [
  { id: 'contract', label: 'Contract', icon: 'file-text', color: 'blue', folder: '01.Contract_Documents' },
  { id: 'invoices', label: 'Invoices', icon: 'receipt', color: 'emerald', folder: '01.Contract_Documents/01.4_Invoices' },
  { id: 'shop-drawings', label: 'Shop Drawings', icon: 'ruler', color: 'purple', folder: '04.Shop_Drawings' },
  { id: 'drive', label: 'Open Drive', icon: 'external-link', color: 'orange', folder: null },
];

const COLOR_CLASSES = {
  blue: 'hover:border-blue-300 hover:bg-blue-50 text-blue-500',
  emerald: 'hover:border-emerald-300 hover:bg-emerald-50 text-emerald-500',
  purple: 'hover:border-purple-300 hover:bg-purple-50 text-purple-500',
  orange: 'hover:border-orange-300 hover:bg-orange-50 text-orange-500',
};

/**
 * Quick links to common folders
 */
export default function QuickLinks({ project }) {
  const [activePopup, setActivePopup] = useState(null);

  const handleQuickLink = (link) => {
    if (link.folder === null) {
      project?.driveLink && window.open(project.driveLink, '_blank');
    } else {
      setActivePopup(link);
    }
  };

  return (
    <div>
      <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2 sm:mb-3">
        Quick Links
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_LINKS.map(link => (
          <button 
            key={link.id} 
            onClick={() => handleQuickLink(link)} 
            className={`flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl transition-all group ${COLOR_CLASSES[link.color]}`}
          >
            <Icon name={link.icon} size={14} className={COLOR_CLASSES[link.color].split(' ').pop()} />
            <span className="text-[10px] sm:text-xs font-medium text-slate-700">{link.label}</span>
          </button>
        ))}
      </div>

      {activePopup && (
        <FolderPopup 
          project={project} 
          folder={activePopup.folder} 
          title={activePopup.label} 
          onClose={() => setActivePopup(null)} 
        />
      )}
    </div>
  );
}
