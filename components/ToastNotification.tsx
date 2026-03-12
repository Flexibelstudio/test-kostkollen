

import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from './icons';
import { MessageCircle } from 'lucide-react';

interface ToastNotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  onClick?: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, type, onClose, onClick }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Call onClose after animation finishes
      const animationDuration = 500; // Corresponds to 'animate-fade-out' duration
      setTimeout(onClose, animationDuration);
    }, 4000); // Message visible for 4s before starting fade out

    return () => clearTimeout(timer);
  }, [onClose]);

  const baseClasses = "fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center px-6 py-4 rounded-lg shadow-soft-xl text-white text-base font-medium z-[100]";
  const typeClasses = type === 'success' 
    ? "bg-primary border-primary-darker" 
    : type === 'error'
    ? "bg-red-500 border-red-700"
    : "bg-blue-500 border-blue-700";
  
  const animationClass = isVisible ? 'animate-slide-up-fade-in' : 'animate-fade-out';

  return (
    <div 
      className={`${baseClasses} ${typeClasses} ${animationClass} border-2 ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''}`}
      role="alert"
      aria-live="assertive"
      onClick={() => {
          if (onClick) {
              onClick();
              setIsVisible(false);
              setTimeout(onClose, 500);
          }
      }}
    >
      {type === 'success' ? <CheckCircleIcon className="w-6 h-6 mr-3" /> : type === 'error' ? <XCircleIcon className="w-6 h-6 mr-3" /> : <MessageCircle className="w-6 h-6 mr-3" />}
      <span>{message}</span>
    </div>
  );
};

export default ToastNotification;