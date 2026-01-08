import Icon from './Icon';
import { COLORS } from '../config';

export default function Header({ 
  view, 
  selectedProject, 
  syncing,
  lastSyncTime,
  onOpenSidebar, 
  onGoBack, 
  onSyncNow, 
  onOpenModal 
}) {
  const getTitle = () => {
    switch (view) {
      case 'overview': return 'Projects';
      case 'whatsapp': return 'WhatsApp Integration';
      case 'project': return selectedProject?.name;
      default: return 'Sigma HQ';
    }
  };

  const getSubtitle = () => {
    if (view === 'project' && selectedProject?.location) {
      return selectedProject.location;
    }
    if (view === 'whatsapp') {
      return 'Configure groups and message processing';
    }
    return null;
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenSidebar} 
          className="lg:hidden p-2 bg-slate-50 rounded-lg text-slate-600"
        >
          <Icon name="menu" size={20} />
        </button>
        
        {(view === 'project' || view === 'whatsapp') && (
          <button 
            onClick={onGoBack} 
            className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Icon name="arrow-left" size={18} />
          </button>
        )}
        
        <div className="truncate">
          <div className="flex items-center gap-2">
            {view === 'whatsapp' && (
              <Icon name="message-circle" size={20} className="text-green-500" />
            )}
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {getTitle()}
            </h1>
          </div>
          {getSubtitle() && (
            <p className="text-xs text-slate-400 flex items-center gap-1">
              {view === 'project' && <Icon name="map-pin" size={10} />}
              {getSubtitle()}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={onOpenModal} 
          className="p-2.5 text-white rounded-lg shadow-lg active:scale-95 transition-all" 
          style={{ backgroundColor: COLORS.navy }}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </header>
  );
}
