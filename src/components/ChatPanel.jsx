import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';
import { 
  parseGCSLink, 
  detectDocumentType, 
  getDocTypeInfo,
  sortByHierarchy,
  getFileViewURL 
} from '../utils/documentUtils';

export default function ChatPanel({ project, isExpanded, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (project) {
      setMessages([{
        role: 'assistant',
        content: `Ready to help with **${project.name}**. I can search across all your project documents - contracts, BOQs, shop drawings, samples, meeting minutes, and correspondence.\n\nAsk me about materials, approvals, specifications, or anything in your project files.`,
        sources: []
      }]);
    }
  }, [project?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, sources: [] }]);
    setLoading(true);
    
    try {
      const res = await fetch(`${SYNC_WORKER_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMessage, 
          projectName: project.name.replace(/\s+/g, '_') 
        })
      });
      const data = await res.json();
      
      let response = '';
      let sources = [];
      
      if (data.summary) {
        response = data.summary;
        // Sort by hierarchy and take top sources
        const sorted = sortByHierarchy(data.results || []);
        sources = sorted.slice(0, 5).map(r => {
          const { filename } = parseGCSLink(r.link);
          const docType = detectDocumentType(filename, r.link);
          const typeInfo = getDocTypeInfo(docType);
          return {
            title: r.title,
            link: r.link,
            docType,
            typeInfo
          };
        });
      } else if (data.results && data.results.length > 0) {
        response = `I found ${data.results.length} related documents. The most authoritative sources are shown below:`;
        const sorted = sortByHierarchy(data.results);
        sources = sorted.slice(0, 5).map(r => {
          const { filename } = parseGCSLink(r.link);
          const docType = detectDocumentType(filename, r.link);
          const typeInfo = getDocTypeInfo(docType);
          return {
            title: r.title,
            link: r.link,
            docType,
            typeInfo
          };
        });
      } else {
        response = "I couldn't find specific information about that in the project documents. Try asking about:\n• Materials and samples\n• Shop drawings\n• Invoices\n• Meeting minutes\n• Specifications";
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: response, sources }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error connecting to the search service. Please try again.",
        sources: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceClick = (source) => {
    const viewUrl = getFileViewURL(source.link, SYNC_WORKER_URL);
    if (viewUrl) {
      window.open(viewUrl, '_blank');
    }
  };

  // Get badge color classes
  const getBadgeClasses = (color) => {
    const colors = {
      red: 'bg-red-100 text-red-700 border-red-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
      emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      amber: 'bg-amber-100 text-amber-700 border-amber-200',
      slate: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return colors[color] || colors.slate;
  };

  // Parse markdown-style bold
  const renderContent = (content) => {
    return content.split('**').map((part, i) => 
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <div 
      className={`fixed bottom-0 right-0 bg-white border-t border-l border-slate-200 transition-all duration-300 z-40 shadow-xl ${isExpanded ? 'h-[60vh] w-full lg:w-[calc(100%-18rem)]' : 'h-14 w-full lg:w-[calc(100%-18rem)]'}`}
      style={{ left: 'auto' }}
    >
      {/* Header bar */}
      <div 
        className="h-14 px-6 flex items-center justify-between cursor-pointer border-b border-slate-100" 
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Icon name="sparkles" size={14} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-900">Project AI</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ready
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 hidden sm:block">Understands document hierarchy</span>
          <Icon 
            name={isExpanded ? "chevron-down" : "chevron-up"} 
            size={18} 
            className="text-slate-400" 
          />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-6 flex flex-col h-[calc(100%-3.5rem)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 no-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                <div 
                  className={`rounded-xl text-sm leading-relaxed max-w-[85%] ${
                    msg.role === 'user' 
                      ? 'bg-slate-900 text-white p-4' 
                      : 'bg-slate-50 text-slate-700 p-4'
                  }`}
                >
                  {/* Message content */}
                  <div className="whitespace-pre-wrap">{renderContent(msg.content)}</div>
                  
                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">Sources (by authority)</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, j) => (
                          <button 
                            key={j}
                            onClick={(e) => { e.stopPropagation(); handleSourceClick(src); }}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 border rounded text-[10px] hover:shadow-sm transition-all cursor-pointer ${getBadgeClasses(src.typeInfo?.color)}`}
                            title={src.title}
                          >
                            <span className="font-semibold">{src.typeInfo?.label}</span>
                            <span className="text-slate-500 max-w-[100px] truncate">{src.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="bg-slate-50 p-4 rounded-xl max-w-[85%]">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-5 h-5 rounded-full border-2 border-blue-100" />
                    <div className="absolute inset-0 w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  </div>
                  <span className="text-sm text-slate-500">Searching documents...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <form onSubmit={handleSubmit} className="relative">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm outline-none pr-14 text-slate-900 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white transition-all" 
              placeholder="Ask about materials, approvals, specifications..." 
              disabled={loading} 
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()} 
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg disabled:opacity-30 transition-opacity"
            >
              <Icon name="send" size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
