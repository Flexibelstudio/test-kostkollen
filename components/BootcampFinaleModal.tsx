import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { BootcampParticipant } from '../types';
import { getBootcampRankInfo } from '../utils/bootcampUtils';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

interface BootcampFinaleModalProps {
  participant: BootcampParticipant;
  onClose: () => void;
  onGoToCourse: () => void;
}

export const BootcampFinaleModal: React.FC<BootcampFinaleModalProps> = ({ participant, onClose, onGoToCourse }) => {
  const [step, setStep] = useState<'video' | 'diploma'>('video');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { width, height } = useWindowSize();

  const rankInfo = getBootcampRankInfo(participant.longestStreak, participant.currentStreak, participant.status);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.error("Video play failed:", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const handleVideoEnded = () => {
    setStep('diploma');
  };

  const togglePlay = () => setIsPlaying(!isPlaying);
  const toggleMute = () => setIsMuted(!isMuted);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
        {step === 'diploma' && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative border border-neutral-800"
        >
          {step === 'video' ? (
            <div className="relative aspect-[9/16] bg-black flex flex-col">
              <video
                ref={videoRef}
                src="/general-avslutning.mp4"
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted={isMuted}
                onEnded={handleVideoEnded}
              />
              
              {/* Video Controls Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
              
              <div className="absolute top-4 right-4 flex space-x-2">
                <button onClick={toggleMute} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md transition-colors pointer-events-auto">
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button onClick={() => setStep('diploma')} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md transition-colors pointer-events-auto">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-between items-center pointer-events-auto">
                <button onClick={togglePlay} className="p-3 bg-primary hover:bg-primary-dark rounded-full text-white shadow-lg transition-transform active:scale-95">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
                <button 
                  onClick={() => setStep('diploma')}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full font-medium transition-colors"
                >
                  Hoppa över
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-yellow-500/30 border-4 border-neutral-800">
                <span className="text-5xl">🎖️</span>
              </div>
              
              <h2 className="text-3xl font-extrabold text-white mb-2">Bootcamp Slutförd!</h2>
              <p className="text-neutral-400 mb-8">General Börje gör honnör för din insats.</p>
              
              <div className="bg-neutral-800 rounded-xl p-6 mb-8 border border-neutral-700">
                <div className="mb-4">
                  <p className="text-sm text-neutral-400 uppercase tracking-wider font-semibold mb-1">Din Slutgiltiga Grad</p>
                  <p className="text-3xl font-black text-primary">{rankInfo.currentRank}</p>
                </div>
                
                <div className="h-px w-full bg-neutral-700 my-4" />
                
                <div>
                  <p className="text-sm text-neutral-400 uppercase tracking-wider font-semibold mb-1">Längsta Streak</p>
                  <p className="text-2xl font-bold text-white">{participant.longestStreak} <span className="text-lg text-neutral-500 font-normal">dagar</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={onGoToCourse}
                  className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-primary/20"
                >
                  Gå till Praktisk Viktkontroll
                </button>
                <button 
                  onClick={onClose}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors"
                >
                  Stäng och återgå
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
