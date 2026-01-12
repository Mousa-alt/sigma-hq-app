import { useState, useMemo } from 'react';
import Icon from './Icon';
import DeleteProjectModal from './DeleteProjectModal';
import { PROJECT_STATUSES } from '../config';

// Calculate project schedule status
const getScheduleStatus = (startDate, contractualDuration, timeExtensions = [], completionDate) => {
  if (!startDate || !contractualDuration) return null;
  
  const start = new Date(startDate);
  const totalExtensionWeeks = timeExtensions.reduce((sum, ext) => sum + (ext.weeks || 0), 0);
  const totalDays = (contractualDuration * 30) + (totalExtensionWeeks * 7); // months + extension weeks
  
  const expectedEnd = new Date(start);
  expectedEnd.setDate(expectedEnd.getDate() + totalDays);
  
  const today = new Date();
  const elapsed = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  const remaining = Math.floor((expectedEnd - today) / (1000 * 60 * 60 * 24));
  const progress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  
  // Determine status color
  let status = 'green'; // On track
  if (remaining < 0) {
    status = 'red'; // Overdue
  } else if (remaining < 30) {
    status = 'yellow'; // Less than 1 month remaining
  } else if (progress > 85 && remaining < 60) {
    status = 'yellow'; // High progress but deadline approaching
  }
  
  // If completed, show completion status
  if (completionDate) {
    const completed = new Date(completionDate);
    if (completed <= expectedEnd) {
      status = 'green'; // Completed on time
    } else {
      status = 'red'; // Completed late
    }
  }
  
  return {
    expectedEnd,
    elapsed,
    remaining,
    progress,
    status,
    totalDays,
    extensionWeeks: totalExtensionWeeks
  };
};

