import React, { useEffect, useState } from 'react';

interface WaterSplashEffectProps {
  x: number;
  y: number;
  count: number;
  onComplete: () => void;
}

// Define a more specific style type that includes our custom CSS properties
// and other properties we will set dynamically.
interface DropletStyle extends React.CSSProperties {
  '--translateX': string;
  '--translateY': string;
}

const WaterSplashEffect: React.FC<WaterSplashEffectProps> = ({ x, y, count, onComplete }) => {
  const [droplets, setDroplets] = useState<DropletStyle[]>([]);

  useEffect(() => {
    const newDroplets: DropletStyle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 50 + 30; // 30px to 80px
      const size = Math.random() * 8 + 5; // 5px to 13px
      const duration = Math.random() * 0.6 + 0.5; // 0.5s to 1.1s

      newDroplets.push({
        '--translateX': `${Math.cos(angle) * distance}px`,
        '--translateY': `${Math.sin(angle) * distance}px`,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${Math.random() * 0.15}s`,
        // Move styling from className to here for type safety
        position: 'absolute',
        borderRadius: '50%',
        backgroundColor: '#60a5fa', // Tailwind's bg-blue-400
      });
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
          className="animate-water-splash" // Only the animation class remains
          style={style}
        />
      ))}
    </div>
  );
};

export default WaterSplashEffect;
