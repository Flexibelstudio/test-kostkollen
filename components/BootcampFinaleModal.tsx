import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Award, Volume2, VolumeX } from 'lucide-react';
import { BootcampParticipant } from '../types';
import { getBootcampRankInfo, BORJE_EXTRA_TEXTS } from '../utils/bootcampUtils';
import { BootcampDiplomaCard } from './BootcampDiplomaCard';
import { downloadDiplomaImage } from '../utils/diplomaImageExporter';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

interface BootcampFinaleModalProps {
  participant: BootcampParticipant;
  userName?: string;
  onClose: () => void;
  onGoToCourse: () => void;
}

export const BootcampFinaleModal: React.FC<BootcampFinaleModalProps> = ({ participant, userName = 'Bootcamp-deltagare', onClose, onGoToCourse }) => {
  const { width, height } = useWindowSize();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const rankInfo = getBootcampRankInfo(participant.longestStreak, participant.currentStreak, participant.status);

  // Finale rank definition with verbatim 12-week completion text
  const finaleRankDef = {
    ...rankInfo.rankDef,
    quote: BORJE_EXTRA_TEXTS.FINALE
  };

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-till-tal stöds inte i denna webbläsare.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`General Börjes slutord. ${BORJE_EXTRA_TEXTS.FINALE}`);
      utterance.lang = 'sv-SE';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadDiplomaImage(
        finaleRankDef,
        userName,
        participant.longestStreak
      );
    } catch (e) {
      console.error('Kunde inte ladda ner diplomet:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto custom-scrollbar">
        <Confetti width={width} height={height} recycle={false} numberOfPieces={600} />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="w-full max-w-xl my-auto relative flex flex-col gap-4"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between text-white px-2">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-[#D96E4A]" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#D96E4A]">
                  BOOTCAMP FULLFÖLJD!
                </p>
                <h3 className="text-lg font-extrabold font-serif">
                  12 Veckor i Truppen
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleSpeech}
                className={`p-2.5 rounded-full transition-all flex items-center justify-center ${
                  isSpeaking ? 'bg-[#D96E4A] text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isSpeaking ? 'Tysta uppläsning' : 'Läs upp Börjes slutord'}
              >
                {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <button
                onClick={onClose}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Diploma Card */}
          <div className="shadow-2xl">
            <BootcampDiplomaCard
              rankDef={finaleRankDef}
              userName={userName}
              streakDays={participant.longestStreak}
            />
          </div>

          {/* Navigation Actions */}
          <div className="bg-[#2B2825]/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#D96E4A]" />
              <span>{isDownloading ? 'Genererar bild...' : 'Ladda ner som bild'}</span>
            </button>

            <button
              onClick={onGoToCourse}
              className="w-full sm:w-auto px-6 py-3 bg-[#D96E4A] hover:bg-[#C05A38] text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#D96E4A]/30 active:scale-95"
            >
              Gå till Praktisk Viktkontroll
            </button>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/15 text-white/80 hover:text-white rounded-xl font-medium text-sm transition-colors"
            >
              Stäng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