export default function ProjectSettings({ project, onUpdateProject, onDeleteProject }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    name: project?.name || '',
    code: project?.code || '',
    venue: project?.venue || '',
    area: project?.area || '',
    driveLink: project?.driveLink || '',
    startDate: project?.startDate || '',
    contractualDuration: project?.contractualDuration || '', // in months
    timeExtensions: project?.timeExtensions || [], // [{weeks, reason, date}]
    completionDate: project?.completionDate || '',
    status: project?.status || 'active'
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddExtension, setShowAddExtension] = useState(false);
  const [newExtension, setNewExtension] = useState({ weeks: '', reason: '' });

  // Calculate schedule status
  const scheduleInfo = useMemo(() => {
    return getScheduleStatus(
      formData.startDate, 
      parseInt(formData.contractualDuration) || 0,
      formData.timeExtensions,
      formData.completionDate
    );
  }, [formData.startDate, formData.contractualDuration, formData.timeExtensions, formData.completionDate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateProject({ ...project, ...formData });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddExtension = () => {
    if (!newExtension.weeks || !newExtension.reason) return;
    setFormData({
      ...formData,
      timeExtensions: [
        ...formData.timeExtensions,
        { 
          weeks: parseInt(newExtension.weeks), 
          reason: newExtension.reason,
          date: new Date().toISOString().split('T')[0]
        }
      ]
    });
    setNewExtension({ weeks: '', reason: '' });
    setShowAddExtension(false);
  };

  const handleRemoveExtension = (index) => {
    setFormData({
      ...formData,
      timeExtensions: formData.timeExtensions.filter((_, i) => i !== index)
    });
  };

  const statusColors = {
    green: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400', label: 'On Track' },
    yellow: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-400', label: 'At Risk' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400', label: 'Delayed' }
  };

  return (
    <div className="max-w-2xl pb-40 sm:pb-24">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-0.5 sm:mb-1">Project Settings</h2>
        <p className="text-xs sm:text-sm text-slate-500">Manage project details and configuration</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Project Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Agora"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Project Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., ECH-DT, AGR-GEM"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400 uppercase"
            />
            <p className="text-[9px] text-slate-400 mt-1">Short code used in emails &amp; WhatsApp groups</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Venue / Location</label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              placeholder="e.g., GEM, Mall of Arabia"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
            />
            <p className="text-[9px] text-slate-400 mt-1">Where is the project? (Mall, Building, etc.)</p>
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Area (m²)</label>
            <input
              type="text"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              placeholder="e.g., 1500"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
            />
            <p className="text-[9px] text-slate-400 mt-1">Total project area in square meters</p>
          </div>
        </div>

        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUSES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setFormData({ ...formData, status: s.value })}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  formData.status === s.value
                    ? `bg-${s.color}-100 text-${s.color}-700 border-2 border-${s.color}-400`
                    : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Google Drive URL</label>
          <input
            type="url"
            value={formData.driveLink}
            onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
          />
        </div>

        {/* Duration Section */}
        <div className="border-t border-slate-200 pt-4 sm:pt-5">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Icon name="clock" size={14} className="text-slate-500" />
            Project Duration
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Contractual Duration</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.contractualDuration}
                  onChange={(e) => setFormData({ ...formData, contractualDuration: e.target.value })}
                  placeholder="e.g., 12"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400 pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">months</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Completion Date</label>
              <input
                type="date"
                value={formData.completionDate}
                onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
              />
              <p className="text-[9px] text-slate-400 mt-1">Fill when project is completed</p>
            </div>
          </div>

          {/* Time Extensions */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] sm:text-xs font-medium text-slate-700">Time Extensions</label>
              <button
                type="button"
                onClick={() => setShowAddExtension(!showAddExtension)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Icon name="plus" size={12} />
                Add Extension
              </button>
            </div>

            {showAddExtension && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">Weeks</label>
                    <input
                      type="number"
                      value={newExtension.weeks}
                      onChange={(e) => setNewExtension({ ...newExtension, weeks: e.target.value })}
                      placeholder="3"
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">Reason</label>
                    <input
                      type="text"
                      value={newExtension.reason}
                      onChange={(e) => setNewExtension({ ...newExtension, reason: e.target.value })}
                      placeholder="e.g., Material delay"
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddExtension}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddExtension(false)}
                    className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {formData.timeExtensions.length > 0 ? (
              <div className="space-y-2">
                {formData.timeExtensions.map((ext, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-amber-700">+{ext.weeks}w</span>
                      <span className="text-xs text-slate-600">{ext.reason}</span>
                      {ext.date && <span className="text-[10px] text-slate-400">({ext.date})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtension(idx)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-amber-600 font-medium">
                  Total extension: {formData.timeExtensions.reduce((sum, e) => sum + (e.weeks || 0), 0)} weeks
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">No time extensions added</p>
            )}
          </div>

          {/* Schedule Status Card */}
          {scheduleInfo && (
            <div className={`mt-4 p-4 rounded-xl border-2 ${statusColors[scheduleInfo.status].bg} ${statusColors[scheduleInfo.status].border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${statusColors[scheduleInfo.status].text}`}>
                  {statusColors[scheduleInfo.status].label}
                </span>
                <span className="text-xs text-slate-600">
                  {Math.round(scheduleInfo.progress)}% elapsed
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-2 bg-white/50 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full rounded-full transition-all ${
                    scheduleInfo.status === 'green' ? 'bg-emerald-500' :
                    scheduleInfo.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, scheduleInfo.progress)}%` }}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-800">{scheduleInfo.elapsed}</p>
                  <p className="text-[10px] text-slate-500">Days Elapsed</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">
                    {scheduleInfo.remaining >= 0 ? scheduleInfo.remaining : Math.abs(scheduleInfo.remaining)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {scheduleInfo.remaining >= 0 ? 'Days Remaining' : 'Days Overdue'}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">
                    {scheduleInfo.expectedEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </p>
                  <p className="text-[10px] text-slate-500">Expected End</p>
                </div>
              </div>
              
              {scheduleInfo.extensionWeeks > 0 && (
                <p className="text-[10px] text-center mt-2 text-slate-500">
                  Includes {scheduleInfo.extensionWeeks} weeks of approved extensions
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Icon name="loader-2" size={14} className="animate-spin" /> : saved ? <Icon name="check" size={14} /> : <Icon name="save" size={14} />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 sm:mt-8 bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
        <h3 className="text-xs sm:text-sm font-semibold text-red-800 mb-1.5 sm:mb-2">Danger Zone</h3>
        <p className="text-[10px] sm:text-sm text-red-600 mb-3 sm:mb-4">
          Deleting a project will remove it from the dashboard and delete all synced files from cloud storage.
          Your Google Drive files will remain safe.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] sm:text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Icon name="trash-2" size={12} className="sm:w-3.5 sm:h-3.5" />
          Delete Project
        </button>
      </div>

      {showDeleteModal && (
        <DeleteProjectModal
          project={project}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={onDeleteProject}
        />
      )}
    </div>
  );
}
