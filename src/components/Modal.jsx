import { useState } from 'react';
import Icon from './Icon';
import { COLORS, BRANDING, LOCATIONS } from '../config';

export default function Modal({ isOpen, onClose, onSubmit, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    location: 'Cairo',
    area: '',
    driveLink: '',
    subcontractorsLink: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ name: '', location: 'Cairo', area: '', driveLink: '', subcontractorsLink: '' });
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-6 bg-slate-900/80 backdrop-blur-md" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in">
        {/* Header */}
        <div className="p-8 lg:p-12 relative" style={{ backgroundColor: COLORS.navy }}>
          <div className="flex items-center gap-5">
            <div className="bg-white p-2 rounded-xl">
              <img src={BRANDING.logo} alt="Sigma" className="h-6 w-auto" />
            </div>
            <div className="w-[2px] h-8 bg-white/20 hidden sm:block" />
            <h2 className="text-2xl lg:text-3xl font-black tracking-tighter uppercase leading-none text-white italic">
              Register<br/>Site
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors text-3xl font-light"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 lg:p-12 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Name</label>
            <input 
              required 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none text-black" 
              placeholder="e.g. Agora Mall" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location</label>
              <select 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-black outline-none" 
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})}
              >
                {LOCATIONS.map(loc => <option key={loc}>{loc}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Total Area (m²)</label>
              <input 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-black outline-none" 
                placeholder="e.g. 25000" 
                value={formData.area} 
                onChange={e => setFormData({...formData, area: e.target.value})} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Google Drive Root URL</label>
            <input 
              required 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none text-black" 
              placeholder="Paste folder link" 
              value={formData.driveLink} 
              onChange={e => setFormData({...formData, driveLink: e.target.value})} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subcontractors Excel Link (Optional)</label>
            <input 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none text-black" 
              placeholder="Google Sheets or Excel link" 
              value={formData.subcontractorsLink} 
              onChange={e => setFormData({...formData, subcontractorsLink: e.target.value})} 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-5 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50" 
            style={{ backgroundColor: COLORS.blue }}
          >
            {loading ? (
              <Icon name="loader-2" size={20} className="animate-spin" />
            ) : (
              <>
                <Icon name="zap" size={18} /> 
                <span>Initialize Project</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
