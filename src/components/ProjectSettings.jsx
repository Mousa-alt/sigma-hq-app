import { useState } from 'react';
import Icon from './Icon';
import DeleteProjectModal from './DeleteProjectModal';
import { LOCATIONS } from '../config';

export default function ProjectSettings({ project, onUpdateProject, onDeleteProject }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    name: project?.name || '',
    location: project?.location || 'Cairo',
    driveLink: project?.driveLink || '',
    startDate: project?.startDate || '',
    expectedEndDate: project?.expectedEndDate || '',
    completionDate: project?.completionDate || '',
    status: project?.status || 'Active'
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="max-w-2xl pb-40 sm:pb-24">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-0.5 sm:mb-1">Project Settings</h2>
        <p className="text-xs sm:text-sm text-slate-500">Manage project details and configuration</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Project Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Location</label>
            <select
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
            >
              {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
            >
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Google Drive URL</label>
          <input
            type="url"
            value={formData.driveLink}
            onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
          />
        </div>

        {/* Date fields - stack vertically on mobile */}
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
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Expected End</label>
            <input
              type="date"
              value={formData.expectedEndDate}
              onChange={(e) => setFormData({ ...formData, expectedEndDate: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1.5 sm:mb-2">Completion Date</label>
            <input
              type="date"
              value={formData.completionDate}
              onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-400"
            />
          </div>
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
