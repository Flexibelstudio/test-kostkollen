

import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  color?: 'primary' | 'white';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Bearbetar...", color = 'white' }) => {
  const colorClass = color === 'white' ? 'border-white' : 'border-primary';
  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-50 flex flex-col items-center justify-center z-50">
      <div className={`animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 ${colorClass} mb-5`}></div>
      <p className="text-white text-xl font-semibold">{message}</p>
    </div>
  );
};

export default LoadingSpinner;