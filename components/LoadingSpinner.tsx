

import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Bearbetar..." }) => {
  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-50 flex flex-col items-center justify-center z-50">
      <div className="animate-spin rounded-full h-20 w-20 border-t-6 border-b-6 border-primary mb-5"></div>
      <p className="text-white text-xl font-semibold">{message}</p>
    </div>
  );
};

export default LoadingSpinner;