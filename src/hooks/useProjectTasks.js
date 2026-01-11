import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { matchesProject } from '../utils/projectMatching';

const COLLECTION_PATH = ['artifacts', 'sigma-hq-production', 'public', 'data', 'tasks'];

/**
 * Hook to fetch and manage tasks for a project
 */
export function useProjectTasks(project) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.name) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const tasksRef = collection(db, ...COLLECTION_PATH);

    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter tasks by project
      const projectTasks = allTasks
        .filter(task => matchesProject(task.project_name, project))
        .sort((a, b) => {
          // Incomplete first, then by date
          if (a.done !== b.done) return a.done ? 1 : -1;
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 20);

      setTasks(projectTasks);
      setLoading(false);
    }, (error) => {
      console.error('Tasks error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [project?.id, project?.name, project?.code, project?.venue]);

  // Actions
  const addTask = async (text) => {
    if (!text?.trim() || !project?.name) return;
    try {
      const tasksRef = collection(db, ...COLLECTION_PATH);
      await addDoc(tasksRef, {
        text: text.trim(),
        done: false,
        source: 'manual',
        project_name: project.name,
        created_at: new Date().toISOString(),
        created_by: 'dashboard'
      });
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  const toggleTask = async (taskId, currentDone) => {
    try {
      const taskRef = doc(db, ...COLLECTION_PATH, taskId);
      await updateDoc(taskRef, {
        done: !currentDone,
        completed_at: !currentDone ? new Date().toISOString() : null
      });
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const taskRef = doc(db, ...COLLECTION_PATH, taskId);
      await deleteDoc(taskRef);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Computed values
  const incompleteTasks = tasks.filter(t => !t.done);

  return { 
    tasks, 
    loading, 
    incompleteTasks,
    addTask, 
    toggleTask, 
    deleteTask 
  };
}
