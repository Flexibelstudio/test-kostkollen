import React, { useState, useEffect } from 'react';
import { X, Sparkles, Send, Loader2 } from 'lucide-react';
import { CoachViewMember } from '../types';
import { generateGrowthEngineMessage } from '../services/geminiService';

interface AIMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (message: string, users: CoachViewMember[]) => void;
    contextPrompt: string;
    targetUsers: CoachViewMember[];
}

const AIMessageModal: React.FC<AIMessageModalProps> = ({ isOpen, onClose, onSend, contextPrompt, targetUsers }) => {
    const [messageDraft, setMessageDraft] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen && targetUsers.length > 0) {
            generateDraft();
        } else {
            setMessageDraft('');
        }
    }, [isOpen, targetUsers, contextPrompt]);

    const generateDraft = async () => {
        setIsGenerating(true);
        try {
            const userNames = targetUsers.map(u => u.name || 'Användare');
            const draft = await generateGrowthEngineMessage(contextPrompt, userNames);
            setMessageDraft(draft);
        } catch (error) {
            console.error("Failed to generate message:", error);
            setMessageDraft("Hej! Jag ville bara kika in och se hur det går för dig. Säg till om du behöver någon hjälp eller pepp!");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = async () => {
        if (!messageDraft.trim()) return;
        setIsSending(true);
        try {
            await onSend(messageDraft, targetUsers);
            onClose();
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-primary-dark p-6 text-white relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Sparkles className="w-6 h-6 text-primary-100" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">AI-Meddelande</h3>
                            <p className="text-primary-100 text-sm">
                                Skickas till {targetUsers.length} {targetUsers.length === 1 ? 'person' : 'personer'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-neutral-dark">Granska och redigera meddelandet:</label>
                        <button 
                            onClick={generateDraft}
                            disabled={isGenerating || isSending}
                            className="text-xs text-primary font-bold flex items-center gap-1 hover:text-primary-dark transition-colors disabled:opacity-50"
                        >
                            <Sparkles className="w-3 h-3" />
                            Generera om
                        </button>
                    </div>
                    
                    <div className="relative">
                        {isGenerating ? (
                            <div className="w-full h-40 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-neutral">
                                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                                <p className="text-sm">AI skriver ett utkast...</p>
                            </div>
                        ) : (
                            <textarea
                                value={messageDraft}
                                onChange={(e) => setMessageDraft(e.target.value)}
                                className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none text-neutral-dark"
                                placeholder="Skriv ditt meddelande här..."
                            />
                        )}
                    </div>
                    
                    <div className="bg-[#F1EAE0] text-[#56524D] p-3 rounded-xl text-xs flex items-start gap-2">
                        <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>
                            <strong>Tips:</strong> Om du skickar till flera personer kommer eventuella platshållare som [Namn] att bytas ut mot mottagarens riktiga namn.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isSending}
                        className="px-6 py-2.5 text-neutral-dark font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Avbryt
                    </button>
                    <button 
                        onClick={handleSend}
                        disabled={isGenerating || isSending || !messageDraft.trim()}
                        className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Skickar...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Skicka meddelande
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIMessageModal;
