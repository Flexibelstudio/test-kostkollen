import React, { useEffect, useState } from 'react';
import { PIGGY_BANK_ICON_SVG } from '../constants';

interface CoinFallEffectProps {
  targetX: number;
  targetY: number;
  onComplete: () => void;
}

const CoinFallEffect: React.FC<CoinFallEffectProps> = ({ targetX, targetY, onComplete }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    // Start position: random x at the top of the screen
    const startX = window.innerWidth * (Math.random() * 0.6 + 0.2); // from 20% to 80% of width
    const startY = -100; // start off-screen

    // Set initial style
    setStyle({
      position: 'fixed',
      left: `${startX}px`,
      top: `${startY}px`,
      transform: `translate(-50%, -50%) scale(2)`,
      zIndex: 10000,
      opacity: 1,
      transition: 'left 1s cubic-bezier(0.4, 0, 1, 1), top 1s cubic-bezier(0.5, 0, 0.75, 0), transform 1s ease-out, opacity 1s ease-in',
    });

    // Animate to target
    const animationTimer = setTimeout(() => {
      setStyle(prev => ({
        ...prev,
        left: `${targetX}px`,
        top: `${targetY}px`,
        transform: `translate(-50%, -50%) scale(0.5) rotate(720deg)`,
        opacity: 0,
      }));
    }, 50); // Small delay to ensure initial styles are applied

    // Call onComplete when animation is finished
    const completeTimer = setTimeout(onComplete, 1050); // 1s animation + 50ms delay

    return () => {
      clearTimeout(animationTimer);
      clearTimeout(completeTimer);
    };
  }, [targetX, targetY, onComplete]);

  return (
    <div style={style}>
      <img src={PIGGY_BANK_ICON_SVG} alt="Sparpott bonus" className="w-12 h-12" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}/>
    </div>
  );
};

export default CoinFallEffect;