
import React, { useEffect, useState, useRef } from 'react';
import { PastDaySummary, UserProfileData } from '../types';
import { CheckCircleIcon, XCircleIcon, FireIcon, TrophyIcon, SparklesIcon, MedalIcon, HeartIcon } from './icons';
import { getMorningBriefingText, getMorningBriefingAudio } from '../services/geminiService';
import { COACH_PERSONAS } from '../constants';
import { Volume2, VolumeX } from 'lucide-react';

interface MorningReportModalProps {
  show: boolean;
  onClose: () => void;
  summary: PastDaySummary;
  currentStreak: number;
  userProfile: UserProfileData;
}

const MorningReportModal: React.FC<MorningReportModalProps> = ({ show, onClose, summary, currentStreak, userProfile }) => {
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (show) {
      const fetchBriefing = async () => {
        setIsLoadingBriefing(true);
        const text = await getMorningBriefingText({ userProfile, summary, currentStreak });
        setBriefingText(text);
        setIsLoadingBriefing(false);
      };
      fetchBriefing();
    } else {
        setBriefingText(null);
        stopAudio();
    }
  }, [show, summary, currentStreak, userProfile]);

  const stopAudio = () => {
      if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch(e) {}
          audioSourceRef.current = null;
      }
      setIsPlayingAudio(false);
  };

  const handlePlayAudio = async () => {
      if (isPlayingAudio) {
          stopAudio();
          return;
      }

      if (!briefingText) return;

      try {
          setIsPlayingAudio(true);
          const base64Audio = await getMorningBriefingAudio(briefingText, userProfile.coachStyle || 'balanced');
          
          if (!base64Audio) throw new Error("No audio returned");

          if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioContextRef.current;
          if (ctx.state === 'suspended') await ctx.resume();

          const binaryString = window.atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }

          const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => setIsPlayingAudio(false);
          source.start(0);
          audioSourceRef.current = source;

      } catch (error) {
          console.error("Failed to play audio", error);
          setIsPlayingAudio(false);
      }
  };

  if (!show) return null;

  const isSuccess = summary.goalMet;
  const bankedAmount = summary.bankedAmount || 0;
  
  const dateObj = new Date(summary.date);
  const dateString = dateObj.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  const coachStyle = userProfile.coachStyle || 'balanced';
  const persona = COACH_PERSONAS[coachStyle];

  let AvatarIcon = SparklesIcon;
  let avatarColorClass = 'text-blue-500 bg-blue-100';
  
  if (coachStyle === 'soft') {
      AvatarIcon = HeartIcon;
      avatarColorClass = 'text-green-600 bg-green-100';
  } else if (coachStyle === 'hard') {
      AvatarIcon = MedalIcon;
      avatarColorClass = 'text-red-600 bg-red-100';
  }

  return (
    <div 
        className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-md flex items-center justify-center z-[80] p-4 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="morning-report-title"
    >
      <div 
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl text-center max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex justify-center">
            {isSuccess ? (
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center animate-check-pop-in">
                    <CheckCircleIcon className="w-12 h-12 text-primary" />
                </div>
            ) : (
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center animate-scale-in">
                    <div className="text-4xl">🌅</div>
                </div>
            )}
        </div>

        <h2 id="morning-report-title" className="text-2xl sm:text-3xl font-bold text-neutral-dark mb-2">
          {isSuccess ? "Snyggt jobbat!" : "Ny dag, nya tag!"}
        </h2>
        
        <p className="text-neutral-dark text-lg mb-6">
            Här är resultatet för <span className="font-medium capitalize">{dateString}</span>:
        </p>

        {/* Stats Summary */}
        <div className="flex items-center justify-center gap-4 mb-6">
             <div className="flex flex-col items-center bg-neutral-light/50 p-3 rounded-lg min-w-[80px]">
                <FireIcon className={`w-6 h-6 mb-1 ${currentStreak > 0 ? 'text-secondary' : 'text-neutral'}`} />
                <span className="text-xs font-semibold text-neutral">Streak</span>
                <span className="text-lg font-bold text-neutral-dark">{currentStreak}</span>
             </div>
             {isSuccess && bankedAmount > 0 && (
                 <div className="flex flex-col items-center bg-primary-50 p-3 rounded-lg min-w-[80px]">
                    <span className="text-xl mb-1">🏦</span>
                    <span className="text-xs font-semibold text-primary-darker">Sparpott</span>
                    <span className="text-lg font-bold text-primary">+{bankedAmount}</span>
                 </div>
             )}
        </div>

        <hr className="border-neutral-light/60 mb-6" />

        {/* Coach Briefing */}
        <div className="text-left mb-8">
            <h3 className="text-sm font-bold text-neutral-dark mb-3 uppercase tracking-wide opacity-70">Dagens Briefing</h3>
            <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ${avatarColorClass}`}>
                    <AvatarIcon className="w-7 h-7" />
                </div>
                <div className="bg-neutral-light/40 p-4 rounded-2xl rounded-tl-none relative flex-1">
                    {isLoadingBriefing ? (
                        <div className="flex items-center gap-2 text-neutral">
                            <div className="w-2 h-2 bg-neutral/40 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-neutral/40 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-neutral/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                    ) : (
                        <p className="text-neutral-dark text-base leading-relaxed animate-fade-in">
                            {briefingText}
                        </p>
                    )}
                    
                    {!isLoadingBriefing && briefingText && (
                        <button 
                            onClick={handlePlayAudio}
                            className={`absolute -bottom-3 -right-3 p-2 rounded-full shadow-md transition-all active:scale-90 ${isPlayingAudio ? 'bg-secondary text-white animate-pulse' : 'bg-white text-neutral-dark hover:bg-gray-50'}`}
                            aria-label={isPlayingAudio ? "Stoppa uppläsning" : "Lyssna på briefing"}
                        >
                            {isPlayingAudio ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                    )}
                </div>
            </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 py-3.5 bg-primary text-white text-lg font-semibold rounded-xl shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform transition-all"
        >
          Starta dagen! 🚀
        </button>
      </div>
    </div>
  );
};

export default MorningReportModal;
