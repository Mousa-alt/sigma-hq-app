import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

// Inline file viewer modal - opens files inside the dashboard
export default function FileViewer({ file, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (!file) return null;

  const fileName = file.name || 'Document';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Build the view URL
  const viewUrl = file.path 
    ? `${SYNC_WORKER_URL}/view?path=${encodeURIComponent(file.path)}`
    : file.url;

  // Determine if file can be previewed inline
  const canPreview = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'html', 'htm'].includes(ext);
  const isOffice = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext);

  // For Office files, use Google Docs viewer
  const getPreviewUrl = () => {
    if (isOffice && viewUrl) {
      // Use Google Docs viewer for Office files
      return `https://docs.google.com/viewer?url=${encodeURIComponent(viewUrl)}&embedded=true`;
    }
    return viewUrl;
  };

  const handleDownload = () => {
    if (viewUrl) {
      const link = document.createElement('a');
      link.href = viewUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenExternal = () => {
    if (viewUrl) {
      window.open(viewUrl, '_blank');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-500">
              <Icon name="file-text" size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 truncate">{fileName}</h2>
              <p className="text-[10px] text-slate-500 uppercase">{ext} file</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 transition-colors"
            >
              <Icon name="download" size={14} />
              Download
            </button>
            <button
              onClick={handleOpenExternal}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 transition-colors"
            >
              <Icon name="external-link" size={14} />
              Open External
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Icon name="x" size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden">
          {canPreview || isOffice ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                  <div className="text-center">
                    <Icon name="loader-2" size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Loading preview...</p>
                  </div>
                </div>
              )}
              <iframe
                src={getPreviewUrl()}
                className="w-full h-full border-0"
                title={fileName}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Could not load preview');
                }}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="p-6 bg-white rounded-2xl shadow-lg text-center max-w-md">
                <Icon name="file" size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Preview not available</h3>
                <p className="text-sm text-slate-500 mb-4">
                  This file type (.{ext}) cannot be previewed in the browser.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Icon name="download" size={16} />
                    Download File
                  </button>
                  <button
                    onClick={handleOpenExternal}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Icon name="external-link" size={16} />
                    Open External
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="text-center">
                <Icon name="alert-circle" size={32} className="mx-auto mb-3 text-amber-500" />
                <p className="text-sm text-slate-500">{error}</p>
                <button
                  onClick={handleOpenExternal}
                  className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Open in New Tab
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
