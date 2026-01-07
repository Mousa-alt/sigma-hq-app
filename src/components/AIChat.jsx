import { useState } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

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
      setResults(data.results || []);
    } catch (err) {
      setSummary('Error connecting to search. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Convert GCS path to a more readable format and extract filename
  const parseGCSLink = (gcsLink) => {
    if (!gcsLink) return { path: '', filename: 'Unknown' };
    // gs://sigma-docs-repository/Agora-GEM/01.Contract_Documents/...
    const path = gcsLink.replace('gs://sigma-docs-repository/', '');
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const folder = parts.slice(1, -1).join(' > ');
    return { path, filename, folder };
  };

  // Get file icon based on extension
  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'file-text';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'file-spreadsheet';
    if (['doc', 'docx'].includes(ext)) return 'file-text';
    if (['dwg', 'dxf'].includes(ext)) return 'file-code';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    return 'file';
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
          <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What marble is approved? Show me the latest invoice..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-24 py-4 text-sm outline-none focus:border-blue-300 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-30 transition-opacity"
          >
            {loading ? 'Searching...' : 'Ask'}
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
              'Show me invoices',
              'Latest shop drawings',
              'Meeting minutes',
              'Material specifications'
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
            <Icon name="loader-2" size={24} className="animate-spin text-slate-400 mb-3" />
            <p className="text-sm text-slate-500">Searching project documents...</p>
          </div>
        ) : searched ? (
          <div className="space-y-6">
            {/* AI Summary - The main answer */}
            {summary && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg text-white shrink-0">
                    <Icon name="sparkles" size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 mb-2">AI Answer</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Source documents */}
            {results.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">
                  Sources ({results.length} documents)
                </p>
                <div className="space-y-2">
                  {results.map((result, i) => {
                    const { filename, folder } = parseGCSLink(result.link);
                    return (
                      <div 
                        key={result.id || i}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors cursor-pointer group"
                        onClick={() => {
                          // For now, we can't directly open GCS links
                          // In future, this would open a preview or Drive link
                          alert(`File: ${filename}\n\nPath: ${result.link}\n\nNote: Direct file preview coming soon!`);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                            <Icon name={getFileIcon(filename)} size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                              {result.title || filename}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{folder}</p>
                          </div>
                          <Icon name="external-link" size={14} className="text-slate-300 group-hover:text-blue-400" />
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
