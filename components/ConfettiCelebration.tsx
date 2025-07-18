


import React, { useState, useEffect } from 'react';

interface ConfettiCelebrationProps {
  isActive: boolean;
}

interface Particle {
  id: number;
  style: React.CSSProperties;
}

const confettiColors = [
  '#3bab5a', // primary.DEFAULT
  '#f97316', // secondary.DEFAULT (orange)
  '#F59E0B', // accent.DEFAULT
  '#5cb979', // primary.lighter
  '#fa8a3a', // secondary.lighter (orange)
  '#FBBF24', // accent.lighter
  '#EF4444', // Red
  '#EC4899', // Pink
  '#D946EF', // Fuchsia
  '#8B5CF6', // Violet
];

const NUM_CONFETTI = 75;

const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({ isActive }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (isActive) {
      const newParticles: Particle[] = [];
      for (let i = 0; i < NUM_CONFETTI; i++) {
        const size = Math.random() * 8 + 6; // 6px to 14px
        newParticles.push({
          id: i,
          style: {
            position: 'fixed',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * -20 - 5}vh`, // Start above screen
            width: `${size}px`,
            height: `${size * (Math.random() * 0.5 + 0.75)}px`, // slightly rectangular
            backgroundColor: confettiColors[Math.floor(Math.random() * confettiColors.length)],
            opacity: 1,
            zIndex: 99999,
            animationName: 'confetti-fall', // Keyframe name from index.html
            animationDuration: `${Math.random() * 2 + 3}s`, // 3s to 5s
            animationDelay: `${Math.random() * 1.5}s`, // 0s to 1.5s
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
            // The 'animate-confetti-fall' class might also apply these,
            // but direct style ensures they are set. Transform is handled by keyframes.
          },
        });
      }
      setParticles(newParticles);
    } else {
      // Clear particles after a delay to let animations finish if isActive becomes false quickly
      // App.tsx manages showConfetti for 5s, so this might not be strictly necessary
      // if isActive only changes after the 5s timeout in App.tsx.
      // For robustness, especially if isActive could be toggled off earlier by other means:
      const timer = setTimeout(() => {
        setParticles([]);
      }, 5000); // Max animation duration + delay
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!isActive && particles.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[99998]" aria-hidden="true">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="animate-confetti-fall" // Apply class that links to keyframes
          style={particle.style}
        />
      ))}
    </div>
  );
};

export default ConfettiCelebration;