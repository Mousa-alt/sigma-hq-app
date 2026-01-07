import { useState } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import FileViewer from './FileViewer';

// Document type colors
const DOC_TYPE_COLORS = {
  cvi: 'bg-red-100 text-red-700',
  vo: 'bg-red-100 text-red-700',
  approval: 'bg-emerald-100 text-emerald-700',
  shop_drawing: 'bg-purple-100 text-purple-700',
  rfi: 'bg-blue-100 text-blue-700',
  mom: 'bg-indigo-100 text-indigo-700',
  submittal: 'bg-amber-100 text-amber-700',
  specification: 'bg-violet-100 text-violet-700',
  boq: 'bg-emerald-100 text-emerald-700',
  contract: 'bg-blue-100 text-blue-700',
  correspondence: 'bg-sky-100 text-sky-700',
  report: 'bg-amber-100 text-amber-700',
  drawing: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-600',
};

export default function AIChat({ project }) {
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  
  // Compare mode
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [comparison, setComparison] = useState('');
  const [comparing, setComparing] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    
    setLoading(true);
    setSearched(true);
    setSummary('');
    setResults([]);
    
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query.trim(), 
          projectName: project.name.replace(/\s+/g, '_') 
        })
      });
      const data = await res.json();
      setSummary(data.summary || '');
      setResults(data.results || []);
    } catch (err) {
      setSummary('Error connecting to search. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!file1 || !file2 || comparing) return;
    setComparing(true);
    setComparison('');
    
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file1: file1.path, file2: file2.path })
      });
      const data = await res.json();
      setComparison(data.comparison || data.error || 'No comparison available');
    } catch (err) {
      setComparison('Error comparing files. Please try again.');
    } finally {
      setComparing(false);
    }
  };

  const handleFileClick = (result) => {
    // Extract path from gs:// link
    let filePath = result.link;
    if (filePath.startsWith('gs://')) {
      filePath = filePath.replace(/^gs:\/\/[^\/]+\//, '');
    }
    setViewingFile({ name: result.title, path: filePath });
  };

  const handleSelectForCompare = (result, slot) => {
    let filePath = result.link;
    if (filePath.startsWith('gs://')) {
      filePath = filePath.replace(/^gs:\/\/[^\/]+\//, '');
    }
    const fileData = { name: result.title, path: filePath };
    if (slot === 1) setFile1(fileData);
    else setFile2(fileData);
    if ((slot === 1 && file2) || (slot === 2 && file1)) setMode('compare');
  };

  const getDocTypeBadge = (result) => {
    const docType = result.docType || 'other';
    const label = result.docTypeLabel || 'Document';
    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${DOC_TYPE_COLORS[docType] || DOC_TYPE_COLORS.other}`}>
        {label}
      </span>
    );
  };

  // Parse markdown-like summary into sections
  const renderSummary = (text) => {
    if (!text) return null;
    
    const sections = text.split(/##\s+/).filter(Boolean);
    
    return (
      <div className="space-y-4">
        {sections.map((section, i) => {
          const lines = section.trim().split('\n');
          const title = lines[0];
          const content = lines.slice(1).join('\n').trim();
          
          if (i === 0 && !text.startsWith('##')) {
            // First section without header
            return <p key={i} className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{section}</p>;
          }
          
          return (
            <div key={i}>
              <h4 className="text-xs font-semibold text-slate-900 mb-2">{title}</h4>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{content}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">AI Search</h2>
          <p className="text-sm text-slate-500">
            {mode === 'search' ? `Search documents in ${project?.name || 'this project'}` : 'Compare two document revisions'}
          </p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button onClick={() => setMode('search')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'search' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
            <Icon name="search" size={12} className="inline mr-1" />Search
          </button>
          <button onClick={() => setMode('compare')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'compare' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
            <Icon name="git-compare" size={12} className="inline mr-1" />Compare
          </button>
        </div>
      </div>

      {mode === 'search' ? (
        <>
          {/* Search Input */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <Icon name="sparkles" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What marble is approved? Show me the latest invoice..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-24 py-4 text-sm outline-none focus:border-blue-300 focus:bg-white transition-all"
              />
              <button type="submit" disabled={loading || !query.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-xs font-medium disabled:opacity-30">
                {loading ? 'Searching...' : 'Ask AI'}
              </button>
            </div>
          </form>

          {/* Quick Searches */}
          {!searched && (
            <div className="mb-6">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">Try asking</p>
              <div className="flex flex-wrap gap-2">
                {['What marble is approved?', 'Show me latest invoices', 'Kitchen shop drawings', 'Recent meeting minutes'].map(term => (
                  <button key={term} onClick={() => setQuery(term)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600">{term}</button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-500 mt-4">Searching {project?.name}...</p>
              </div>
            ) : searched ? (
              <div className="space-y-6">
                {/* AI Summary */}
                {summary && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white shrink-0">
                        <Icon name="sparkles" size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 mb-3">AI Answer</p>
                        {renderSummary(summary)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Source Documents */}
                {results.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">Sources ({results.length}) - sorted by authority</p>
                    <div className="space-y-2">
                      {results.map((result, i) => {
                        const isSelected1 = file1?.path === result.link;
                        const isSelected2 = file2?.path === result.link;
                        return (
                          <div key={result.id || i} className={`p-3 bg-white border rounded-xl hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group ${isSelected1 ? 'border-purple-400 bg-purple-50' : isSelected2 ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}`}>
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500">
                                <Icon name="file-text" size={16} />
                              </div>
                              <div className="flex-1 min-w-0" onClick={() => handleFileClick(result)}>
                                <div className="flex items-center gap-2 mb-1">
                                  {getDocTypeBadge(result)}
                                  {result.priority && <span className="text-[9px] text-slate-400">Priority: {result.priority}</span>}
                                  {isSelected1 && <span className="text-[9px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded">File 1</span>}
                                  {isSelected2 && <span className="text-[9px] bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded">File 2</span>}
                                </div>
                                <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">{result.title}</p>
                                {result.snippets?.[0] && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{result.snippets[0]}</p>}
                              </div>
                              <div className="flex flex-col gap-1">
                                <button onClick={(e) => { e.stopPropagation(); handleSelectForCompare(result, 1); }} className={`p-1 rounded text-[8px] ${isSelected1 ? 'bg-purple-500 text-white' : 'bg-slate-100 hover:bg-purple-100'}`} title="Set as File 1">1</button>
                                <button onClick={(e) => { e.stopPropagation(); handleSelectForCompare(result, 2); }} className={`p-1 rounded text-[8px] ${isSelected2 ? 'bg-emerald-500 text-white' : 'bg-slate-100 hover:bg-emerald-100'}`} title="Set as File 2">2</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!summary && results.length === 0 && (
                  <div className="text-center py-12">
                    <Icon name="search-x" size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 text-sm">No results found for "{query}"</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        /* Compare Mode */
        <div className="flex-1 flex flex-col">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`p-4 border-2 border-dashed rounded-xl ${file1 ? 'border-purple-300 bg-purple-50' : 'border-slate-200'}`}>
              <p className="text-[10px] font-medium uppercase text-purple-600 mb-2">Older Version</p>
              {file1 ? (
                <div className="flex items-center gap-2">
                  <Icon name="file-text" size={16} className="text-purple-500" />
                  <p className="text-sm text-slate-900 truncate flex-1">{file1.name}</p>
                  <button onClick={() => setFile1(null)} className="text-slate-400 hover:text-red-500"><Icon name="x" size={14} /></button>
                </div>
              ) : <p className="text-sm text-slate-400">Search and select Rev 4 (or older)</p>}
            </div>
            <div className={`p-4 border-2 border-dashed rounded-xl ${file2 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
              <p className="text-[10px] font-medium uppercase text-emerald-600 mb-2">Newer Version</p>
              {file2 ? (
                <div className="flex items-center gap-2">
                  <Icon name="file-text" size={16} className="text-emerald-500" />
                  <p className="text-sm text-slate-900 truncate flex-1">{file2.name}</p>
                  <button onClick={() => setFile2(null)} className="text-slate-400 hover:text-red-500"><Icon name="x" size={14} /></button>
                </div>
              ) : <p className="text-sm text-slate-400">Search and select Rev 5 (or newer)</p>}
            </div>
          </div>

          <button onClick={handleCompare} disabled={!file1 || !file2 || comparing} className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-30 mb-6">
            {comparing ? <><Icon name="loader-2" size={16} className="inline animate-spin mr-2" />Analyzing...</> : <><Icon name="git-compare" size={16} className="inline mr-2" />Compare Revisions</>}
          </button>

          {comparison && (
            <div className="flex-1 bg-gradient-to-br from-purple-50 to-emerald-50 border border-purple-100 rounded-xl p-5 overflow-y-auto">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-lg text-white shrink-0"><Icon name="git-compare" size={16} /></div>
                <div className="flex-1">
                  <p className="text-[10px] font-medium uppercase text-purple-600 mb-2">Changes Detected</p>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{comparison}</div>
                </div>
              </div>
            </div>
          )}

          {comparing && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500 mt-4">AI is analyzing both documents...</p>
            </div>
          )}
        </div>
      )}

      {/* File Viewer */}
      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}
