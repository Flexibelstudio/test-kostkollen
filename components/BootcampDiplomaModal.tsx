import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Volume2, VolumeX, CheckCircle } from 'lucide-react';
import { BootcampRankDef } from '../utils/bootcampUtils';
import { BootcampDiplomaCard } from './BootcampDiplomaCard';
import { downloadDiplomaImage } from '../utils/diplomaImageExporter';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

interface BootcampDiplomaModalProps {
  rankDef: BootcampRankDef;
  userName: string;
  streakDays: number;
  promotionDate?: string;
  onClose: () => void;
  onShareInFeed?: (diplomaData: { rankDef: BootcampRankDef; userName: string; streakDays: number }) => Promise<void> | void;
  isNewPromotion?: boolean;
}

export const BootcampDiplomaModal: React.FC<BootcampDiplomaModalProps> = ({
  rankDef,
  userName,
  streakDays,
  promotionDate,
  onClose,
  onShareInFeed,
  isNewPromotion = true
}) => {
  const { width, height } = useWindowSize();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    // Cleanup speech synthesis on unmount
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
      const textToRead = `General Börjes hälsning för graden ${rankDef.name}. ${rankDef.quote}`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
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
      await downloadDiplomaImage(rankDef, userName, streakDays, promotionDate);
    } catch (err) {
      console.error('Kunde inte ladda ner diplomet som bild:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (onShareInFeed && !isShared) {
      setIsSharing(true);
      try {
        await onShareInFeed({ rankDef, userName, streakDays });
        setIsShared(true);
      } catch (e) {
        console.error('Delning misslyckades:', e);
      } finally {
        setIsSharing(false);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
        {isNewPromotion && <Confetti width={width} height={height} recycle={false} numberOfPieces={600} />}

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="w-full max-w-xl my-auto relative flex flex-col gap-4"
        >
          {/* Top Control Bar */}
          <div className="flex items-center justify-between text-white px-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎖️</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#D96E4A]">
                  {isNewPromotion ? 'NY BEFORDRAN!' : 'DIPLOMSAMLING'}
                </p>
                <h3 className="text-lg font-extrabold text-white font-serif">
                  {rankDef.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleSpeech}
                className={`p-2.5 rounded-full transition-all interactive-transition flex items-center justify-center ${
                  isSpeaking ? 'bg-[#D96E4A] text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isSpeaking ? 'Tysta uppläsning' : 'Läs upp Börjes hälsning'}
                aria-label="Text-till-tal"
              >
                {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <button
                onClick={onClose}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors interactive-transition"
                aria-label="Stäng diplom"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* The Diploma Document Card */}
          <div className="shadow-2xl">
            <BootcampDiplomaCard
              rankDef={rankDef}
              userName={userName}
              streakDays={streakDays}
              promotionDate={promotionDate}
            />
          </div>

          {/* Action Buttons Footer */}
          <div className="bg-[#2B2825]/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#D96E4A]" />
              <span>{isDownloading ? 'Genererar bild...' : 'Ladda ner som bild'}</span>
            </button>

            {onShareInFeed && (
              <button
                onClick={handleShare}
                disabled={isSharing || isShared}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${
                  isShared 
                    ? 'bg-[#E8EFE9] text-[#2B3B2C] border border-[#2B3B2C]/30 cursor-default'
                    : 'bg-[#D96E4A] hover:bg-[#C05A38] text-white shadow-lg shadow-[#D96E4A]/30'
                }`}
              >
                {isShared ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Delat i flödet!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>{isSharing ? 'Delar...' : 'Dela i flödet'}</span>
                  </>
                )}
              </button>
            )}

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
