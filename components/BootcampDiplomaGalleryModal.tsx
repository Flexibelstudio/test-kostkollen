import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Award, Medal, CheckCircle2 } from 'lucide-react';
import { BOOTCAMP_RANKS, BootcampRankDef } from '../utils/bootcampUtils';
import { BootcampDiplomaModal } from './BootcampDiplomaModal';
import { RankBadge } from './RankBadge';

interface BootcampDiplomaGalleryModalProps {
  longestStreak: number;
  userName: string;
  status?: string;
  onClose: () => void;
  onShareInFeed?: (diplomaData: { rankDef: BootcampRankDef; userName: string; streakDays: number }) => Promise<void> | void;
}

export const BootcampDiplomaGalleryModal: React.FC<BootcampDiplomaGalleryModalProps> = ({
  longestStreak,
  userName,
  status = 'fas1',
  onClose,
  onShareInFeed
}) => {
  const effectiveStreak = status === 'fas2' ? Math.max(14, longestStreak) : longestStreak;
  const [selectedRankForDiploma, setSelectedRankForDiploma] = useState<BootcampRankDef | null>(null);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto custom-scrollbar">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#FAF6EF] dark:bg-[#3D3935] text-[#56524D] dark:text-[#FAF6EF] w-full max-w-4xl rounded-3xl p-6 sm:p-8 shadow-2xl my-auto border border-[#56524D]/10 dark:border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#56524D]/15 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#D96E4A]/10 text-[#D96E4A] flex items-center justify-center">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs uppercase font-bold tracking-widest text-[#D96E4A]">
                  GENERALENS BOOTCAMP
                </p>
                <h2 className="text-2xl font-black font-serif">
                  Mina Diplom & Grader
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-[#F1EAE0] dark:bg-[#2B2825] hover:bg-[#D96E4A] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-[#7A756E] dark:text-[#FAF6EF]/70 mb-6 font-normal">
            Här samlas alla dina förtjänade befordringsbevis under din bootcampresa. Klicka på en uppnådd grad för att granska, läsa upp Börjes order, dela eller ladda ner ditt diplom.
          </p>

          {/* Ranks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
            {BOOTCAMP_RANKS.map((rank) => {
              const isUnlocked = effectiveStreak >= rank.req;

              return (
                <div
                  key={rank.name}
                  onClick={() => {
                    if (isUnlocked) {
                      setSelectedRankForDiploma(rank);
                    }
                  }}
                  className={`rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 border ${
                    isUnlocked
                      ? 'bg-white dark:bg-[#2B2825] border-[#D96E4A]/30 shadow-sm hover:shadow-md hover:border-[#D96E4A] cursor-pointer group'
                      : 'bg-[#F1EAE0]/50 dark:bg-[#2B2825]/40 border-dashed border-[#56524D]/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isUnlocked 
                        ? 'bg-[#F6E2D9] text-[#D96E4A] dark:bg-[#D96E4A]/20 dark:text-[#D96E4A]'
                        : 'bg-[#56524D]/10 text-[#7A756E]'
                    }`}>
                      {rank.req === 0 ? 'Mönstring' : `${rank.req} dagar`}
                    </span>

                    {isUnlocked ? (
                      <CheckCircle2 className="w-5 h-5 text-[#2B3B2C]" />
                    ) : (
                      <Lock className="w-4 h-4 text-[#7A756E]" />
                    )}
                  </div>

                  <div className="flex flex-col items-center text-center my-2">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center p-2 mb-2 ${
                      isUnlocked ? 'bg-[#FAF6EF] dark:bg-[#34302C]' : 'bg-[#56524D]/5'
                    }`}>
                      <RankBadge
                        rank={rank.name}
                        size="md"
                        className={isUnlocked ? '' : 'grayscale opacity-40'}
                      />
                    </div>

                    <h3 className="text-lg font-bold font-serif group-hover:text-[#D96E4A] transition-colors">
                      {rank.name}
                    </h3>
                    <p className="text-xs text-[#7A756E] dark:text-[#FAF6EF]/70 font-medium mt-0.5">
                      {isUnlocked ? rank.achievementText : `Kräver ${rank.req} dagars streak`}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#56524D]/10 dark:border-white/10 text-center">
                    {isUnlocked ? (
                      <span className="text-xs font-bold text-[#D96E4A] group-hover:underline">
                        Visa Diplom →
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#7A756E]">
                        Låst grad
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-[#56524D]/10 dark:border-white/10 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#D96E4A] text-white rounded-xl font-bold hover:bg-[#C05A38] transition-colors"
            >
              Stäng Samling
            </button>
          </div>
        </motion.div>

        {/* Selected Diploma Viewer Modal */}
        {selectedRankForDiploma && (
          <BootcampDiplomaModal
            rankDef={selectedRankForDiploma}
            userName={userName}
            streakDays={Math.max(selectedRankForDiploma.req, longestStreak)}
            onClose={() => setSelectedRankForDiploma(null)}
            onShareInFeed={onShareInFeed}
            isNewPromotion={false}
          />
        )}
      </div>
    </AnimatePresence>
  );
};
