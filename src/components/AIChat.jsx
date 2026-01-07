import { useState } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import { 
  parseGCSLink, 
  parseFilename, 
  detectDocumentType, 
  getDocTypeInfo, 
  getFileIcon,
  sortByHierarchy,
  getFileViewURL 
} from '../utils/documentUtils';

export default function AIChat({ project }) {
  const [mode, setMode] = useState('search'); // 'search' or 'compare'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // Compare mode state
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
      
      // Sort results by document hierarchy
      const sortedResults = sortByHierarchy(data.results || []);
      setResults(sortedResults);
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
        body: JSON.stringify({ 
          file1: file1.path,
          file2: file2.path,
          projectName: project.name.replace(/\s+/g, '_')
        })
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
    const viewUrl = getFileViewURL(result.link, SYNC_WORKER_URL);
    if (viewUrl) {
      window.open(viewUrl, '_blank');
    } else {
      const { filename, folder } = parseGCSLink(result.link);
      alert(`File: ${filename}\nFolder: ${folder}\n\nDirect preview coming soon!`);
    }
  };

  // Select file for comparison from search results
  const handleSelectForCompare = (result, slot) => {
    const { filename } = parseGCSLink(result.link);
    const fileData = {
      name: filename,
      path: result.link,
      title: result.title || filename
    };
    
    if (slot === 1) {
      setFile1(fileData);
    } else {
      setFile2(fileData);
    }
    
    // Auto-switch to compare mode if both files selected
    if ((slot === 1 && file2) || (slot === 2 && file1)) {
      setMode('compare');
    }
  };

  const handleFileDrop = (e, slot) => {
    e.preventDefault();
    // Future: handle drag & drop from folder browser
  };

  const getDocTypeBadge = (result) => {
    const { filename } = parseGCSLink(result.link);
    const docType = detectDocumentType(filename, result.link);
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
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${colorClasses[typeInfo.color] || colorClasses.slate}`}>
        {typeInfo.label}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with mode toggle */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">AI Search</h2>
          <p className="text-sm text-slate-500">
            {mode === 'search' ? 'Ask questions about your project documents' : 'Compare two document revisions'}
          </p>
        </div>
        
        {/* Mode toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setMode('search')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'search' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon name="search" size={12} className="inline mr-1" />
            Search
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'compare' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon name="git-compare" size={12} className="inline mr-1" />
            Compare
          </button>
        </div>
      </div>

      {mode === 'search' ? (
        <>
          {/* Search input */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <Icon name="sparkles" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What marble is approved? Show me the latest invoice..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-24 py-4 text-sm outline-none focus:border-blue-300 focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-xs font-medium disabled:opacity-30 transition-opacity"
              >
                {loading ? 'Searching...' : 'Ask AI'}
              </button>
            </div>
          </form>

          {/* Quick searches */}
          {!searched && (
            <div className="mb-6">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">Try asking</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'What marble is approved?',
                  'Show me latest invoices',
                  'Kitchen shop drawings',
                  'Recent meeting minutes',
                  'What materials are pending?'
                ].map(term => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-blue-100" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-slate-500 mt-4">Searching across all project documents...</p>
                <p className="text-xs text-slate-400 mt-1">Analyzing BOQs, drawings, correspondence, samples...</p>
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
                        <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 mb-2">AI Answer</p>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                        
                        {results.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-100">
                            <p className="text-[10px] text-blue-600">
                              <Icon name="info" size={10} className="inline mr-1" />
                              Based on {results.length} documents, sorted by authority (CVIs &gt; MOMs &gt; Approvals &gt; Base docs)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Source documents */}
                {results.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">
                      Source Documents ({results.length}) - Click to open, right-click to compare
                    </p>
                    <div className="space-y-2">
                      {results.map((result, i) => {
                        const { filename, folder } = parseGCSLink(result.link);
                        const parsed = parseFilename(filename);
                        const isSelected1 = file1?.path === result.link;
                        const isSelected2 = file2?.path === result.link;
                        
                        return (
                          <div 
                            key={result.id || i}
                            className={`p-3 bg-white border rounded-xl hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group ${
                              isSelected1 ? 'border-purple-400 bg-purple-50' : 
                              isSelected2 ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'
                            }`}
                            onClick={() => handleFileClick(result)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              handleSelectForCompare(result, file1 ? 2 : 1);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                <Icon name={getFileIcon(filename)} size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {getDocTypeBadge(result)}
                                  {parsed.revision && (
                                    <span className="text-[9px] text-slate-400">Rev {parsed.revision}</span>
                                  )}
                                  {parsed.date && (
                                    <span className="text-[9px] text-slate-400">{parsed.date}</span>
                                  )}
                                  {isSelected1 && (
                                    <span className="text-[9px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded">File 1</span>
                                  )}
                                  {isSelected2 && (
                                    <span className="text-[9px] bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded">File 2</span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                  {result.title || parsed.description || filename}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{folder}</p>
                                {parsed.initials && (
                                  <p className="text-[10px] text-slate-400 mt-1">By: {parsed.initials}</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSelectForCompare(result, 1); }}
                                  className={`p-1 rounded text-[8px] transition-colors ${
                                    isSelected1 ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-600'
                                  }`}
                                  title="Set as File 1 for comparison"
                                >
                                  1
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSelectForCompare(result, 2); }}
                                  className={`p-1 rounded text-[8px] transition-colors ${
                                    isSelected2 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600'
                                  }`}
                                  title="Set as File 2 for comparison"
                                >
                                  2
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No results */}
                {!summary && results.length === 0 && (
                  <div className="text-center py-12">
                    <Icon name="search-x" size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 text-sm">No results found for "{query}"</p>
                    <p className="text-slate-400 text-xs mt-1">Try different keywords or check the spelling</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        /* Compare Mode */
        <div className="flex-1 flex flex-col">
          {/* File selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* File 1 */}
            <div 
              className={`p-4 border-2 border-dashed rounded-xl transition-all ${
                file1 ? 'border-purple-300 bg-purple-50' : 'border-slate-200 hover:border-purple-300'
              }`}
              onDrop={(e) => handleFileDrop(e, 1)}
              onDragOver={(e) => e.preventDefault()}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-purple-600 mb-2">Older Version</p>
              {file1 ? (
                <div className="flex items-center gap-2">
                  <Icon name="file-text" size={16} className="text-purple-500" />
                  <p className="text-sm text-slate-900 truncate flex-1">{file1.name}</p>
                  <button onClick={() => setFile1(null)} className="text-slate-400 hover:text-red-500">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Search and select Rev 4 (or older)</p>
              )}
            </div>
            
            {/* File 2 */}
            <div 
              className={`p-4 border-2 border-dashed rounded-xl transition-all ${
                file2 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'
              }`}
              onDrop={(e) => handleFileDrop(e, 2)}
              onDragOver={(e) => e.preventDefault()}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600 mb-2">Newer Version</p>
              {file2 ? (
                <div className="flex items-center gap-2">
                  <Icon name="file-text" size={16} className="text-emerald-500" />
                  <p className="text-sm text-slate-900 truncate flex-1">{file2.name}</p>
                  <button onClick={() => setFile2(null)} className="text-slate-400 hover:text-red-500">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Search and select Rev 5 (or newer)</p>
              )}
            </div>
          </div>

          {/* Compare button */}
          <button
            onClick={handleCompare}
            disabled={!file1 || !file2 || comparing}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-30 transition-all hover:shadow-lg disabled:hover:shadow-none mb-6"
          >
            {comparing ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="loader-2" size={16} className="animate-spin" />
                Analyzing differences with AI...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Icon name="git-compare" size={16} />
                Compare Revisions
              </span>
            )}
          </button>

          {/* Instructions */}
          {!comparison && !comparing && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">How to compare</p>
              <ol className="text-sm text-slate-600 space-y-1">
                <li>1. Switch to Search tab and find documents</li>
                <li>2. Click the <span className="bg-purple-100 text-purple-700 px-1 rounded">1</span> button on the older revision</li>
                <li>3. Click the <span className="bg-emerald-100 text-emerald-700 px-1 rounded">2</span> button on the newer revision</li>
                <li>4. Come back here and click Compare</li>
              </ol>
            </div>
          )}

          {/* Comparison results */}
          {comparison && (
            <div className="flex-1 bg-gradient-to-br from-purple-50 to-emerald-50 border border-purple-100 rounded-xl p-5 overflow-y-auto">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-lg text-white shrink-0">
                  <Icon name="git-compare" size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-purple-600 mb-2">Changes Detected</p>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{comparison}</div>
                </div>
              </div>
            </div>
          )}

          {comparing && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-purple-100" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-slate-500 mt-4">AI is analyzing both documents...</p>
              <p className="text-xs text-slate-400 mt-1">Looking for layout changes, specification updates, added/removed elements</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
