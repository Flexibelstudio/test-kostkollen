
import React from 'react';

interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string; // Hex or Tailwind class like 'text-primary'
  trackColor?: string;
  label?: string;
  subLabel?: string;
  icon?: React.ReactNode;
  centerContent?: React.ReactNode;
  /** Malzonens start som andel 0-1. Ritas som ett blekt falt pa banan. */
  zoneStart?: number;
  /** Malzonens slut som andel 0-1. Default 1. */
  zoneEnd?: number;
  /** Farg pa malzonsfaltet. */
  zoneColor?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  color = '#D96E4A',
  trackColor = '#F1EAE0',
  label,
  subLabel,
  icon,
  centerContent,
  zoneStart,
  zoneEnd = 1,
  zoneColor = '#DCE8D6'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeMax = Math.max(max, 1);
  const percentage = Math.min(Math.max(value / safeMax, 0), 1); // Clamp between 0 and 1 for the bar visual
  const dashOffset = circumference - percentage * circumference;

  // Malzonen ritas som ett segment pa banan med hjalp av strokeDasharray.
  // Negativ dashoffset flyttar segmentets start runt cirkeln.
  const hasZone =
    typeof zoneStart === 'number' && zoneStart > 0 && zoneStart < 1 && zoneEnd > zoneStart;
  const zoneFrom = hasZone ? Math.min(Math.max(zoneStart as number, 0), 1) : 0;
  const zoneTo = hasZone ? Math.min(Math.max(zoneEnd, 0), 1) : 0;
  const zoneLength = (zoneTo - zoneFrom) * circumference;
  const zoneOffset = -zoneFrom * circumference;

  // If color/trackColor is a hex code, apply via stroke attribute directly
  const isHexColor = color.startsWith('#');
  const isHexTrack = trackColor.startsWith('#');
  
  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Track - Always visible sand/gray ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isHexTrack ? trackColor : 'currentColor'}
          className={!isHexTrack ? trackColor : ''}
          strokeWidth={strokeWidth}
        />
        {/* Malzon - banan byter till en svagare gron dar ringen blir gron.
            Ingen markering, bara fargbytet. */}
        {hasZone && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={zoneColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${zoneLength} ${circumference - zoneLength}`}
            strokeDashoffset={zoneOffset}
          />
        )}
        {/* Progress - Colored ring filling up */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isHexColor ? color : 'currentColor'}
          className={!isHexColor ? color : ''}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      
      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerContent ? (
          centerContent
        ) : (
          <>
            {icon && <div className="mb-1">{icon}</div>}
            {label && <span className="text-xl font-serif font-medium text-[#56524D] dark:text-[#FAF6EF] leading-none">{label}</span>}
            {subLabel && <span className="text-xs text-[#7A756E] dark:text-[#C2BCB4] font-medium mt-0.5">{subLabel}</span>}
          </>
        )}
      </div>
    </div>
  );
};

export default CircularProgress;
