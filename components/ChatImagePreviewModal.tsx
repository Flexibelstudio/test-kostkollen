import React, { useState } from 'react';
import { ArrowRightIcon } from './icons';

interface ChatImagePreviewModalProps {
  imageDataUrl: string | null;
  onClose: () => void;
  onSend: (caption: string, imageDataUrl: string) => void;
  isSending: boolean;
}

const ChatImagePreviewModal: React.FC<ChatImagePreviewModalProps> = ({ imageDataUrl, onClose, onSend, isSending }) => {
  const [caption, setCaption] = useState('');
  if (!imageDataUrl) return null;

  const handleSend = () => {
    onSend(caption, imageDataUrl);
  };

  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[85] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white p-4 rounded-xl shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
        <img src={imageDataUrl} alt="Förhandsvisning av bild" className="rounded-lg mb-3 max-h-[60vh] object-contain" />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Lägg till en bildtext..."
            className="flex-grow px-4 py-2 bg-neutral-light border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            onKeyPress={(e) => { if (e.key === 'Enter') handleSend(); }}
          />
          <button onClick={handleSend} disabled={isSending} className="p-3 bg-primary text-white rounded-full disabled:opacity-50">
            {isSending ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : <ArrowRightIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatImagePreviewModal;
