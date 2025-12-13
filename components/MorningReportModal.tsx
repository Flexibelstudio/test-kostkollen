
import React, { useEffect, useState, useRef } from 'react';
import { PastDaySummary, UserProfileData } from '../types';
import { CheckCircleIcon, XCircleIcon, FireIcon, TrophyIcon, SparklesIcon } from './icons';
import { getMorningBriefingText, getMorningBriefingAudio } from '../services/geminiService';
import { COACH_PERSONAS } from '../constants';
import { Volume2, VolumeX, PiggyBank } from 'lucide-react';

interface MorningReportModalProps {
  show: boolean;
  onClose: () => void;
  summary: PastDaySummary;
  currentStreak: number;
  userProfile: UserProfileData;
}

// Helper to decode raw PCM data from Gemini (16-bit, 24kHz, Mono)
const decodePCM = (base64: string, ctx: AudioContext): AudioBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create 16-bit view of the data
  const int16Data = new Int16Array(bytes.buffer);
  
  const sampleRate = 24000; // Gemini TTS default
  const channels = 1;
  const frameCount = int16Data.length;
  
  const buffer = ctx.createBuffer(channels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  // Normalize to [-1.0, 1.0]
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = int16Data[i] / 32768.0;
  }
  
  return buffer;
};

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

          // Use manual PCM decoding
          const audioBuffer = decodePCM(base64Audio, ctx);
          
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
  
  let CoachEmoji;
  let avatarColorClass;
  
  if (coachStyle === 'soft') {
      CoachEmoji = COACH_PERSONAS.soft.emoji;
      avatarColorClass = 'text-green-600 bg-green-100';
  } else if (coachStyle === 'hard') {
      CoachEmoji = COACH_PERSONAS.hard.emoji;
      avatarColorClass = 'text-red-600 bg-red-100';
  } else {
      CoachEmoji = COACH_PERSONAS.balanced.emoji;
      avatarColorClass = 'text-blue-600 bg-blue-100';
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

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 gap-3 mb-6 text-left">
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-light flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${currentStreak > 0 ? 'bg-orange-100 text-orange-600' : 'bg-neutral-light text-neutral-400'}`}>
                    <FireIcon className="w-7 h-7" />
                </div>
                <div>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Streak</p>
                    <p className="text-2xl font-extrabold text-neutral-dark leading-none">
                        {currentStreak} <span className="text-sm font-medium text-neutral ml-1">{currentStreak === 1 ? 'dag' : 'dagar'}</span>
                    </p>
                </div>
             </div>

             {isSuccess && bankedAmount > 0 && (
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-light flex items-center gap-4 animate-scale-in">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-darker shadow-sm flex-shrink-0">
                        <PiggyBank className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Sparpott</p>
                        <p className="text-2xl font-extrabold text-neutral-dark leading-none">
                            <span className="text-primary">+{bankedAmount}</span> <span className="text-sm font-medium text-neutral ml-1">kcal</span>
                        </p>
                    </div>
                 </div>
             )}
        </div>

        <hr className="border-neutral-light/60 mb-6" />

        {/* Coach Briefing */}
        <div className="text-left mb-8">
            <h3 className="text-sm font-bold text-neutral-dark mb-3 uppercase tracking-wide opacity-70">Dagens Briefing</h3>
            <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm ${avatarColorClass}`}>
                    <span className="text-2xl">{CoachEmoji}</span>
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
