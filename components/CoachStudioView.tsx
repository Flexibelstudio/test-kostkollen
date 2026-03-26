import React, { useState, useRef, useEffect } from 'react';
import { COACH_PERSONAS } from '../constants';
import { createUserPost } from '../services/firestoreService';
import { GoogleGenAI } from '@google/genai';
import { PostCategory } from '../types';
import { SparklesIcon } from './icons';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CoachStudioViewProps {
  currentUser: any;
  setToastNotification: (notif: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  onPublish?: (draft: string, category: PostCategory, coach: any) => Promise<void>;
  lockedCoach?: keyof typeof COACH_PERSONAS;
  className?: string;
  hideCategory?: boolean;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const CoachStudioView: React.FC<CoachStudioViewProps> = ({ currentUser, setToastNotification, onPublish, lockedCoach, className, hideCategory }) => {
  const [selectedCoach, setSelectedCoach] = useState<keyof typeof COACH_PERSONAS>(lockedCoach || 'balanced');
  const [brief, setBrief] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentDraft, setCurrentDraft] = useState('');
  const [category, setCategory] = useState<PostCategory>('general');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isGenerating]);

  const handleGenerate = async () => {
    if (!brief.trim()) return;

    if (!process.env.GEMINI_API_KEY) {
      setToastNotification({ message: 'Gemini API-nyckel saknas.', type: 'error' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const userMessage = brief.trim();
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setBrief('');
    setIsGenerating(true);

    try {
      const coach = COACH_PERSONAS[selectedCoach];
      
      const systemInstruction = `Du är en AI-coach som hjälper en admin att skriva inlägg till ett hälso-community.
Din persona: ${coach.promptTone}
Din uppgift: Skriv ett inlägg baserat på användarens instruktioner. Inlägget ska vara färdigt att publiceras direkt i communityt.
Svara BARA med inläggets text. Inga inledande fraser som "Här är ett förslag" eller liknande.
Om användaren ber dig ändra något, skriv om hela inlägget med ändringarna applicerade.`;

      const historyContents = chatHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const contents = [
        ...historyContents,
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents as any,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const generatedText = response.text?.trim() || '';
      setChatHistory(prev => [...prev, { role: 'model', text: generatedText }]);
      setCurrentDraft(generatedText);
    } catch (error) {
      console.error("Error generating post:", error);
      setToastNotification({ message: 'Ett fel uppstod när inlägget skulle genereras.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!currentDraft.trim() || !currentUser) return;
    setIsPublishing(true);

    try {
      const coach = COACH_PERSONAS[selectedCoach];
      if (onPublish) {
        await onPublish(currentDraft, category, coach);
      } else {
        await createUserPost(
          currentUser.uid,
          currentDraft,
          category,
          undefined,
          'global', // visibility
          coach.label, // overrideName
          coach.imageUrl // overridePhotoURL
        );
      }
      
      setToastNotification({ message: `Inlägget har publicerats som ${coach.label}!`, type: 'success' });
      setChatHistory([]);
      setCurrentDraft('');
      setBrief('');
    } catch (error) {
      console.error("Error publishing post:", error);
      setToastNotification({ message: 'Kunde inte publicera inlägget.', type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className={`bg-white rounded-3xl shadow-soft-xl border border-neutral-light overflow-hidden flex flex-col ${className || 'h-[85vh] max-h-[900px]'}`}>
      {/* Header */}
      <div className="p-6 border-b border-neutral-light bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-dark flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-primary" />
            {lockedCoach ? `Skapa inlägg som ${COACH_PERSONAS[lockedCoach].label}` : 'Coach Studio'}
          </h2>
          <p className="text-sm text-neutral mt-1">
            {lockedCoach ? `Skapa och publicera inlägg direkt i truppen som ${COACH_PERSONAS[lockedCoach].label}.` : 'Skapa och publicera inlägg som en av våra AI-coacher.'}
          </p>
        </div>
        
        {/* Category Selector */}
        {!hideCategory && (
          <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-dark">Kategori:</span>
              <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value as PostCategory)}
                  className="bg-white border border-neutral-light text-neutral-dark text-sm rounded-xl focus:ring-primary focus:border-primary block p-2 outline-none"
              >
                  <option value="general">Allmänt</option>
                  <option value="question">Fråga</option>
                  <option value="food">Mat & Recept</option>
                  <option value="workout">Träning</option>
                  <option value="pepp">Pepp & Motivation</option>
              </select>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Bar: Coach Selection */}
        <div className="w-full border-b border-neutral-light bg-neutral-50/50 p-2 sm:p-3 shrink-0">
          <div className="flex flex-row gap-2 justify-between">
            {(Object.entries(COACH_PERSONAS) as [keyof typeof COACH_PERSONAS, any][])
              .filter(([key]) => !lockedCoach || key === lockedCoach)
              .map(([key, coach]) => (
              <button
                key={key}
                onClick={() => setSelectedCoach(key)}
                className={`flex-1 flex flex-row items-center justify-center sm:justify-start gap-2 sm:gap-3 p-2 rounded-xl transition-all text-left ${
                  selectedCoach === key 
                    ? 'bg-white border-2 border-primary shadow-sm' 
                    : 'bg-transparent border-2 border-transparent hover:bg-neutral-100'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={coach.imageUrl} alt={coach.label} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-neutral-200" />
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                    <span className="text-[8px] sm:text-[10px]">{coach.emoji}</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-neutral-dark text-[10px] sm:text-sm truncate">{coach.label}</p>
                  <p className="text-[9px] sm:text-xs text-neutral capitalize truncate hidden sm:block">{coach.roleTitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Area: Chat & Draft */}
        <div className="flex-1 flex flex-col bg-white relative overflow-hidden">
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-60">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <SparklesIcon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-neutral-dark mb-2">Börja skapa ett inlägg</h3>
                <p className="text-sm text-neutral">
                  Beskriv vad du vill att {COACH_PERSONAS[selectedCoach].label} ska skriva om. Du kan be om justeringar tills du är helt nöjd.
                </p>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-tr-sm' 
                      : 'bg-neutral-50 border border-neutral-100 text-neutral-dark rounded-tl-sm'
                  }`}>
                    {msg.role === 'model' && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-neutral-200/50">
                            <img src={COACH_PERSONAS[selectedCoach].imageUrl} alt="Coach" className="w-5 h-5 rounded-full" />
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Utkast från {COACH_PERSONAS[selectedCoach].label}</span>
                        </div>
                    )}
                    <div className={`text-sm ${msg.role === 'user' ? '' : 'markdown-body prose-sm max-w-none'}`}>
                        {msg.role === 'user' ? msg.text : <ReactMarkdown>{msg.text}</ReactMarkdown>}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-neutral-50 border border-neutral-100 rounded-2xl rounded-tl-sm p-4 flex items-center gap-3">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs text-neutral font-medium">{COACH_PERSONAS[selectedCoach].label} skriver...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Publish Bar (if draft exists) */}
          {currentDraft && !isGenerating && (
            <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between gap-4 animate-fade-in">
                <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-800">Nöjd med utkastet?</p>
                    <p className="text-xs text-emerald-600">
                      {onPublish 
                        ? `Det kommer att sparas som en mall och schemaläggas.` 
                        : `Det kommer att publiceras i communityt som ${COACH_PERSONAS[selectedCoach].label}.`}
                    </p>
                </div>
                <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                    {isPublishing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                    {onPublish ? 'Spara inlägg' : 'Publicera'}
                </button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-neutral-light bg-white">
            <div className="relative flex items-end gap-2">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder={`Skriv en brief till ${COACH_PERSONAS[selectedCoach].label}... (t.ex. "Skriv ett peppigt inlägg om att dricka vatten")`}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 pr-14 text-sm text-neutral-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none min-h-[60px] max-h-[120px] custom-scrollbar"
                rows={2}
                disabled={isGenerating || isPublishing}
              />
              <button
                onClick={handleGenerate}
                disabled={!brief.trim() || isGenerating || isPublishing}
                className="absolute right-3 bottom-3 p-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mt-2 text-center">
                Tryck på Enter för att skicka, Shift + Enter för ny rad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachStudioView;
