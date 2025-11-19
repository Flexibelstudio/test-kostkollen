import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@firebase/auth';
import { useAuth } from './hooks/useAuth';
import { useUserData, UseUserDataReturn } from '../hooks/useUserData';
import { getDateUID } from './utils/dateUtils';

interface UserContextType extends UseUserDataReturn {
  currentUser: User | null;
  authLoading: boolean;
  persistenceWarning: string | null;
  logout: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Initialize data hook with current user and date
  const userData = useUserData(auth.currentUser?.uid, currentDate);

  // Handle visibility change to update currentDate automatically
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            const now = new Date();
            if (getDateUID(now) !== getDateUID(currentDate)) {
                console.log("App became visible on a new day. Updating current date.");
                setCurrentDate(now);
            }
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentDate]);

  const value = {
    ...auth,
    ...userData,
    currentDate,
    setCurrentDate,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};