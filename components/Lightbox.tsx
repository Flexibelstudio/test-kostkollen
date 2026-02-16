
import React, { useEffect } from 'react';
import { XMarkIcon } from './icons';

interface LightboxProps {
  isOpen: boolean;
  src: string;
  alt: string;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ isOpen, src, alt, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/40 rounded-full hover:bg-black/60 transition-colors z-[1010]"
      >
        <XMarkIcon className="w-8 h-8" />
      </button>

      <img 
        src={src} 
        alt={alt} 
        className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()} 
      />
    </div>
  );
};

export default Lightbox;
