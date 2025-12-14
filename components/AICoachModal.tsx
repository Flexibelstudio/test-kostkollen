
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SparklesIcon, XMarkIcon } from './icons';
import { getAICoachResponseStream } from '../services/geminiService';
import { AIDataForJourneyAnalysis, ChartData, CoachStyle } from '../types';
import { Content } from "@google/genai";
import { playAudio } from '../services/audioService';
import SimpleLineChart from './SimpleLineChart';
import { COACH_PERSONAS } from '../constants';

interface AICoachModalProps {
  show: boolean;
  onClose: () => void;
  analysisContext: AIDataForJourneyAnalysis;
  initialContext: { type: 'from_analysis'; date?: string } | null;
}

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'bot';
    isStreaming?: boolean;
    isSystem?: boolean;
    chartData?: ChartData;
}

const renderMarkdown = (text: string) => {
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(\n|^)\* (.*?)(?=\n|$)/g, '$1<li class="ml-4 list-disc">$2</li>')
      .replace(/\n/g, '<br />');

    if (html.includes('<li')) {
        return `<ul class="space-y-1">${html.replace(/<br \/>(<li)/g, '$1').replace(/<\/li><br \/>/g, '</li>')}</ul>`;
    }
    
    return html;
};


const AICoachModal: React.FC<AICoachModalProps> = ({ show, onClose, analysisContext, initialContext }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const coachStyle = analysisContext.userProfile.coachStyle || 'balanced';

  // Determine Emoji and Color based on style
  const getCoachVisuals = (style: CoachStyle) => {
      if (style === 'soft') return { emoji: COACH_PERSONAS.soft.emoji, colorClass: 'bg-green-100 text-green-600' };
      if (style === 'hard') return { emoji: COACH_PERSONAS.hard.emoji, colorClass: 'bg-red-100 text-red-600' };
      return { emoji: COACH_PERSONAS.balanced.emoji, colorClass: 'bg-blue-100 text-blue-600' };
  };

  const { emoji: CoachEmoji, colorClass } = getCoachVisuals(coachStyle);
  const personaName = COACH_PERSONAS[coachStyle].label;

  const initialMessage: Message = useMemo(() => {
    // Customize initial message based on persona
    let introText = "";
    const name = analysisContext.userProfile.name || 'du';

    if (coachStyle === 'hard') {
        introText = `Givakt ${name}! **${personaName}** här. Inga ursäkter, nu kör vi. Vad behöver du hjälp med?`;
    } else if (coachStyle === 'soft') {
        introText = `Hej ${name}! **${personaName}** här. Jag hoppas du mår bra idag. Jag finns här för att stötta och peppa dig. Vad funderar du på?`;
    } else {
        introText = `Hej ${name}! **${personaName}** här. Jag är redo att analysera dina data och hjälpa dig nå dina mål. Vad vill du veta?`;
    }
    
    return {
        id: 0,
        text: introText,
        sender: 'bot',
        isSystem: true,
    };
  }, [analysisContext.userProfile.name, coachStyle, personaName]);


  useEffect(() => {
    if (show) {
        const initialMessages: Message[] = [{...initialMessage, id: Date.now()}];
        if (initialContext?.type === 'from_analysis') {
            if (initialContext.date) {
                const formattedDate = new Date(initialContext.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
                initialMessages.push({
                    id: Date.now() + 1,
                    text: `Hej igen! Jag ser att du tittar på din analys från den ${formattedDate}. Vad har du för funderingar kring den?`,
                    sender: 'bot',
                    isSystem: true,
                });
            } else {
                initialMessages.push({
                    id: Date.now() + 1,
                    text: "Jag ser att du precis tittat på din analys. Har du några funderingar kring den?",
                    sender: 'bot',
                    isSystem: true,
                });
            }
        }
        setMessages(initialMessages);
    } else {
        setMessages([]);
        setInput('');
        setIsLoading(false);
    }
}, [show, initialContext, initialMessage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    playAudio('uiClick');

    const userMessage: Message = { id: Date.now(), text: messageText, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const botMessagePlaceholder: Message = { id: Date.now() + 1, text: '', sender: 'bot', isStreaming: true };
    setMessages(prev => [...prev, botMessagePlaceholder]);
    
    const chatHistoryForAPI: Content[] = messages
        .filter(m => !m.isSystem && !m.chartData)
        .map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));

    try {
        const stream = await getAICoachResponseStream(messageText, chatHistoryForAPI, analysisContext);
        
        let fullResponseText = '';
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            fullResponseText += chunkText;
            setMessages(prev => prev.map(m => 
                m.id === botMessagePlaceholder.id ? { ...m, text: fullResponseText } : m
            ));
        }

        let jsonStrToParse = fullResponseText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStrToParse.match(fenceRegex);
        if (match && match[2]) {
            jsonStrToParse = match[2].trim();
        }
        
        try {
            const parsed = JSON.parse(jsonStrToParse);
            if (parsed && parsed.chartType === 'line' && parsed.datasets && Array.isArray(parsed.datasets) && parsed.labels) {
                playAudio('logSuccess', 0.7);
                setMessages(prev => prev.map(m =>
                    m.id === botMessagePlaceholder.id
                        ? { ...m, text: '', chartData: parsed, isStreaming: false }
                        : m
                ));
            } else {
                 setMessages(prev => prev.map(m =>
                    m.id === botMessagePlaceholder.id ? { ...m, isStreaming: false } : m
                ));
            }
        } catch (e) {
            setMessages(prev => prev.map(m =>
                m.id === botMessagePlaceholder.id ? { ...m, isStreaming: false } : m
            ));
        }

    } catch (error) {
        console.error("Error streaming AI coach response:", error);
        const errorMessage = error instanceof Error ? error.message : "Ett okänt fel inträffade.";
        setMessages(prev => prev.map(m => 
            m.id === botMessagePlaceholder.id 
                ? { ...m, text: `Ursäkta, ett fel inträffade: ${errorMessage}`, isStreaming: false } 
                : m
        ));
    } finally {
        setIsLoading(false);
    }
  };

  const suggestionChips = [
    "Visa min viktkurva",
    "Hur har min vecka sett ut?",
    "Vad har jag gjort bra?",
    "Hur ser mitt proteinintag ut?"
  ];

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-end justify-center z-[60] p-0 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-coach-modal-title"
    >
        <div
            className="bg-white rounded-t-2xl shadow-soft-xl w-full max-w-2xl h-[90vh] flex flex-col animate-slide-up-fade-in"
            onClick={(e) => e.stopPropagation()}
        >
            <header className="flex items-center justify-between p-4 border-b border-neutral-light/70 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
                        <span className="text-2xl">{CoachEmoji}</span>
                    </div>
                    <h2 id="ai-coach-modal-title" className="text-xl font-semibold text-neutral-dark">
                        Fråga {personaName}
                    </h2>
                </div>
                 <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition" aria-label="Stäng">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </header>
            
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {messages.map((msg) => {
                    if (msg.chartData) {
                        return (
                             <div key={msg.id} className="flex justify-start">
                                <div className="p-4 rounded-2xl bg-neutral-light text-neutral-dark rounded-bl-lg w-full">
                                    <SimpleLineChart data={msg.chartData} />
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                           {msg.sender === 'bot' && (
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mb-1 ${colorClass} bg-opacity-50`}>
                                    <span className="text-lg">{CoachEmoji}</span>
                                </div>
                           )}
                           <div className={`max-w-xs sm:max-w-md p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-primary text-white rounded-br-lg' : 'bg-neutral-light text-neutral-dark rounded-bl-lg'}`}>
                               <div className="text-base space-y-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                               {msg.isStreaming && !msg.chartData && msg.text.length > 0 && <div className="inline-block w-1.5 h-1.5 bg-neutral-dark rounded-full animate-ping ml-1"></div>}
                           </div>
                        </div>
                    );
                })}
                {isLoading && (
                     <div className="flex items-end gap-2 justify-start">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mb-1 ${colorClass} bg-opacity-50`}>
                            <span className="text-lg">{CoachEmoji}</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-neutral-light text-neutral-dark rounded-bl-lg">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 bg-neutral-dark/50 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-neutral-dark/50 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                <div className="w-2 h-2 bg-neutral-dark/50 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef}></div>
            </main>

            <footer className="p-4 border-t border-neutral-light/70 flex-shrink-0 bg-white">
                <div className="flex flex-wrap gap-2 mb-3">
                    {suggestionChips.map(chip => (
                        <button 
                            key={chip}
                            onClick={() => sendMessage(chip)}
                            disabled={isLoading}
                            className="px-3 py-1.5 text-sm font-medium bg-secondary-100/70 text-secondary-darker rounded-full hover:bg-secondary-200 disabled:opacity-50 interactive-transition"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Skriv din fråga här..."
                        disabled={isLoading}
                        className="flex-1 w-full px-4 py-2.5 bg-neutral-light border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-base disabled:opacity-60"
                        aria-label="Skriv meddelande"
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="p-3 bg-primary text-white rounded-full shadow-sm hover:bg-primary-darker active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed interactive-transition">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                    </button>
                </form>
            </footer>
        </div>
    </div>
  );
};

export default AICoachModal;
