import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { useUserData, UseUserDataReturn } from '../hooks/useUserData';
import { getDateUID } from '../utils/dateUtils';

interface UserContextType extends UseUserDataReturn {
  currentUser: User | null;
  authLoading: boolean;
  persistenceWarning: string | null;
  logout: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  
  // Custom Simulator States
  simulatedUserStatus: 'pending' | 'approved' | 'archived' | null;
  setSimulatedUserStatus: (status: 'pending' | 'approved' | 'archived' | null) => void;
  simulatedSubscriptionStatus: 'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive' | null;
  setSimulatedSubscriptionStatus: (status: 'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive' | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Initialize data hook with current user and date
  const userData = useUserData(auth.currentUser?.uid, currentDate);

  // Custom Simulator States
  const [simulatedUserStatus, setSimulatedUserStatusState] = useState<'pending' | 'approved' | 'archived' | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sim_user_status') as any || null;
    }
    return null;
  });

  const [simulatedSubscriptionStatus, setSimulatedSubscriptionStatusState] = useState<'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive' | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sim_subscription_status') as any || null;
    }
    return null;
  });

  const setSimulatedUserStatus = (status: 'pending' | 'approved' | 'archived' | null) => {
    setSimulatedUserStatusState(status);
    if (typeof window !== 'undefined') {
      if (status) {
        localStorage.setItem('sim_user_status', status);
      } else {
        localStorage.removeItem('sim_user_status');
      }
    }
  };

  const setSimulatedSubscriptionStatus = (status: 'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive' | null) => {
    setSimulatedSubscriptionStatusState(status);
    if (typeof window !== 'undefined') {
      if (status) {
        localStorage.setItem('sim_subscription_status', status);
      } else {
        localStorage.removeItem('sim_subscription_status');
      }
    }
  };

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

  // Derive simulated / overridden states
  //
  // Den gamla modellen krävde att en coach godkände varje nytt konto. Den är
  // ersatt av självbetjäning: betalningen ger åtkomst, och `hasAppAccess` är
  // den enda grinden. Men 'pending' gatade fortfarande ett tjugotal ställen i
  // App.tsx - datainläsning, onboarding, community, och returen från Stripe -
  // så ett nyskapat konto fick en halvdöd app och kom aldrig in efter köpet.
  //
  // 'pending' tolkas därför som godkänt. 'archived' står kvar, så coachen kan
  // fortfarande stänga av någon.
  const rawUserStatus = simulatedUserStatus !== null ? simulatedUserStatus : userData.userStatus;
  const effectiveUserStatus = rawUserStatus === 'pending' ? 'approved' : rawUserStatus;
  
  const effectiveUserProfile = {
    ...userData.userProfile,
    subscriptionStatus: simulatedSubscriptionStatus !== null ? simulatedSubscriptionStatus : userData.userProfile.subscriptionStatus,
    currentPeriodEnd: simulatedSubscriptionStatus === 'trialing' 
      ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days left of trial
      : (simulatedSubscriptionStatus === 'active' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : userData.userProfile.currentPeriodEnd)
  };

  const value = {
    ...auth,
    ...userData,
    userStatus: effectiveUserStatus,
    userProfile: effectiveUserProfile,
    currentDate,
    setCurrentDate,
    
    // Pass simulator fields and functions
    simulatedUserStatus,
    setSimulatedUserStatus,
    simulatedSubscriptionStatus,
    setSimulatedSubscriptionStatus
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