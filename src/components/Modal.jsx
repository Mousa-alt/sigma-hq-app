import { useState } from 'react';
import Icon from './Icon';
import { COLORS } from '../config';

export default function Modal({ isOpen, onClose, onSubmit, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    venue: '',
    area: '',
    driveLink: '',
    startDate: '',
    endDate: '',
    status: 'active'
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Please fill in project name');
      return;
    }
    onSubmit(formData);
    setFormData({ name: '', client: '', venue: '', area: '', driveLink: '', startDate: '', endDate: '', status: 'active' });
  };

  const statusOptions = [
    { value: 'planning', label: 'Planning', icon: 'compass', bgClass: 'bg-purple-100', textClass: 'text-purple-700', borderClass: 'border-purple-400' },
    { value: 'tender', label: 'Tender', icon: 'file-text', bgClass: 'bg-amber-100', textClass: 'text-amber-700', borderClass: 'border-amber-400' },
    { value: 'active', label: 'Active', icon: 'play-circle', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700', borderClass: 'border-emerald-400' },
    { value: 'on_hold', label: 'On Hold', icon: 'pause-circle', bgClass: 'bg-slate-100', textClass: 'text-slate-700', borderClass: 'border-slate-400' },
    { value: 'completed', label: 'Done', icon: 'check-circle', bgClass: 'bg-blue-100', textClass: 'text-blue-700', borderClass: 'border-blue-400' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Register New Project</h2>
              <p className="text-sm text-slate-500 mt-1">Add a project to track in the dashboard</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <Icon name="x" size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Project Name & Client */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Project Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Agora"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Client</label>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                placeholder="e.g., ABC Developments"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
            </div>
          </div>

          {/* Venue & Area */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Venue / Location</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="e.g., GEM, Mall of Arabia"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Area (m²)</label>
              <input
                type="number"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="e.g., 5000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Project Status</label>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: s.value })}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    formData.status === s.value
                      ? `${s.bgClass} ${s.textClass} border-2 ${s.borderClass}`
                      : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon name={s.icon} size={14} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Google Drive Link - Optional now */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Google Drive Folder URL
              <span className="text-slate-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="url"
              value={formData.driveLink}
              onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
            />
            <p className="text-[10px] text-slate-400 mt-2">
              Leave empty for planning projects. Add later when ready to sync documents.
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Expected End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.navy }}
            >
              {loading ? (
                <><Icon name="loader-2" size={16} className="animate-spin" />Creating...</>
              ) : (
                <><Icon name="plus" size={16} />Create Project</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
