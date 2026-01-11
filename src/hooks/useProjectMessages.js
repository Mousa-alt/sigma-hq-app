import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { itemBelongsToProject } from '../utils/projectMatching';

const COLLECTION_PATH = ['artifacts', 'sigma-hq-production', 'public', 'data', 'whatsapp_messages'];

/**
 * Hook to fetch and filter WhatsApp messages for a project
 * Uses project code, name, and venue for matching
 */
export function useProjectMessages(project) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.name) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesRef = collection(db, ...COLLECTION_PATH);

    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter messages that belong to this project
      const projectMessages = allMessages
        .filter(msg => itemBelongsToProject(msg, project, false))
        .sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 10);

      setMessages(projectMessages);
      setLoading(false);
    }, (error) => {
      console.error('WhatsApp messages error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [project?.id, project?.name, project?.code, project?.venue]);

  // Computed values
  const actionableMessages = messages.filter(m => m.is_actionable && m.status !== 'done');

  return { messages, loading, actionableMessages };
}
