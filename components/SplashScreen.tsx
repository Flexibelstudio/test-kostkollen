import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-neutral-light bg-dotted-pattern bg-dotted-size flex flex-col items-center justify-center z-[100]">
      <div className="relative animate-pulse">
        <img
          src="/favicon.png"
          alt="Kostloggen.se logo"
          className="h-32 w-32 drop-shadow-md"
        />
      </div>
    </div>
  );
};

export default SplashScreen;