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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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

  const handleFileClick = (result) => {
    const viewUrl = getFileViewURL(result.link, SYNC_WORKER_URL);
    if (viewUrl) {
      window.open(viewUrl, '_blank');
    } else {
      // Fallback - show file info
      const { filename, folder } = parseGCSLink(result.link);
      alert(`File: ${filename}\nFolder: ${folder}\n\nDirect preview coming soon!`);
    }
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
      {/* Search header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">AI Search</h2>
        <p className="text-sm text-slate-500">Ask questions about your project documents</p>
      </div>

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
            {/* AI Summary - The main answer */}
            {summary && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white shrink-0">
                    <Icon name="sparkles" size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 mb-2">AI Answer</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                    
                    {/* Priority notice */}
                    {results.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-100">
                        <p className="text-[10px] text-blue-600">
                          <Icon name="info" size={10} className="inline mr-1" />
                          Based on {results.length} documents, sorted by authority (CVIs > MOMs > Approvals > Base docs)
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
                  Source Documents ({results.length})
                </p>
                <div className="space-y-2">
                  {results.map((result, i) => {
                    const { filename, folder } = parseGCSLink(result.link);
                    const parsed = parseFilename(filename);
                    
                    return (
                      <div 
                        key={result.id || i}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                        onClick={() => handleFileClick(result)}
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
                            </div>
                            <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                              {result.title || parsed.description || filename}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{folder}</p>
                            {parsed.initials && (
                              <p className="text-[10px] text-slate-400 mt-1">By: {parsed.initials}</p>
                            )}
                          </div>
                          <Icon name="external-link" size={14} className="text-slate-300 group-hover:text-blue-400 shrink-0" />
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
    </div>
  );
}
