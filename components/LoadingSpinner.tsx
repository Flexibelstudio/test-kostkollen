

import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  color?: 'primary' | 'white';
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Bearbetar...", color = 'white', fullScreen = true }) => {
  const colorClass = color === 'white' ? 'border-white' : 'border-primary';
  const containerClass = fullScreen 
    ? "fixed inset-0 bg-neutral-dark bg-opacity-50 flex flex-col items-center justify-center z-[80]"
    : "flex flex-col items-center justify-center py-8";
  const textClass = fullScreen ? "text-white" : "text-neutral-dark";

  return (
    <div className={containerClass}>
      <div className={`animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 ${colorClass} mb-5`}></div>
      <p className={`${textClass} text-xl font-semibold`}>{message}</p>
    </div>
  );
};

export default LoadingSpinner;