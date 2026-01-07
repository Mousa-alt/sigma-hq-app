import { useState } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

export default function AIChat({ project }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    
    setLoading(true);
    setSearched(true);
    
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
      setResults(data.results || []);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Search Documents</h2>
        <p className="text-sm text-slate-500">Find files, drawings, and documents in this project</p>
      </div>

      {/* Search input */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for flooring drawings, invoices, specifications..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-24 py-4 text-sm outline-none focus:border-blue-300 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-30 transition-opacity"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Quick searches */}
      {!searched && (
        <div className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">Quick Searches</p>
          <div className="flex flex-wrap gap-2">
            {['Shop Drawings', 'Invoices', 'Specifications', 'BOQ', 'RFI'].map(term => (
              <button
                key={term}
                onClick={() => { setQuery(term); }}
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
          <div className="flex items-center justify-center py-12">
            <Icon name="loader-2" size={24} className="animate-spin text-slate-400" />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="search-x" size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 text-sm">No documents found for "{query}"</p>
            <p className="text-slate-400 text-xs mt-1">Try different keywords or check the spelling</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            {results.map((result, i) => (
              <div 
                key={i}
                className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                    <Icon name="file-text" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-900 truncate">{result.title}</h4>
                    {result.snippets && result.snippets[0] && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{result.snippets[0]}</p>
                    )}
                  </div>
                  <Icon name="external-link" size={14} className="text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
