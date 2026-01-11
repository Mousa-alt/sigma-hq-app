import { useState } from 'react';
import Icon from '../Icon';

/**
 * Date editor - inline edit for project dates
 */
export default function DateEditor({ project, onUpdateProject }) {
  const [editing, setEditing] = useState(false);
  const [dates, setDates] = useState({
    startDate: project?.startDate || '',
    expectedEndDate: project?.expectedEndDate || '',
    completionDate: project?.completionDate || ''
  });

  const handleSave = () => {
    if (onUpdateProject) {
      onUpdateProject({ ...project, ...dates });
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex justify-end">
        <button 
          onClick={() => setEditing(true)} 
          className="flex items-center gap-1.5 px-2 py-1 text-slate-500 hover:text-slate-700 text-[10px] sm:text-xs"
        >
          <Icon name="edit-2" size={10} />
          Edit Dates
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-3 bg-blue-50 rounded-xl border border-blue-200">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
        <div>
          <label className="block text-[9px] sm:text-[10px] text-slate-500 mb-1">Start</label>
          <input 
            type="date" 
            value={dates.startDate} 
            onChange={(e) => setDates({...dates, startDate: e.target.value})} 
            className="w-full px-2 py-1.5 border rounded text-xs" 
          />
        </div>
        <div>
          <label className="block text-[9px] sm:text-[10px] text-slate-500 mb-1">Target End</label>
          <input 
            type="date" 
            value={dates.expectedEndDate} 
            onChange={(e) => setDates({...dates, expectedEndDate: e.target.value})} 
            className="w-full px-2 py-1.5 border rounded text-xs" 
          />
        </div>
        <div>
          <label className="block text-[9px] sm:text-[10px] text-slate-500 mb-1">Completion</label>
          <input 
            type="date" 
            value={dates.completionDate} 
            onChange={(e) => setDates({...dates, completionDate: e.target.value})} 
            className="w-full px-2 py-1.5 border rounded text-xs" 
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button 
          onClick={() => setEditing(false)} 
          className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-[10px] sm:text-xs font-medium"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave} 
          className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] sm:text-xs font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}
