import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SYNC_WORKER_URL } from '../config';

export default function AIChat({ project }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize chat when project changes
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
        response = "I couldn't find specific information about that in the project documents. Try rephrasing your question or asking about specific document types like meeting minutes, shop drawings, or correspondence.";
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error searching the documents. Please try again." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 mb-6 no-scrollbar">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`p-5 rounded-[1.5rem] text-sm font-medium leading-relaxed max-w-[85%] ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white ml-auto rounded-br-none' 
                : 'bg-slate-100 text-slate-700 rounded-bl-none'
            }`}
          >
            {msg.content.split('\n').map((line, j) => <p key={j} className="mb-1">{line}</p>)}
          </div>
        ))}
        {loading && (
          <div className="bg-slate-100 p-5 rounded-[1.5rem] rounded-bl-none max-w-[85%]">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}} />
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="relative">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none pr-16 text-black" 
          placeholder="Ask about project documents..." 
          disabled={loading} 
        />
        <button 
          type="submit" 
          disabled={loading} 
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900 text-white rounded-xl active:scale-95 transition-all disabled:opacity-50"
        >
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
