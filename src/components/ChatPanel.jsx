import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

export default function ChatPanel({ project, isExpanded, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (project) {
      setMessages([{
        role: 'assistant',
        content: `Ready to help with ${project.name}. Ask me to find documents, search for files, or answer questions about your project.`
      }]);
    }
  }, [project?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
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
      if (data.summary) {
        response = data.summary;
      } else if (data.results && data.results.length > 0) {
        response = `Found ${data.total} documents:\n\n`;
        data.results.slice(0, 3).forEach((r, i) => {
          response += `${i+1}. ${r.title}\n`;
          if (r.snippets && r.snippets[0]) {
            response += `${r.snippets[0].substring(0, 150)}...\n\n`;
          }
        });
      } else {
        response = "I couldn't find that. Try asking for specific document types like 'flooring shop drawings' or 'latest invoice'.";
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setLoading(false);
    }
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
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <Icon name="search" size={14} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-900">Search & Ask</span>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1 ml-2">
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
          <div className="flex-1 overflow-y-auto mb-4 space-y-3 no-scrollbar">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`p-4 rounded-xl text-sm leading-relaxed max-w-[85%] ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 text-white ml-auto' 
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {msg.content.split('\n').map((line, j) => (
                  <p key={j} className={j > 0 ? 'mt-1' : ''}>{line}</p>
                ))}
              </div>
            ))}
            {loading && (
              <div className="bg-slate-100 p-4 rounded-xl max-w-[85%] flex gap-1.5">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
              </div>
            )}
          </div>
          
          {/* Input */}
          <form onSubmit={handleSubmit} className="relative">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm outline-none pr-14 text-slate-900 placeholder:text-slate-400 focus:border-blue-300 transition-colors" 
              placeholder="Search for documents or ask a question..." 
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
