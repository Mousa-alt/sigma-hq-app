import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

export default function ChatPanel({ project, isExpanded, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (project) {
      setMessages([{
        role: 'assistant',
        content: `Ready to help with ${project.name}. Ask me anything about your project documents - materials, approvals, invoices, drawings, or any specifications.`,
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
        sources = (data.results || []).slice(0, 5).map(r => ({
          title: r.title,
          link: r.link
        }));
      } else if (data.results && data.results.length > 0) {
        response = `I found ${data.results.length} related documents. Here are the most relevant ones:`;
        sources = data.results.slice(0, 5).map(r => ({
          title: r.title,
          link: r.link
        }));
      } else {
        response = "I couldn't find specific information about that. Try asking about materials, invoices, shop drawings, or meeting minutes.";
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

  // Parse GCS link to get filename
  const getFilename = (gcsLink) => {
    if (!gcsLink) return 'Document';
    const parts = gcsLink.split('/');
    return parts[parts.length - 1];
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
            <span className="text-xs font-medium text-slate-900">AI Assistant</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ready
            </span>
          </div>
        </div>
        <Icon 
          name={isExpanded ? "chevron-down" : "chevron-up"} 
          size={18} 
          className="text-slate-400" 
        />
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
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  
                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, j) => (
                          <span 
                            key={j}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:border-blue-300 cursor-pointer"
                            title={getFilename(src.link)}
                          >
                            <Icon name="file-text" size={10} />
                            {src.title || getFilename(src.link)}
                          </span>
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
                  <Icon name="loader-2" size={14} className="animate-spin text-slate-400" />
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm outline-none pr-14 text-slate-900 placeholder:text-slate-400 focus:border-blue-300 transition-colors" 
              placeholder="Ask about materials, approvals, invoices..." 
              disabled={loading} 
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()} 
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-lg disabled:opacity-30 transition-opacity"
            >
              <Icon name="send" size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
