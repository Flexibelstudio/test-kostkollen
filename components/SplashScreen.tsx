
import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-neutral-light flex flex-col items-center justify-center z-[100]">
      <div className="relative">
        <img
          src="/favicon.png"
          alt="Kostloggen.se logo"
          className="h-24 w-24 object-contain drop-shadow-md"
        />
      </div>
    </div>
  );
};

export default SplashScreen;
