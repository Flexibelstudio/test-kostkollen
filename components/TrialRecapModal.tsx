import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from './icons';
import { Flame, PiggyBank, Sparkles, BookOpen, Camera, MessageSquarePlus, Trophy } from 'lucide-react';

interface TrialRecapModalProps {
  show: boolean;
  onClose: () => void;
  userName: string;
  currentStreak: number;
  totalMealsLogged: number;
  bankedCalories: number;
  coachStyle: 'soft' | 'balanced' | 'hard';
  onOpenSubscription: () => void;
  hasLowUsage: boolean;
}

export const TrialRecapModal: React.FC<TrialRecapModalProps> = ({
  show,
  onClose,
  userName,
  currentStreak,
  totalMealsLogged,
  bankedCalories,
  coachStyle,
  onOpenSubscription,
  hasLowUsage,
}) => {
  if (!show) return null;

  const handleCancelClick = () => {
    onClose();
    onOpenSubscription();
  };

  const getCoachMessage = () => {
    switch (coachStyle) {
      case 'soft':
        return 'Fortsätt lyssna på din kropp och ta en dag i taget, du gör ett fantastiskt jobb!';
      case 'hard':
        return 'Bra fart! Fortsätt fokusera på målet och låt inte uppehåll bryta din disciplin. Kör hårt!';
      case 'balanced':
      default:
        return 'Riktigt starkt jobbat! Du lägger grunden för en hälsosammare livsstil nu, steg för steg.';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-neutral-dark/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
        {/* Backdrop clickable */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white dark:bg-neutral-dark rounded-3xl shadow-soft-xl w-full max-w-lg overflow-hidden relative z-10 border border-neutral-light/10"
        >
          {/* Header Image/Pattern */}
          <div className="bg-gradient-to-br from-[#D96E4A] to-[#C05A38] px-6 py-8 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              aria-label="Stäng"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                Kostloggen Premium
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Hej {userName || 'vännen'}! 👋
            </h2>
            <p className="text-[#F6E2D9] text-sm sm:text-base mt-2 font-medium leading-relaxed">
              Om 2 dagar tar din gratisperiod slut. Se efter hur mycket du redan hunnit utforska och uppnå!
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
            {hasLowUsage ? (
              // LOW USAGE VIEW (Fallback)
              <div className="space-y-5">
                <p className="text-sm text-neutral font-medium mb-2 leading-relaxed">
                  Du har inte hunnit logga så mycket än – men det finns massor av spännande funktioner kvar att upptäcka för att nå dina mål och få resultat på ett kul sätt!
                </p>

                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Tre smarta funktioner du inte får missa:
                </h3>

                <div className="space-y-4">
                  {/* Feature 1 */}
                  <div className="flex gap-4 items-start p-3 rounded-2xl hover:bg-neutral-light/40 transition-colors border border-black/5">
                    <div className="w-10 h-10 rounded-xl bg-[#F6E2D9] flex items-center justify-center text-[#D96E4A] flex-shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-dark text-sm">📸 Fota din mat</h4>
                      <p className="text-xs text-neutral leading-relaxed mt-0.5">
                        Fota din tallrik så analyserar vår AI bilden och beräknar kalorier och näringsvärden direkt. Snabbt, enkelt och lärorikt!
                      </p>
                    </div>
                  </div>

                  {/* Feature 2 */}
                  <div className="flex gap-4 items-start p-3 rounded-2xl hover:bg-neutral-light/40 transition-colors border border-black/5">
                    <div className="w-10 h-10 rounded-xl bg-[#F6E2D9] flex items-center justify-center text-[#D96E4A] flex-shrink-0">
                      <MessageSquarePlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-dark text-sm">💬 Din personliga AI-Coach</h4>
                      <p className="text-xs text-neutral leading-relaxed mt-0.5">
                        Få kostråd, smarta pepp eller skarpa tips dygnet runt. Coachen anpassar sig helt efter ditt valda coachläge!
                      </p>
                    </div>
                  </div>

                  {/* Feature 3 */}
                  <div className="flex gap-4 items-start p-3 rounded-2xl hover:bg-neutral-light/40 transition-colors border border-black/5">
                    <div className="w-10 h-10 rounded-xl bg-[#F6E2D9] flex items-center justify-center text-[#D96E4A] flex-shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-dark text-sm">🎓 Kurser & Utmaningar</h4>
                      <p className="text-xs text-neutral leading-relaxed mt-0.5">
                        Gå korta kurser om tex. klimakteriet eller viktnedgång och tävla i utmaningar för att skapa hälsosamma vanor som håller.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ENGAGED USER VIEW (Recap stats)
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Din första vecka i siffror:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Streak Card */}
                  <div className="bg-[#F6E2D9]/40 border border-[#F6E2D9] p-4 rounded-2xl text-center flex flex-col items-center justify-center">
                    <Flame className="w-7 h-7 text-[#D96E4A] mb-1.5" />
                    <span className="text-lg font-extrabold text-neutral-dark">
                      {currentStreak || 0} {currentStreak === 1 ? 'dag' : 'dagar'}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium">Aktiv streak 🔥</span>
                  </div>

                  {/* Meals Logged Card */}
                  <div className="bg-[#E8EFE9] border border-[#8C9A86]/40 p-4 rounded-2xl text-center flex flex-col items-center justify-center">
                    <Trophy className="w-7 h-7 text-[#8C9A86] mb-1.5" />
                    <span className="text-lg font-extrabold text-neutral-dark">
                      {totalMealsLogged || 0} {totalMealsLogged === 1 ? 'måltid' : 'måltider'}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium">Loggade måltider 🍽️</span>
                  </div>

                  {/* Calories Saved Card */}
                  <div className="bg-[#F1EAE0] border border-[#E2D8CC] p-4 rounded-2xl text-center flex flex-col items-center justify-center">
                    <PiggyBank className="w-7 h-7 text-[#56524D] mb-1.5" />
                    <span className="text-lg font-extrabold text-neutral-dark">
                      {bankedCalories || 0} kcal
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium">Samlat i sparpotten 💰</span>
                  </div>
                </div>

                {/* AI Coach Row */}
                <div className="flex gap-3 bg-neutral-light/40 p-4 rounded-2xl border border-black/5 items-start mt-4">
                  <div className="w-9 h-9 rounded-full bg-[#E8EFE9] flex items-center justify-center text-[#8C9A86] flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-dark dark:text-white text-xs uppercase tracking-wider">Hälsning från din personliga AI-coach</h4>
                    <p className="text-xs text-neutral mt-1 italic leading-relaxed">
                      "{getCoachMessage()}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons & Outros */}
            <div className="space-y-4 pt-4 border-t border-neutral-light/15">
              <button
                onClick={onClose}
                className="w-full bg-primary hover:bg-primary-darker text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-transform active:scale-95 text-center text-sm"
              >
                Fortsätt min resa
              </button>

              <div className="text-center">
                <button
                  onClick={handleCancelClick}
                  className="text-[11px] text-neutral-500 hover:text-red-500 underline transition-colors"
                >
                  Vill du inte fortsätta? Avsluta här – inga frågor, inget krångel.
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
