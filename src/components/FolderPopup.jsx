import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

export default function FolderPopup({ project, folder, title, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadFiles();
  }, [folder]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectName: project.name.replace(/\s+/g, '_'),
          folderPath: folder
        })
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      // Demo files based on folder type
      const demoFiles = getDemoFiles(folder);
      setFiles(demoFiles);
    } finally {
      setLoading(false);
    }
  };

  const getDemoFiles = (folderPath) => {
    if (folderPath.includes('Contract')) {
      return [
        { name: '01_AGORA-CAI-Main_Contract-ADM-Rev_00.pdf', type: 'file', date: 'Dec 15, 2025' },
        { name: '02_AGORA-CAI-Contract_Appendix_A-ADM-Rev_00.pdf', type: 'file', date: 'Dec 15, 2025' },
        { name: '03_AGORA-CAI-Scope_of_Work-ADM-Rev_01.pdf', type: 'file', date: 'Dec 20, 2025' },
      ];
    } else if (folderPath.includes('Invoices')) {
      return [
        { name: '15_AGORA-CAI-Invoice_015-FIN-Rev_00.pdf', type: 'file', date: 'Jan 5, 2026' },
        { name: '14_AGORA-CAI-Invoice_014-FIN-Rev_00.pdf', type: 'file', date: 'Dec 28, 2025' },
        { name: '13_AGORA-CAI-Invoice_013-FIN-Rev_00.pdf', type: 'file', date: 'Dec 20, 2025' },
      ];
    } else if (folderPath.includes('Shop Drawings')) {
      return [
        { name: '45_AGORA-CAI-Kitchen_Layout-MH-Rev_02.pdf', type: 'file', date: 'Jan 3, 2026' },
        { name: '44_AGORA-CAI-Ceiling_Details-SB-Rev_01.pdf', type: 'file', date: 'Jan 2, 2026' },
        { name: '43_AGORA-CAI-Flooring_Pattern-MH-Rev_00.pdf', type: 'file', date: 'Dec 30, 2025' },
      ];
    }
    return [
      { name: 'Document_01.pdf', type: 'file', date: 'Jan 1, 2026' },
      { name: 'Document_02.pdf', type: 'file', date: 'Dec 28, 2025' },
    ];
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'file-text';
    if (['doc', 'docx'].includes(ext)) return 'file-text';
    if (['xls', 'xlsx'].includes(ext)) return 'file-spreadsheet';
    if (['dwg', 'dxf'].includes(ext)) return 'file-code';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    return 'file';
  };

  const handleFileClick = (file) => {
    if (file.url) {
      // If we have a URL, open preview or external
      setSelectedFile(file);
    } else {
      // Demo mode - show preview placeholder
      setSelectedFile(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-in flex flex-col"
        onClick={e => e.stopPropagation()}
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
        <div className="flex-1 overflow-hidden flex">
          {/* File list */}
          <div className={`${selectedFile ? 'w-1/2 border-r border-slate-100' : 'w-full'} overflow-y-auto`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="loader-2" size={24} className="animate-spin text-slate-400" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="folder-open" size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 text-sm">No files found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {files.map((file, i) => (
                  <div
                    key={i}
                    onClick={() => handleFileClick(file)}
                    className={`flex items-center gap-3 p-4 hover:bg-slate-50 cursor-pointer transition-colors ${selectedFile?.name === file.name ? 'bg-blue-50' : ''}`}
                  >
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                      <Icon name={getFileIcon(file.name)} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-400">{file.date}</p>
                    </div>
                    <Icon name="chevron-right" size={14} className="text-slate-300" />
                  </div>
                ))}
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
              
              {/* Preview area */}
              <div className="flex-1 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                <div className="text-center p-6">
                  <Icon name="file-text" size={48} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500 mb-4">Preview not available</p>
                  <button 
                    onClick={() => selectedFile.url ? window.open(selectedFile.url, '_blank') : null}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
                  >
                    Open in Drive
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-xs text-slate-500">{files.length} files</span>
          <button 
            onClick={() => project?.driveLink && window.open(project.driveLink + '/' + folder.replace(/ /g, '%20'), '_blank')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Icon name="external-link" size={12} />
            Open folder in Drive
          </button>
        </div>
      </div>
    </div>
  );
}
