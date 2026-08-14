import React, { useState, useEffect } from 'react';
import { X, Sparkles, Send, Loader2 } from 'lucide-react';
import { generateCommunityPost } from '../services/geminiService';

interface AIPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (message: string) => void;
    contextPrompt: string;
}

const AIPostModal: React.FC<AIPostModalProps> = ({ isOpen, onClose, onSend, contextPrompt }) => {
    const [postDraft, setPostDraft] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            generateDraft();
        } else {
            setPostDraft('');
        }
    }, [isOpen, contextPrompt]);

    const generateDraft = async () => {
        setIsGenerating(true);
        try {
            const draft = await generateCommunityPost(contextPrompt);
            setPostDraft(draft);
        } catch (error) {
            console.error("Failed to generate post:", error);
            setPostDraft("Hej allihopa! Hur går det med era mål den här veckan? Dela gärna med er av era bästa tips för att hålla motivationen uppe! 👇");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = async () => {
        if (!postDraft.trim()) return;
        setIsSending(true);
        try {
            await onSend(postDraft);
            onClose();
        } catch (error) {
            console.error("Failed to post:", error);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#D96E4A] to-[#C05A38] p-6 text-white relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Sparkles className="w-6 h-6 text-white/80" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">AI-Communityinlägg</h3>
                            <p className="text-white/80 text-sm">
                                Skapa ett inlägg för att driva engagemang
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-neutral-dark">Granska och redigera inlägget:</label>
                        <button 
                            onClick={generateDraft}
                            disabled={isGenerating || isSending}
                            className="text-xs text-primary font-bold flex items-center gap-1 hover:text-primary-darker transition-colors disabled:opacity-50"
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
                                value={postDraft}
                                onChange={(e) => setPostDraft(e.target.value)}
                                className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none text-neutral-dark"
                                placeholder="Skriv ditt inlägg här..."
                            />
                        )}
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
                        disabled={isGenerating || isSending || !postDraft.trim()}
                        className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-darker transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Publicerar...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Publicera i Community
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIPostModal;
