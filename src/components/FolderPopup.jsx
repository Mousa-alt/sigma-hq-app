import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import { parseFilename, getFileIcon, detectDocumentType, getDocTypeInfo } from '../utils/documentUtils';

export default function FolderPopup({ project, folder, title, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadFiles();
  }, [folder]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectName: project.name.replace(/\s+/g, '_'),
          folderPath: folder
        })
      });
      
      if (!res.ok) throw new Error('Failed to load files');
      
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Error loading files:', err);
      setError('Could not load files from server');
      // Use demo files as fallback
      setFiles(getDemoFiles(folder));
    } finally {
      setLoading(false);
    }
  };

  const getDemoFiles = (folderPath) => {
    if (folderPath.includes('Contract')) {
      return [
        { name: '01_AGORA-GEM-Main_Contract-ADM-Rev_00.pdf', type: 'file', updated: '2025-12-15T10:00:00Z' },
        { name: '02_AGORA-GEM-Contract_Appendix_A-ADM-Rev_00.pdf', type: 'file', updated: '2025-12-15T10:00:00Z' },
        { name: '03_AGORA-GEM-Scope_of_Work-ADM-Rev_01.pdf', type: 'file', updated: '2025-12-20T14:30:00Z' },
      ];
    } else if (folderPath.includes('Invoice')) {
      return [
        { name: '15_AGORA-GEM-Invoice_015-FIN-Rev_00.pdf', type: 'file', updated: '2026-01-05T09:00:00Z' },
        { name: '14_AGORA-GEM-Invoice_014-FIN-Rev_00.pdf', type: 'file', updated: '2025-12-28T11:00:00Z' },
        { name: '13_AGORA-GEM-Invoice_013-FIN-Rev_00.pdf', type: 'file', updated: '2025-12-20T16:00:00Z' },
      ];
    } else if (folderPath.includes('Shop Drawings') || folderPath.includes('Approved')) {
      return [
        { name: '45_AGORA-GEM-Kitchen_Layout-MH-Rev_02.pdf', type: 'file', updated: '2026-01-03T14:00:00Z' },
        { name: '44_AGORA-GEM-Ceiling_Details-SB-Rev_01.pdf', type: 'file', updated: '2026-01-02T10:00:00Z' },
        { name: '43_AGORA-GEM-Flooring_Pattern-MH-Rev_00.pdf', type: 'file', updated: '2025-12-30T15:00:00Z' },
      ];
    } else if (folderPath.includes('MOM') || folderPath.includes('Correspondence')) {
      return [
        { name: 'MOM_2026_01_05-Weekly_Progress-Rev_00.pdf', type: 'file', updated: '2026-01-05T17:00:00Z' },
        { name: 'MOM_2025_12_29-Design_Review-Rev_00.pdf', type: 'file', updated: '2025-12-29T16:00:00Z' },
        { name: 'MOM_2025_12_22-Material_Selection-Rev_00.pdf', type: 'file', updated: '2025-12-22T15:00:00Z' },
      ];
    }
    return [
      { name: 'Document_01.pdf', type: 'file', updated: '2026-01-01T12:00:00Z' },
      { name: 'Document_02.pdf', type: 'file', updated: '2025-12-28T10:00:00Z' },
    ];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleFileClick = (file) => {
    if (file.type === 'folder') {
      // Could navigate into subfolder - for now just select
      setSelectedFile(file);
    } else {
      setSelectedFile(file);
    }
  };

  const handleOpenFile = (file) => {
    if (file.url) {
      // Real signed URL from backend
      window.open(file.url, '_blank');
    } else if (file.path) {
      // Try the /view endpoint
      const viewUrl = `${SYNC_WORKER_URL}/view?path=${encodeURIComponent(file.path)}`;
      window.open(viewUrl, '_blank');
    } else if (project?.driveLink) {
      // Fallback to Drive folder
      window.open(project.driveLink, '_blank');
    }
  };

  const getDocBadge = (filename) => {
    const docType = detectDocumentType(filename, folder);
    const typeInfo = getDocTypeInfo(docType);
    
    const colorClasses = {
      red: 'bg-red-100 text-red-700',
      purple: 'bg-purple-100 text-purple-700',
      emerald: 'bg-emerald-100 text-emerald-700',
      blue: 'bg-blue-100 text-blue-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      amber: 'bg-amber-100 text-amber-700',
      sky: 'bg-sky-100 text-sky-700',
      slate: 'bg-slate-100 text-slate-600',
    };
    
    return (
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase ${colorClasses[typeInfo.color] || colorClasses.slate}`}>
        {typeInfo.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Icon name="folder-open" size={18} className="text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">{folder}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Icon name="x" size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* File list */}
          <div className={`${selectedFile ? 'w-1/2 border-r border-slate-100' : 'w-full'} overflow-y-auto`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-slate-100" />
                  <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                </div>
              </div>
            ) : error && files.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="alert-circle" size={32} className="mx-auto mb-3 text-amber-400" />
                <p className="text-slate-500 text-sm">{error}</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="folder-open" size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 text-sm">No files found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {files.map((file, i) => {
                  const parsed = parseFilename(file.name);
                  const isFolder = file.type === 'folder';
                  
                  return (
                    <div
                      key={i}
                      onClick={() => handleFileClick(file)}
                      onDoubleClick={() => !isFolder && handleOpenFile(file)}
                      className={`flex items-center gap-3 p-4 hover:bg-slate-50 cursor-pointer transition-colors ${selectedFile?.name === file.name ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`p-2 rounded-lg ${isFolder ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'}`}>
                        <Icon name={isFolder ? 'folder' : getFileIcon(file.name)} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {!isFolder && getDocBadge(file.name)}
                          {parsed.revision && (
                            <span className="text-[9px] text-slate-400">Rev {parsed.revision}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {parsed.description || file.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatDate(file.updated)}
                          {parsed.initials && ` • By ${parsed.initials}`}
                        </p>
                      </div>
                      <Icon name="chevron-right" size={14} className="text-slate-300" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview pane */}
          {selectedFile && (
            <div className="w-1/2 p-4 bg-slate-50 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</h3>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                >
                  <Icon name="x" size={14} className="text-slate-400" />
                </button>
              </div>
              
              {/* File info */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                {(() => {
                  const parsed = parseFilename(selectedFile.name);
                  const docType = detectDocumentType(selectedFile.name, folder);
                  const typeInfo = getDocTypeInfo(docType);
                  
                  return (
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Document Type</p>
                        <p className="text-sm font-medium text-slate-900">{typeInfo.description}</p>
                      </div>
                      {parsed.serial && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Serial</p>
                          <p className="text-sm text-slate-900">{parsed.serial}</p>
                        </div>
                      )}
                      {parsed.revision && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Revision</p>
                          <p className="text-sm text-slate-900">Rev {parsed.revision}</p>
                        </div>
                      )}
                      {parsed.initials && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Author</p>
                          <p className="text-sm text-slate-900">{parsed.initials}</p>
                        </div>
                      )}
                      {parsed.date && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Date</p>
                          <p className="text-sm text-slate-900">{parsed.date}</p>
                        </div>
                      )}
                      {selectedFile.size && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Size</p>
                          <p className="text-sm text-slate-900">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              {/* Preview area */}
              <div className="flex-1 bg-white rounded-lg border border-slate-200 flex items-center justify-center min-h-[150px]">
                <div className="text-center p-6">
                  <Icon name={getFileIcon(selectedFile.name)} size={48} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500 mb-4">
                    {selectedFile.type === 'folder' ? 'Folder' : 'Click Open to view'}
                  </p>
                  {selectedFile.type !== 'folder' && (
                    <button 
                      onClick={() => handleOpenFile(selectedFile)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
                    >
                      Open File
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-xs text-slate-500">
            {files.filter(f => f.type === 'file').length} files
            {files.filter(f => f.type === 'folder').length > 0 && `, ${files.filter(f => f.type === 'folder').length} folders`}
          </span>
          <button 
            onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Icon name="external-link" size={12} />
            Open in Drive
          </button>
        </div>
      </div>
    </div>
  );
}
