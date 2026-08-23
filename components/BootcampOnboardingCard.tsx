import React from 'react';
import { UserProfileData, BootcampOnboardingTaskId } from '../types';
import { 
  getBootcampAccessDetails, 
  ALL_BOOTCAMP_ONBOARDING_TASKS, 
  BOOTCAMP_ONBOARDING_TASKS_META 
} from '../utils/accessControl';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Circle, 
  Camera, 
  Search, 
  Droplet, 
  Scale, 
  FileText, 
  Clock,
  Sparkles,
  ChevronRight,
  Flame
} from 'lucide-react';

interface BootcampOnboardingCardProps {
  userProfile: UserProfileData;
  onActionClick: (taskId: BootcampOnboardingTaskId) => void;
  onManualCompleteTask?: (taskId: BootcampOnboardingTaskId) => void;
}

const TASK_ICONS: Record<BootcampOnboardingTaskId, React.ComponentType<{ className?: string }>> = {
  log_meal_photo: Camera,
  log_meal_search: Search,
  log_water: Droplet,
  weigh_in_and_goal: Scale,
  read_morning_briefing: FileText,
};

export const BootcampOnboardingCard: React.FC<BootcampOnboardingCardProps> = ({
  userProfile,
  onActionClick,
  onManualCompleteTask,
}) => {
  const details = getBootcampAccessDetails(userProfile);

  // Visa endast om användaren har köpt Bootcamp och grundutbildningen pågår
  if (!details.hasBootcamp || !details.isOnboarding) {
    return null;
  }

  const completedCount = details.onboardingTasksCompleted.length;
  const totalCount = ALL_BOOTCAMP_ONBOARDING_TASKS.length;
  const progressPercent = details.onboardingProgressPercent;

  return (
    <section 
      aria-label="Grundutbildning" 
      className="bg-[#2B3B2C] text-white rounded-3xl p-5 sm:p-6 shadow-soft-xl border border-[#4A5B4C] relative overflow-hidden transition-all"
    >
      {/* Bakgrundsdekor */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#D96E4A]/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12"></div>
      
      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#D96E4A] text-white flex items-center justify-center shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#D96E4A] bg-[#D96E4A]/20 px-2 py-0.5 rounded-md">
                Inmönstring
              </span>
              <span className="text-xs text-white/70 font-mono">
                {details.onboardingDaysLeft} {details.onboardingDaysLeft === 1 ? 'dygn kvar' : 'dygn kvar'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5 tracking-tight">
              Börjes Grundutbildning
            </h2>
          </div>
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-3 bg-white/10 px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60 leading-none">Status</p>
            <p className="text-sm font-extrabold text-white leading-tight font-mono">
              {completedCount} av {totalCount} klara
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#D96E4A]/30 border border-[#D96E4A] flex items-center justify-center text-xs font-bold text-white font-mono">
            {progressPercent}%
          </div>
        </div>
      </div>

      {/* Börjes Röst & Instruktion */}
      <div className="relative z-10 bg-black/20 p-3.5 rounded-2xl border border-white/5 mb-4">
        <p className="text-sm text-white/90 font-medium italic leading-relaxed">
          ”Givakt! Innan du marscherar lär du dig hantera din utrustning. Utför dessa fem uppgifter så att du är fullt operativ när fältveckorna brakar loss.”
        </p>
        <p className="text-[11px] text-white/60 mt-1.5">
          ℹ️ Dina 12 veckors Bootcamp räknas först <em>efter</em> grundutbildningen. Programmet startar direkt när uppgifterna är klara, eller automatiskt efter 3 dygn.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10 w-full bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
        <div 
          className="bg-[#D96E4A] h-full rounded-full transition-all duration-500 shadow-sm"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* Checklista */}
      <div className="relative z-10 space-y-2.5">
        {ALL_BOOTCAMP_ONBOARDING_TASKS.map((taskId, index) => {
          const taskMeta = BOOTCAMP_ONBOARDING_TASKS_META[taskId];
          const isDone = details.onboardingTasksCompleted.includes(taskId);
          const IconComponent = TASK_ICONS[taskId];

          return (
            <div 
              key={taskId}
              className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDone 
                  ? 'bg-white/5 border-emerald-500/30 text-white/80' 
                  : 'bg-white/10 border-white/15 hover:border-[#D96E4A]/50 text-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isDone 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-white/10 text-[#D96E4A]'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <IconComponent className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-white/40 font-mono">0{index + 1}</span>
                    <h3 className={`text-sm font-bold leading-tight ${isDone ? 'line-through text-white/60' : 'text-white'}`}>
                      {taskMeta.title}
                    </h3>
                  </div>
                  <p className="text-xs text-white/70 mt-0.5">
                    {taskMeta.description}
                  </p>
                </div>
              </div>

              {/* Action knapp */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {isDone ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 border border-emerald-500/30 font-mono">
                    Klar ✓
                  </span>
                ) : (
                  <button
                    onClick={() => onActionClick(taskId)}
                    className="px-3.5 py-1.5 bg-[#D96E4A] hover:bg-[#c45e3c] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 active:scale-95 whitespace-nowrap"
                  >
                    <span>{taskMeta.actionLabel}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default BootcampOnboardingCard;
