import React, { useState } from 'react';
import { motion } from 'framer-motion';

export type RankBadgeSize = 'sm' | 'md' | 'lg';

interface RankBadgeProps {
  rank: string; // e.g. "Soldat", "Korpral", "Sergeant", "Fänrik", "Löjtnant", "Kapten", "Major", "General"
  size?: RankBadgeSize;
  animated?: boolean;
  className?: string;
  altText?: string;
}

export const getBadgePathForRank = (rankName: string): string => {
  const normalized = rankName.toLowerCase().trim();
  if (normalized.includes('soldat')) return '/badges/rank_soldat.png';
  if (normalized.includes('korpral')) return '/badges/rank_korpral.png';
  if (normalized.includes('sergeant')) return '/badges/rank_sergeant.png';
  if (normalized.includes('fänrik') || normalized.includes('fanrik')) return '/badges/rank_fanrik.png';
  if (normalized.includes('löjtnant') || normalized.includes('lojtnant')) return '/badges/rank_lojtnant.png';
  if (normalized.includes('kapten')) return '/badges/rank_kapten.png';
  if (normalized.includes('major')) return '/badges/rank_major.png';
  if (normalized.includes('general')) return '/badges/rank_general.png';
  return `/badges/rank_${normalized}.png`;
};

export const RankBadge: React.FC<RankBadgeProps> = ({
  rank,
  size = 'md',
  animated = false,
  className = '',
  altText
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !rank) {
    return null; // Requirement 5: If image is missing/errors out, show nothing instead of broken image
  }

  const badgeSrc = getBadgePathForRank(rank);
  const formattedAlt = altText || `Gradbeteckning: ${rank}`;

  // Size classes mapping
  const sizeClasses = {
    sm: 'w-8 h-8 sm:w-10 sm:h-10', // Small for lists
    md: 'w-16 h-16 sm:w-20 sm:h-20', // Medium for Bootcamp dashboard
    lg: 'w-24 h-24 sm:w-32 sm:h-32' // Large for Diploma
  };

  const combinedClasses = `object-contain flex-shrink-0 ${sizeClasses[size] || sizeClasses.md} ${className}`;

  if (animated) {
    return (
      <motion.img
        src={badgeSrc}
        alt={formattedAlt}
        onError={() => setHasError(true)}
        className={combinedClasses}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    );
  }

  return (
    <img
      src={badgeSrc}
      alt={formattedAlt}
      onError={() => setHasError(true)}
      className={combinedClasses}
    />
  );
};
