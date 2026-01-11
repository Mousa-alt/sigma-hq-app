import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { APP_ID } from '../../config';
import Icon from '../Icon';

/**
 * TeamSection - Shows assigned team members for a project
 */
export default function TeamSection({ project }) {
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.id) return;

    // Load engineers
    const engineersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'engineers');
    const unsubEngineers = onSnapshot(engineersRef, (snapshot) => {
      setEngineers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Load assignments
    const assignmentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'assignments');
    const unsubAssignments = onSnapshot(assignmentsRef, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubEngineers();
      unsubAssignments();
    };
  }, [project?.id]);

  // Get engineers assigned to this project
  const assignedEngineers = assignments
    .filter(a => a.projectId === project?.id)
    .map(a => engineers.find(e => e.id === a.engineerId))
    .filter(Boolean);

  // Position colors
  const POSITION_COLORS = {
    head: '#0A1628',
    team_leader: '#1E40AF',
    senior: '#0369A1',
    toe: '#0891B2',
    junior: '#06B6D4',
    trainee: '#22D3EE',
  };

  const POSITION_LABELS = {
    head: 'Head',
    team_leader: 'TL',
    senior: 'Sr.',
    toe: 'TOE',
    junior: 'Jr.',
    trainee: 'Trainee',
  };

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2 text-slate-400">
          <Icon name="loader-2" size={14} className="animate-spin" />
          <span className="text-xs">Loading team...</span>
        </div>
      </div>
    );
  }

  if (assignedEngineers.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="users" size={14} className="text-slate-400" />
            <span className="text-xs text-slate-500">No team assigned</span>
          </div>
          <span className="text-[10px] text-slate-400">Go to Organization to assign</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2 sm:mb-3">
        Project Team ({assignedEngineers.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {assignedEngineers.map(eng => {
          const color = POSITION_COLORS[eng.position] || '#94A3B8';
          const label = POSITION_LABELS[eng.position] || '';
          
          return (
            <div 
              key={eng.id}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow"
            >
              {/* Avatar */}
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {eng.name?.charAt(0) || '?'}
              </div>
              
              {/* Info */}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{eng.name}</p>
                <p className="text-[9px] text-slate-500">{label}</p>
              </div>
              
              {/* Phone icon */}
              {eng.phone && (
                <a 
                  href={`tel:${eng.phone}`}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 ml-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon name="phone" size={12} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
