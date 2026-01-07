import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import { parseFilename, getFileIcon, detectDocumentType, getDocTypeInfo } from '../utils/documentUtils';

export default function FolderPopup({ project, folder, title, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentPath, setCurrentPath] = useState(folder);
  const [pathHistory, setPathHistory] = useState([{ path: folder, title: title }]);

  const projectNameClean = project?.name?.replace(/\s+/g, '_') || '';

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath]);

  const loadFiles = async (folderPath) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectName: projectNameClean,
          folderPath: folderPath
        })
      });
      
      if (!res.ok) throw new Error('Failed to load files');
      
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Error loading files:', err);
      setError('Could not load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
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

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Extract relative folder path from full GCS path
  const getRelativePath = (fullPath) => {
    // fullPath might be like "AGORA_GEM/01.Contract_Documents/01.1_Main_Contract/"
    // We need just "01.Contract_Documents/01.1_Main_Contract"
    if (!fullPath) return '';
    
    // Remove trailing slash
    let path = fullPath.replace(/\/$/, '');
    
    // Remove project name prefix if present
    if (path.startsWith(projectNameClean + '/')) {
      path = path.substring(projectNameClean.length + 1);
    }
    
    return path;
  };

  const handleItemClick = (item) => {
    if (item.type === 'folder') {
      // Navigate into subfolder
      const relativePath = getRelativePath(item.path);
      const folderName = item.name;
      setPathHistory([...pathHistory, { path: relativePath, title: folderName }]);
      setCurrentPath(relativePath);
    } else {
      setSelectedFile(item);
    }
  };

  const handleDoubleClick = (item) => {
    if (item.type === 'folder') {
      handleItemClick(item);
    } else {
      handleOpenFile(item);
    }
  };

  const handleBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1);
      setPathHistory(newHistory);
      setCurrentPath(newHistory[newHistory.length - 1].path);
    }
  };

  const handleOpenFile = (file) => {
    if (file.url) {
      window.open(file.url, '_blank');
    } else if (file.path) {
      // file.path should be the full GCS path
      const viewUrl = `${SYNC_WORKER_URL}/view?path=${encodeURIComponent(file.path)}`;
      window.open(viewUrl, '_blank');
    }
  };

  const getDocBadge = (filename, path) => {
    const docType = detectDocumentType(filename, path || '');
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

  // Get current folder title from path history
  const currentTitle = pathHistory[pathHistory.length - 1]?.title || title;

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
            {pathHistory.length > 1 && (
              <button 
                onClick={handleBack}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Icon name="arrow-left" size={18} className="text-slate-600" />
              </button>
            )}
            <div className="p-2 bg-slate-100 rounded-lg">
              <Icon name="folder-open" size={18} className="text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{currentTitle}</h2>
              <p className="text-xs text-slate-500">{currentPath}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Icon name="x" size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Breadcrumb */}
        {pathHistory.length > 1 && (
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1 text-xs overflow-x-auto">
            {pathHistory.map((item, i) => (
              <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                {i > 0 && <Icon name="chevron-right" size={12} className="text-slate-400" />}
                <button 
                  onClick={() => {
                    const newHistory = pathHistory.slice(0, i + 1);
                    setPathHistory(newHistory);
                    setCurrentPath(item.path);
                  }}
                  className={`hover:text-blue-600 transition-colors ${i === pathHistory.length - 1 ? 'text-slate-900 font-medium' : 'text-slate-500'}`}
                >
                  {item.title}
                </button>
              </span>
            ))}
          </div>
        )}

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
            ) : error ? (
              <div className="text-center py-12">
                <Icon name="alert-circle" size={32} className="mx-auto mb-3 text-amber-400" />
                <p className="text-slate-500 text-sm">{error}</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="folder-open" size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 text-sm">This folder is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {files.map((item, i) => {
                  const isFolder = item.type === 'folder';
                  const parsed = isFolder ? null : parseFilename(item.name);
                  
                  return (
                    <div
                      key={i}
                      onClick={() => handleItemClick(item)}
                      onDoubleClick={() => handleDoubleClick(item)}
                      className={`flex items-center gap-3 p-4 hover:bg-slate-50 cursor-pointer transition-colors ${selectedFile?.name === item.name ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`p-2 rounded-lg ${isFolder ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'}`}>
                        <Icon name={isFolder ? 'folder' : getFileIcon(item.name)} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {!isFolder && (
                          <div className="flex items-center gap-2 mb-0.5">
                            {getDocBadge(item.name, item.path)}
                            {parsed?.revision && (
                              <span className="text-[9px] text-slate-400">Rev {parsed.revision}</span>
                            )}
                          </div>
                        )}
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {isFolder ? item.name : (parsed?.description || item.name)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {isFolder ? 'Click to open folder' : (
                            <>
                              {formatDate(item.updated)}
                              {item.size && ` • ${formatSize(item.size)}`}
                              {parsed?.initials && ` • By ${parsed.initials}`}
                            </>
                          )}
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
              <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 flex-1 overflow-y-auto">
                {(() => {
                  const parsed = parseFilename(selectedFile.name);
                  const docType = detectDocumentType(selectedFile.name, selectedFile.path || '');
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
                          <p className="text-sm text-slate-900">{formatSize(selectedFile.size)}</p>
                        </div>
                      )}
                      {selectedFile.updated && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Modified</p>
                          <p className="text-sm text-slate-900">{formatDate(selectedFile.updated)}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              {/* Open button */}
              <button 
                onClick={() => handleOpenFile(selectedFile)}
                className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="external-link" size={16} />
                Open File
              </button>
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
