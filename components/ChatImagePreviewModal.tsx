import React, { useState, useEffect } from 'react';
import { PaperAirplaneIcon, XMarkIcon } from './icons';

interface ChatImagePreviewModalProps {
    imageDataUrl: string | null;
    onClose: () => void;
    onSend: (caption: string, imageDataUrl: string) => void;
    isSending: boolean;
}

const ChatImagePreviewModal: React.FC<ChatImagePreviewModalProps> = ({ imageDataUrl, onClose, onSend, isSending }) => {
    const [caption, setCaption] = useState('');

    useEffect(() => {
        if (!imageDataUrl) {
            setCaption('');
        }
    }, [imageDataUrl]);

    if (!imageDataUrl) {
        return null;
    }

    const handleSendClick = () => {
        if (!isSending) {
            onSend(caption, imageDataUrl);
        }
    };
    
    return (
        <div
            className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[85] p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-preview-title"
            onClick={onClose}
        >
            <div 
                className="bg-white p-4 rounded-xl shadow-soft-xl w-full max-w-lg flex flex-col max-h-[90vh] animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 id="image-preview-title" className="text-xl font-semibold text-neutral-dark">Granska bild</h2>
                    <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full interactive-transition">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow flex items-center justify-center mb-4 overflow-hidden rounded-lg bg-neutral-light">
                    <img src={imageDataUrl} alt="Förhandsgranskning" className="max-w-full max-h-[60vh] object-contain" />
                </div>
                
                <div className="flex items-center gap-3 flex-shrink-0">
                    <input
                        type="text"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') handleSendClick(); }}
                        placeholder="Lägg till bildtext (valfritt)..."
                        className="flex-grow px-4 py-3 bg-neutral-light border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        disabled={isSending}
                        autoFocus
                    />
                    <button
                        onClick={handleSendClick}
                        disabled={isSending}
                        className="p-3 bg-primary text-white rounded-full shadow-sm hover:bg-primary-darker disabled:opacity-50 disabled:cursor-not-allowed interactive-transition"
                        aria-label="Skicka bild"
                    >
                        {isSending ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <PaperAirplaneIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatImagePreviewModal;
