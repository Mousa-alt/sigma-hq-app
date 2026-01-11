import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { itemBelongsToProject } from '../utils/projectMatching';

const COLLECTION_PATH = ['artifacts', 'sigma-hq-production', 'public', 'data', 'emails'];

/**
 * Hook to fetch and filter emails for a project
 * Uses project code, name, and venue for matching
 */
export function useProjectEmails(project) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.name) {
      setEmails([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const emailsRef = collection(db, ...COLLECTION_PATH);

    const unsubscribe = onSnapshot(emailsRef, (snapshot) => {
      const allEmails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter emails that belong to this project (checks code, name, venue, subject, body)
      const projectEmails = allEmails
        .filter(email => itemBelongsToProject(email, project, true))
        .sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(0);
          const dateB = b.date ? new Date(b.date) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 10);

      setEmails(projectEmails);
      setLoading(false);
    }, (error) => {
      console.error('Emails error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [project?.id, project?.name, project?.code, project?.venue]);

  // Computed values
  const actionableEmails = emails.filter(e => e.is_actionable && e.status !== 'done');

  return { emails, loading, actionableEmails };
}
