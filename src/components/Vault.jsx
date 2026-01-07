import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

export default function Vault({ project }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (project) {
      loadFiles();
    }
  }, [project?.id]);

  const loadFiles = async (folderId = null) => {
    setLoading(true);
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectName: project.name.replace(/\s+/g, '_'),
          folderId
        })
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      // Demo files if API fails
      setFiles([
        { name: 'Contract Documents', type: 'folder', id: '1' },
        { name: 'Shop Drawings', type: 'folder', id: '2' },
        { name: 'Specifications', type: 'folder', id: '3' },
        { name: 'BOQ', type: 'folder', id: '4' },
        { name: 'Site Reports', type: 'folder', id: '5' },
        { name: 'Invoices', type: 'folder', id: '6' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const openFolder = (folder) => {
    setBreadcrumbs([...breadcrumbs, { name: folder.name, id: folder.id }]);
    setCurrentFolder(folder.id);
    loadFiles(folder.id);
  };

  const goBack = (index = -1) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setCurrentFolder(null);
      loadFiles();
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolder(newBreadcrumbs[newBreadcrumbs.length - 1]?.id || null);
      loadFiles(newBreadcrumbs[newBreadcrumbs.length - 1]?.id || null);
    }
  };

  const getFileIcon = (file) => {
    if (file.type === 'folder') return 'folder';
    const ext = file.name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'file-text';
    if (['doc', 'docx'].includes(ext)) return 'file-text';
    if (['xls', 'xlsx'].includes(ext)) return 'file-spreadsheet';
    if (['dwg', 'dxf'].includes(ext)) return 'file-code';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    return 'file';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Project Documents</h2>
          <p className="text-sm text-slate-500">Browse all synced files from Google Drive</p>
        </div>
        <button
          onClick={() => project?.driveLink && window.open(project.driveLink, '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
        >
          <Icon name="external-link" size={14} />
          Open in Drive
        </button>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button 
            onClick={() => goBack(-1)}
            className="text-blue-500 hover:underline"
          >
            Root
          </button>
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.id} className="flex items-center gap-2">
              <Icon name="chevron-right" size={12} className="text-slate-400" />
              <button 
                onClick={() => goBack(i)}
                className={i === breadcrumbs.length - 1 ? 'text-slate-900 font-medium' : 'text-blue-500 hover:underline'}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Files grid */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="loader-2" size={24} className="animate-spin text-slate-400" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="folder-open" size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 text-sm">No files in this folder</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {files.map((file, i) => (
              <div
                key={file.id || i}
                onClick={() => file.type === 'folder' ? openFolder(file) : window.open(file.url, '_blank')}
                className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                  file.type === 'folder' 
                    ? 'bg-amber-50 text-amber-500' 
                    : 'bg-blue-50 text-blue-500'
                }`}>
                  <Icon name={getFileIcon(file)} size={24} />
                </div>
                <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                  {file.name}
                </p>
                {file.modified && (
                  <p className="text-[10px] text-slate-400 mt-1">{file.modified}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
