import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const MESSAGES_PATH = ['artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages'];
const GROUPS_PATH = ['artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_groups'];

// Groups that should never be shown in project feeds
const EXCLUDED_GROUPS = [
  'command center',
  'technical office',
  'ai assistant',
  'testing'
];

const isExcludedGroup = (groupName) => {
  if (!groupName) return false;
  const lower = groupName.toLowerCase();
  return EXCLUDED_GROUPS.some(excluded => lower.includes(excluded));
};

/**
 * Hook to fetch WhatsApp messages for a project
 * Uses the project's linked WhatsApp group for accurate matching
 */
export function useProjectMessages(project) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkedGroupIds, setLinkedGroupIds] = useState([]);

  // First, get the linked WhatsApp groups for this project
  useEffect(() => {
    if (!project?.name) {
      setLinkedGroupIds([]);
      return;
    }

    const groupsRef = collection(db, ...GROUPS_PATH);
    
    const unsubscribe = onSnapshot(groupsRef, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Find groups linked to this project
      const linked = groups
        .filter(g => {
          const linkedProject = g.project?.toLowerCase() || '';
          const projectName = project.name?.toLowerCase() || '';
          const projectCode = project.code?.toLowerCase() || '';
          
          return linkedProject === projectName || 
                 linkedProject === projectCode ||
                 linkedProject.includes(projectName) ||
                 (projectCode && linkedProject.includes(projectCode));
        })
        .map(g => g.group_id)
        .filter(Boolean);
      
      setLinkedGroupIds(linked);
    });

    return () => unsubscribe();
  }, [project?.name, project?.code]);

  // Then, fetch messages from those groups
  useEffect(() => {
    if (!project?.name) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesRef = collection(db, ...MESSAGES_PATH);

    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter messages that belong to this project
      const projectMessages = allMessages
        .filter(msg => {
          // Exclude command center and general groups
          if (isExcludedGroup(msg.group_name)) {
            return false;
          }
          
          // If we have linked groups, filter by group_id
          if (linkedGroupIds.length > 0) {
            return linkedGroupIds.includes(msg.group_id);
          }
          
          // Fallback: match by project_name field
          const msgProject = msg.project_name?.toLowerCase() || '';
          const projectName = project.name?.toLowerCase() || '';
          const projectCode = project.code?.toLowerCase() || '';
          
          if (projectCode && msgProject.includes(projectCode)) return true;
          if (projectName && msgProject.includes(projectName)) return true;
          
          return false;
        })
        .sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 20);

      setMessages(projectMessages);
      setLoading(false);
    }, (error) => {
      console.error('WhatsApp messages error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [project?.id, project?.name, project?.code, linkedGroupIds]);

  // Computed values
  const actionableMessages = messages.filter(m => m.is_actionable && m.status !== 'done');

  return { messages, loading, actionableMessages };
}
