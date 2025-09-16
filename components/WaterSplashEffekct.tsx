import React, { useEffect, useState } from 'react';

interface WaterSplashEffectProps {
  x: number;
  y: number;
  count: number;
  onComplete: () => void;
}

const WaterSplashEffect: React.FC<WaterSplashEffectProps> = ({ x, y, count, onComplete }) => {
  const [droplets, setDroplets] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    const newDroplets: React.CSSProperties[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 50 + 30; // 30px to 80px
      const size = Math.random() * 8 + 5; // 5px to 13px
      const duration = Math.random() * 0.6 + 0.5; // 0.5s to 1.1s

      // FIX: Cast style object to React.CSSProperties to allow for custom properties (--translateX, --translateY)
      // which are used by the animation defined in the CSS.
      newDroplets.push({
        // CSS custom properties for the animation
        '--translateX': `${Math.cos(angle) * distance}px`,
        '--translateY': `${Math.sin(angle) * distance}px`,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${Math.random() * 0.15}s`,
      } as React.CSSProperties);
    }
    setDroplets(newDroplets);

    const longestDuration = 1.1 + 0.15; // max duration + max delay
    const timer = setTimeout(onComplete, longestDuration * 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="fixed pointer-events-none z-[1000]" style={{ top: y, left: x, transform: 'translate(-50%, -50%)' }}>
      {droplets.map((style, index) => (
        <div
          key={index}
          className="absolute rounded-full bg-blue-400 animate-water-splash"
          style={style}
        />
      ))}
    </div>
  );
};

export default WaterSplashEffect;
