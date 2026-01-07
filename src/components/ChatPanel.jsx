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
        content: `I have indexed the technical documentation for **${project.name}**. Ask me about drawings, specs, meeting minutes, or any project documents.`
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
        response = `Found ${data.total} relevant documents:\n\n`;
        data.results.slice(0, 3).forEach((r, i) => {
          response += `**${i+1}. ${r.title}**\n`;
          if (r.snippets && r.snippets[0]) {
            response += `${r.snippets[0].substring(0, 200)}...\n\n`;
          }
        });
      } else {
        response = "I couldn't find specific information about that. Try rephrasing your question.";
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
    <div className={`fixed lg:absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 transition-all duration-500 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${isExpanded ? 'h-[75vh] lg:h-[450px]' : 'h-16'}`}>
      {/* Header bar */}
      <div 
        className="h-16 px-6 lg:px-10 flex items-center justify-between cursor-pointer" 
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Icon name="bot" size={16} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 block">Project AI</span>
            <span className="text-[8px] font-bold text-emerald-500 uppercase flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Ready
            </span>
          </div>
        </div>
        <Icon 
          name="chevron-down" 
          size={20} 
          className={`transition-transform duration-500 text-slate-300 ${isExpanded ? 'rotate-180 text-blue-500' : ''}`} 
        />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-6 lg:p-10 pt-0 flex flex-col h-[calc(100%-4rem)]">
          <div className="flex-1 overflow-y-auto mb-4 space-y-3 no-scrollbar">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`p-4 rounded-2xl text-xs font-medium leading-relaxed max-w-[85%] ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white ml-auto rounded-br-none' 
                    : 'bg-slate-100 text-slate-700 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="bg-slate-100 p-4 rounded-2xl rounded-bl-none max-w-[85%] flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" />
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="relative">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold outline-none pr-16 text-black" 
              placeholder="Ask the project AI..." 
              disabled={loading} 
            />
            <button 
              type="submit" 
              disabled={loading} 
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900 text-white rounded-xl"
            >
              <Icon name="send" size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
