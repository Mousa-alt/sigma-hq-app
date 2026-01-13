import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const MESSAGES_PATH = ['artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages'];
const GROUPS_PATH = ['artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_groups'];

/**
 * Hook to fetch WhatsApp messages for a project
 * 
 * SIMPLE RULE: Only show messages from groups that are MAPPED to this project
 * The Group → Project Mapping is the ONLY source of truth
 * 
 * NOTE: There's a field name inconsistency between frontend and backend:
 * - Frontend (ChannelSettings.jsx) stores WAHA ID as "wahaId"  
 * - Backend (auto_add_group) stores WAHA ID as "group_id"
 * So we check BOTH fields to find the correct WAHA chat ID
 */
export function useProjectMessages(project) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkedGroupIds, setLinkedGroupIds] = useState([]);

  // Step 1: Get the group IDs that are mapped to this project
  useEffect(() => {
    if (!project?.name) {
      setLinkedGroupIds([]);
      return;
    }

    const groupsRef = collection(db, ...GROUPS_PATH);
    
    const unsubscribe = onSnapshot(groupsRef, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Find groups where the "project" field matches this project's name
      const projectNameLower = project.name.toLowerCase();
      
      const linked = groups
        .filter(g => {
          const mappedProject = (g.project || '').toLowerCase();
          // Exact match only - the mapping is the source of truth
          return mappedProject === projectNameLower;
        })
        .map(g => {
          // Check multiple possible field names for the WAHA chat ID:
          // - wahaId: set by frontend ChannelSettings when scanning/creating groups
          // - group_id: set by backend auto_add_group when messages arrive
          const wahaGroupId = g.wahaId || g.group_id;
          console.log(`[useProjectMessages] Group "${g.name}" -> wahaId: ${g.wahaId}, group_id: ${g.group_id}, using: ${wahaGroupId}`);
          return wahaGroupId;
        })
        .filter(Boolean);
      
      console.log(`[useProjectMessages] ${project.name}: Found ${linked.length} linked groups`, linked);
      setLinkedGroupIds(linked);
    });

    return () => unsubscribe();
  }, [project?.name]);

  // Step 2: Get messages ONLY from those linked groups
  useEffect(() => {
    if (!project?.name) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // If no groups are linked, show nothing
    if (linkedGroupIds.length === 0) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesRef = collection(db, ...MESSAGES_PATH);

    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // ONLY show messages from linked groups - nothing else
      const projectMessages = allMessages
        .filter(msg => linkedGroupIds.includes(msg.group_id))
        .sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 20);

      console.log(`[useProjectMessages] ${project.name}: ${projectMessages.length} messages found from ${allMessages.length} total`);
      setMessages(projectMessages);
      setLoading(false);
    }, (error) => {
      console.error('WhatsApp messages error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [project?.name, linkedGroupIds]);

  // Computed values
  const actionableMessages = messages.filter(m => m.is_actionable && m.status !== 'done');

  return { messages, loading, actionableMessages };
}
