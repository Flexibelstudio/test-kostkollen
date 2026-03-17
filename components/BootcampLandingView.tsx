import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, ShieldCheckIcon, UsersIcon, UserIcon, KeyIcon, CheckCircleIcon } from './icons';
import { BootcampCohort, UserProfileData, GoalSettings } from '../types';
import { subscribeToPublicCohorts, joinSoloBootcamp, joinCohort } from '../services/bootcampService';
import { auth } from '../firebase';
import ToastNotification from './ToastNotification';
import UserProfileModal from './UserProfileModal';

interface BootcampLandingViewProps {
  onBack: () => void;
  userProfile: UserProfileData;
  goals: GoalSettings;
  onJoinSuccess: (profileUpdates: UserProfileData, goalUpdates: GoalSettings) => Promise<void>;
}

const BootcampLandingView: React.FC<BootcampLandingViewProps> = ({ onBack, userProfile, goals, onJoinSuccess }) => {
  const [publicCohorts, setPublicCohorts] = useState<BootcampCohort[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<BootcampCohort | 'solo' | string | null>(null); // string is for invite code

  useEffect(() => {
    const unsubscribe = subscribeToPublicCohorts((cohorts) => {
      setPublicCohorts(cohorts);
    });
    return () => unsubscribe();
  }, []);

  const handleJoinSolo = () => {
    setSelectedCohort('solo');
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setSelectedCohort(inviteCode);
  };

  const handleJoinPublicCohort = (cohort: BootcampCohort) => {
    setSelectedCohort(cohort);
  };

  const handleConfirmJoin = async (updatedProfile: UserProfileData, updatedGoals: GoalSettings) => {
    if (!auth.currentUser || !selectedCohort) return;
    setIsJoining(true);
    try {
      let result;
      if (selectedCohort === 'solo') {
        result = await joinSoloBootcamp(auth.currentUser.uid);
      } else if (typeof selectedCohort === 'string') {
        result = await joinCohort(auth.currentUser.uid, selectedCohort);
      } else {
        result = await joinCohort(auth.currentUser.uid, selectedCohort.inviteCode);
      }

      if (result.success) {
        setToast({ message: result.message, type: 'success' });
        await onJoinSuccess(updatedProfile, updatedGoals);
        setTimeout(() => onBack(), 2000);
      } else {
        setToast({ message: result.message, type: 'error' });
      }
    } catch (error) {
      console.error("Error joining bootcamp:", error);
      setToast({ message: 'Ett fel uppstod. Försök igen.', type: 'error' });
    } finally {
      setIsJoining(false);
      setSelectedCohort(null);
    }
  };

  return (
    <div className="animate-fade-in pb-20">
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-dark hover:text-primary transition-colors mb-6 font-bold"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Tillbaka till Kurser
      </button>

      {/* Hero Section */}
      <div className="bg-neutral-darker text-white p-8 rounded-3xl shadow-soft-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary mb-6">
            <ShieldCheckIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4">General Börjes 12-veckors Bootcamp</h1>
          <p className="text-lg text-neutral-300 mb-6 max-w-2xl">
            Detta är inget för veklingar. Vi ska krossa fettet med disciplin och tydliga regler. 
            Antingen mönstrar du in i en trupp och krigar tillsammans med andra, eller så kör du solo.
          </p>
          
          <div className="bg-black/30 p-6 rounded-2xl border border-white/10">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircleIcon className="w-6 h-6 text-primary" />
              Reglementet (Krav för en Grön Dag)
            </h3>
            <ul className="space-y-3 text-neutral-300">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>Total Loggningsplikt:</strong> All mat och dryck ska loggas. Inget slarv!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>Proteinkravet:</strong> Nå ditt proteinmål varje dag (minst 1,5g / kg kroppsvikt).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>Vätskekontroll:</strong> Minst 2 liter rent vatten per dygn.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>Stegmålet:</strong> Minst 10 000 steg per dag. Inga undantag!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>Kvällsrapport:</strong> Du måste lämna din rapport till Generalen varje kväll.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Public Cohorts */}
        <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <UsersIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-dark">Kommande Truppstarter</h2>
              <p className="text-sm text-neutral-500">Kör tillsammans med andra i en gemensam chatt.</p>
            </div>
          </div>

          {publicCohorts.length === 0 ? (
            <div className="text-center py-8 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
              <p className="text-neutral-500 font-medium">Inga öppna trupper just nu.</p>
              <p className="text-sm text-neutral-400 mt-1">Kolla in Solo-alternativet istället!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publicCohorts.map(cohort => (
                <div key={cohort.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-neutral-dark">{cohort.name}</h3>
                    <p className="text-sm text-neutral-500">Startar: {cohort.startDate}</p>
                  </div>
                  <button
                    onClick={() => handleJoinPublicCohort(cohort)}
                    disabled={isJoining}
                    className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-darker transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Gå med
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Solo Start */}
        <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-dark">Starta Solo Nu</h2>
              <p className="text-sm text-neutral-500">Vill du inte vänta? Mönstra in direkt.</p>
            </div>
          </div>

          <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200 text-center">
            <p className="text-neutral-dark mb-6">
              Du följer exakt samma hårda regler och övervakas av AI-Generalen, men du krigar ensam utan gemensam chattgrupp.
            </p>
            <button
              onClick={handleJoinSolo}
              disabled={isJoining}
              className="w-full py-4 bg-neutral-darker text-white font-bold rounded-xl hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheckIcon className="w-5 h-5" />
              Starta Bootcamp Solo
            </button>
          </div>
        </div>
      </div>

      {/* Private Invite Code */}
      <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
            <KeyIcon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-neutral-dark">Har du en inbjudningskod?</h2>
        </div>
        <p className="text-sm text-neutral-500 mb-4">
          Om du har fått en kod till en privat trupp (t.ex. via ditt företag), fyll i den här.
        </p>
        <form onSubmit={handleJoinWithCode} className="flex gap-3">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="T.ex. BÖRJE-APRIL"
            className="flex-1 p-3 rounded-xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
            required
          />
          <button
            type="submit"
            disabled={isJoining || !inviteCode.trim()}
            className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-darker transition-colors disabled:opacity-50"
          >
            Gå med
          </button>
        </form>
      </div>

      {selectedCohort && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setSelectedCohort(null)}>
          <div onClick={e => e.stopPropagation()} className="animate-scale-in w-full max-w-2xl">
            <UserProfileModal
              initialProfile={userProfile}
              onSave={async (updatedProfile, updatedGoals, newPhotoDataUrl) => {
                updatedProfile.coachStyle = 'tough'; // Force Börje
                await handleConfirmJoin(updatedProfile, updatedGoals);
              }}
              onClose={() => setSelectedCohort(null)}
              isOnboarding={true}
              onboardingStep="form"
              isBootcampOnboarding={true}
              onSubscribeToPush={async () => false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BootcampLandingView;
