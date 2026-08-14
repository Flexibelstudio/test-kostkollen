import React, { useEffect, useState, useRef } from 'react';
import { PastDaySummary, UserProfileData, LoggedMeal, WeightLogEntry } from '../types';
import { CheckCircleIcon, XCircleIcon, TrophyIcon, SparklesIcon } from './icons';
import { getMorningBriefingText, getMorningBriefingAudio } from '../services/geminiService';
import { COACH_PERSONAS } from '../constants';
import { Volume2, VolumeX, PiggyBank, Flame, Loader2, Target } from 'lucide-react';

interface MorningReportModalProps {
  show: boolean;
  onClose: () => void;
  summary: PastDaySummary;
  currentStreak: number;
  userProfile: UserProfileData;
  yesterdayMeals?: LoggedMeal[];
  yesterdayBootcampReport?: any;
  activeBootcamp?: any;
  pastDaysSummary?: PastDaySummary[];
  weightLogs?: WeightLogEntry[];
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

const MorningReportModal: React.FC<MorningReportModalProps> = ({ show, onClose, summary, currentStreak, userProfile, yesterdayMeals, yesterdayBootcampReport, activeBootcamp, pastDaysSummary, weightLogs }) => {
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const cachedAudioBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    if (show) {
      const fetchBriefing = async () => {
        setIsLoadingBriefing(true);
        const text = await getMorningBriefingText({ userProfile, summary, currentStreak, yesterdayMeals, yesterdayBootcampReport, activeBootcamp, pastDaysSummary, weightLogs });
        setBriefingText(text);
        setIsLoadingBriefing(false);
      };
      fetchBriefing();
    } else {
        setBriefingText(null);
        stopAudio();
        cachedAudioBufferRef.current = null;
    }
  }, [show, summary, currentStreak, userProfile, yesterdayMeals, yesterdayBootcampReport, activeBootcamp]);

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

      if (!briefingText || isGeneratingAudio) return;

      try {
          setIsGeneratingAudio(true);
          
          if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioContextRef.current;
          if (ctx.state === 'suspended') await ctx.resume();

          let audioBuffer = cachedAudioBufferRef.current;

          if (!audioBuffer) {
              const base64Audio = await getMorningBriefingAudio(briefingText, userProfile.coachStyle || 'balanced');
              
              if (!base64Audio) throw new Error("No audio returned");

              // Use manual PCM decoding
              audioBuffer = decodePCM(base64Audio, ctx);
              cachedAudioBufferRef.current = audioBuffer;
          }

          setIsGeneratingAudio(false);
          setIsPlayingAudio(true);
          
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => setIsPlayingAudio(false);
          source.start(0);
          audioSourceRef.current = source;

      } catch (error) {
          console.error("Failed to play audio", error);
          setIsGeneratingAudio(false);
          setIsPlayingAudio(false);
      }
  };

  if (!show) return null;

  const isSuccess = summary.goalMet;
  const bankedAmount = summary.bankedAmount || 0;
  
  const dateObj = new Date(summary.date);
  const dateString = dateObj.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  const coachStyle = userProfile.coachStyle || 'balanced';
  const persona = COACH_PERSONAS[coachStyle] || COACH_PERSONAS['balanced'];
  
  let CoachEmoji;
  let avatarColorClass;
  
  if (coachStyle === 'soft') {
      CoachEmoji = COACH_PERSONAS.soft.emoji;
      avatarColorClass = 'text-[#2B3B2C] bg-[#E8EFE9]';
  } else if (coachStyle === 'hard') {
      CoachEmoji = COACH_PERSONAS.hard.emoji;
      avatarColorClass = 'text-[#D96E4A] bg-[#F6E2D9]';
  } else {
      CoachEmoji = COACH_PERSONAS.balanced.emoji;
      avatarColorClass = 'text-[#56524D] bg-[#F1EAE0]';
  }

  let bootcampProgressCard = null;
  if (activeBootcamp && activeBootcamp.status === 'fas1') {
    // In Phase 1, the progress is determined by the current streak (number of consecutive green days)
    const currentBootcampStreak = activeBootcamp.currentStreak || 0;
    const progressPercent = Math.min(100, Math.round((currentBootcampStreak / 14) * 100));
    
    bootcampProgressCard = (
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-light flex items-center gap-4 animate-scale-in">
          <div className="w-12 h-12 rounded-xl bg-[#F6E2D9] flex items-center justify-center text-[#D96E4A] shadow-sm flex-shrink-0">
              <Target className="w-7 h-7" />
          </div>
          <div className="flex-1">
              <div className="flex justify-between items-end mb-1">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-0">Bootcamp Fas 1</p>
                  <span className="text-xs font-bold text-[#D96E4A]">{progressPercent}%</span>
              </div>
              <p className="text-xl font-extrabold text-neutral-dark leading-none mb-2">
                  Dag {currentBootcampStreak} <span className="text-sm font-medium text-neutral">av 14</span>
              </p>
              <div className="w-full bg-neutral-light rounded-full h-2">
                  <div className="bg-[#D96E4A] h-2 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
              </div>
          </div>
      </div>
    );
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
                <div className="w-20 h-20 bg-[#F6E2D9] rounded-full flex items-center justify-center animate-scale-in">
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
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${currentStreak > 0 ? 'bg-[#F6E2D9] text-[#D96E4A]' : 'bg-neutral-light text-neutral-400'}`}>
                    <Flame className="w-7 h-7" />
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

             {bootcampProgressCard}
        </div>

        <hr className="border-neutral-light/60 mb-6" />

        {/* Coach Briefing */}
        <div className="text-left mb-8">
            <h3 className="text-sm font-bold text-neutral-dark mb-3 uppercase tracking-wide opacity-70">Hälsning från {persona.label}, {persona.roleTitle}</h3>
            <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm ${avatarColorClass}`}>
                    {persona.imageUrl ? <img src={persona.imageUrl} alt={persona.label} className="w-full h-full object-cover rounded-2xl" /> : <span className="text-2xl">{CoachEmoji}</span>}
                </div>
                <div className="bg-neutral-light/40 p-4 rounded-2xl rounded-tl-none relative flex-1">
                    {isLoadingBriefing ? (
                        <div className="flex items-center gap-3 py-2 animate-fade-in">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${avatarColorClass} bg-opacity-20 animate-pulse`}>
                                {persona.imageUrl ? <img src={persona.imageUrl} alt={persona.label} className="w-full h-full object-cover rounded-full" /> : <span className="text-lg">{CoachEmoji}</span>}
                            </div>
                            <span className="text-neutral-500 text-sm font-medium italic animate-pulse">
                                {persona.label} analyserar din gårdag...
                            </span>
                        </div>
                    ) : (
                        <p className="text-neutral-dark text-base leading-relaxed animate-fade-in">
                            {briefingText || `God morgon ${userProfile.name || 'kompis'}! Hoppas du får en fantastisk dag!`}
                        </p>
                    )}
                    
                    {!isLoadingBriefing && briefingText && (
                        <button 
                            onClick={handlePlayAudio}
                            disabled={isGeneratingAudio}
                            className={`absolute -bottom-3 -right-3 p-2 rounded-full shadow-md transition-all active:scale-90 ${isPlayingAudio ? 'bg-secondary text-white animate-pulse' : 'bg-white text-neutral-dark hover:bg-gray-50'} ${isGeneratingAudio ? 'opacity-70 cursor-not-allowed' : ''}`}
                            aria-label={isPlayingAudio ? "Stoppa uppläsning" : "Lyssna på briefing"}
                        >
                            {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlayingAudio ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                    )}
                </div>
            </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 py-3.5 bg-primary text-white text-lg font-semibold rounded-xl shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform transition-all"
        >
          Starta dagen
        </button>
      </div>
    </div>
  );
};

export default MorningReportModal;