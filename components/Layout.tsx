
import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Footprints, Users, GraduationCap } from "lucide-react";
import { 
  PencilIcon, InformationCircleIcon, BellIcon, 
  ArrowRightOnRectangleIcon, InstallIcon
} from './icons';
import { Avatar } from './UserProfileModal';
import { useUserContext } from '../context/UserContext';
import { playAudio } from '../services/audioService';
import { LOCAL_STORAGE_KEYS } from '../constants';

// Modals
import UserProfileModal from './UserProfileModal';
import InfoModal from './InfoModal';
import UpdateNoticeModal from './UpdateNoticeModal';
import ConfettiCelebration from './ConfettiCelebration';
import ToastNotification from './ToastNotification';
import IosInstallPrompt from './IosInstallPrompt';
import { auth } from '../firebase';

const Layout: React.FC = () => {
  const { 
    userProfile, currentUser, hasCompletedOnboarding, 
    isInitialDataLoaded, setUserProfile, setGoals
  } = useUserContext();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  
  // Global UI State
  const [showConfetti, setShowConfetti] = useState(false); 
  const [toastNotification, setToastNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Modals State
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);
  
  // Install Prompt
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [showIosInstallPrompt, setShowIosInstallPrompt] = useState(false);

  // --- Effects ---

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update notice check
  useEffect(() => {
    if (isInitialDataLoaded && currentUser) {
        const UPDATE_NOTICE_KEY = 'updateNotice_v5_StreakUpdate'; 
        const noticeShown = localStorage.getItem(UPDATE_NOTICE_KEY);
        if (!noticeShown) setHasUnseenUpdate(true);
    }
  }, [isInitialDataLoaded, currentUser]);

  // Install Prompt Logic
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // iOS check
    const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isInStandaloneMode = () => window.matchMedia('(display-mode: standalone)').matches;
    const isSafariOnIos = () => isIos() && navigator.vendor && navigator.vendor.indexOf('Apple') > -1 && !navigator.userAgent.match(/CriOS/i);
    const hasDismissedPrompt = localStorage.getItem('iosInstallPromptDismissed') === 'true';
  
    if (isSafariOnIos() && !isInStandaloneMode() && !hasDismissedPrompt) {
      setTimeout(() => setShowIosInstallPrompt(true), 4000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // --- Logic Helpers ---

  const handleLogout = async () => {
    playAudio('uiClick');
    setShowProfileDropdown(false);
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // --- Navigation ---
  const navItems = [
      { path: '/', label: 'Startsida', Icon: Home },
      { path: '/journey', label: 'Min resa', Icon: Footprints },
      { path: '/courses', label: 'Kurs', Icon: GraduationCap },
      { path: '/community', label: 'Community', Icon: Users },
  ];

  const iconColor = "#3bab5a";

  return (
    <div className="min-h-screen bg-neutral-light flex flex-col items-center pb-28">
        {/* Header */}
        <header className="w-full bg-white text-neutral-dark p-4 shadow-lg sticky top-0 z-30">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => { playAudio('uiClick'); navigate('/'); }}>
                    <img src="/favicon.png" alt="Kostloggen.se logo" className="h-14 w-14" />
                </div>
                <div className="flex flex-wrap justify-end items-center gap-1">
                    {navItems.map(item => (
                        <button
                            key={item.path}
                            aria-label={item.label}
                            className={`nav-btn ${location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) ? "active" : ""}`}
                            onClick={() => { playAudio('uiClick'); navigate(item.path); }}
                        >
                            <span className="icon-wrap">
                                <item.Icon color={iconColor} size={24} strokeWidth={1.5} />
                            </span>
                        </button>
                    ))}
                    <div className="relative" ref={profileDropdownRef}>
                        <button
                            aria-label="Konto"
                            className={`nav-btn ${showProfileDropdown ? "active" : ""}`}
                            onClick={() => { playAudio('uiClick'); setShowProfileDropdown(prev => !prev);}}
                        >
                             <div className="icon-wrap p-0 relative">
                                <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={32} />
                                {hasUnseenUpdate && (
                                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
                                )}
                             </div>
                        </button>
                        {showProfileDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-neutral-light/70 p-2 z-40 animate-fade-slide-in">
                                <button onClick={() => { setShowUserProfileModal(true); setShowProfileDropdown(false); }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-dark hover:bg-neutral-light/70 flex items-center rounded-md">
                                    <PencilIcon className="w-5 h-5 mr-2.5 text-neutral" /> Redigera Profil
                                </button>
                                <button onClick={() => { setShowInfoModal(true); setShowProfileDropdown(false); }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-dark hover:bg-neutral-light/70 flex items-center rounded-md">
                                    <InformationCircleIcon className="w-5 h-5 mr-2.5 text-neutral" /> Information
                                </button>
                                <button onClick={() => { setShowUpdateNotice(true); setShowProfileDropdown(false); setHasUnseenUpdate(false); localStorage.setItem('updateNotice_v5_StreakUpdate', 'true'); }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-dark hover:bg-neutral-light/70 flex items-center rounded-md">
                                    <BellIcon className="w-5 h-5 mr-2.5 text-neutral" /> Senaste uppdateringen {hasUnseenUpdate && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-red-500"></span>}
                                </button>
                                <div className="my-1 border-t border-neutral-light/70"></div>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center rounded-md">
                                    <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2.5" /> Logga ut
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className={`w-full max-w-7xl mx-auto p-2 sm:p-4 flex-grow flex flex-col ${location.pathname === '/community' ? 'h-full' : ''}`}>
            <Outlet context={{ setShowConfetti, setToastNotification }} />
        </main>
        
        {/* Config Modals */}
        {showUserProfileModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowUserProfileModal(false)}><div onClick={e => e.stopPropagation()}><UserProfileModal initialProfile={userProfile} onSave={async (prof, newGoals, newPhoto) => { setUserProfile(prof); setGoals(newGoals); setShowUserProfileModal(false); }} onClose={() => setShowUserProfileModal(false)} isOnboarding={false} onSubscribeToPush={async () => { /* Implement push sub logic */ return true; }} /></div></div>}
        {showInfoModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowInfoModal(false)}><InfoModal onClose={() => setShowInfoModal(false)} userName={userProfile.name} /></div>}
        {showUpdateNotice && <UpdateNoticeModal show={showUpdateNotice} onClose={() => setShowUpdateNotice(false)} />}

        {/* Feedback */}
        {showConfetti && <ConfettiCelebration isActive={showConfetti} />}
        {toastNotification && <ToastNotification message={toastNotification.message} type={toastNotification.type} onClose={() => setToastNotification(null)} />}
        
        {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 animate-slide-up-fade-in">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <InstallIcon className="w-12 h-12 text-primary flex-shrink-0" />
                    <div>
                        <h3 className="font-bold text-neutral-dark">Installera Kostloggen</h3>
                        <p className="text-sm text-neutral">Få en bättre upplevelse.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowInstallBanner(false)} className="p-2 text-sm text-neutral">Senare</button>
                    <button onClick={() => { if(installPromptEvent) installPromptEvent.prompt(); setShowInstallBanner(false); }} className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-md shadow-sm">Installera</button>
                </div>
            </div>
        </div>
      )}
       {showIosInstallPrompt && <IosInstallPrompt onClose={() => {setShowIosInstallPrompt(false); localStorage.setItem('iosInstallPromptDismissed', 'true');}} />}
    </div>
  );
};

export default Layout;
