

import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from './icons';

interface ToastNotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Call onClose after animation finishes
      const animationDuration = 500; // Corresponds to 'animate-fade-out' duration
      setTimeout(onClose, animationDuration);
    }, 2500); // Message visible for 2.5s before starting fade out

    return () => clearTimeout(timer);
  }, [onClose]);

  const baseClasses = "fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center px-6 py-4 rounded-lg shadow-soft-xl text-white text-base font-medium z-[100]";
  const typeClasses = type === 'success' 
    ? "bg-primary border-primary-darker" 
    : "bg-red-500 border-red-700";
  
  const animationClass = isVisible ? 'animate-slide-up-fade-in' : 'animate-fade-out';

  return (
    <div 
      className={`${baseClasses} ${typeClasses} ${animationClass} border-2`}
      role="alert"
      aria-live="assertive"
    >
      {type === 'success' ? <CheckCircleIcon className="w-6 h-6 mr-3" /> : <XCircleIcon className="w-6 h-6 mr-3" />}
      <span>{message}</span>
    </div>
  );
};

export default ToastNotification;