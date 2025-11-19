import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, authPersistencePromise } from '../firebase';
import { playAudio } from '../services/audioService';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  useEffect(() => {
    const checkPersistence = async () => {
      const result = await authPersistencePromise;
      if (!result.success) {
        setPersistenceWarning(result.message);
      }
    };
    checkPersistence();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    playAudio('uiClick');
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  return { 
    currentUser, 
    authLoading, 
    persistenceWarning, 
    logout,
    setCurrentUser // Exposed for manual updates if needed (e.g. auth form)
  };
};
