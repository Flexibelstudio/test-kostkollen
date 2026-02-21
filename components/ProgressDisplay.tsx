import React, { useState, useEffect, useRef } from 'react';
import { GoalType } from '../types'; // Import GoalType
import { CALORIE_ADJUSTMENT } from '../constants';
import { CheckCircleIcon } from './icons';
import { playAudio } from '../services/audioService';

interface ProgressDisplayProps {
  label: string;
  current: number;
  goal: number;
  unit: string;
  icon?: React.ReactNode;
  minSafeThreshold: number;
  bankedCaloriesAvailable: number; // Remaining in bank for the week
  amountCoveredByBankToday?: number; // Total used from bank for *this day* for *this item*
  goalType?: GoalType; // Optional goalType
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  label,
  current,
  goal,
  unit,
  icon,
  minSafeThreshold,
  bankedCaloriesAvailable,
  amountCoveredByBankToday,
  goalType = 'lose_fat', // default
}) => {
  const [justMetGoal, setJustMetGoal] = useState(false);
  const prevCurrentRef = useRef(current);

  useEffect(() => {
    const goalReached = current >= goal && goal > 0;
    const prevGoalReached = prevCurrentRef.current >= goal && goal > 0;

    if (goalReached && !prevGoalReached) {
      setJustMetGoal(true);
      playAudio('logSuccess', 0.7);
      const timer = setTimeout(() => setJustMetGoal(false), 2000); // Animation duration
      return () => clearTimeout(timer);
    }

    prevCurrentRef.current = current;
  }, [current, goal]);

  const currentRounded = Math.round(current);
  const goalRounded = Math.round(goal);
  const minSafeThresholdRounded = Math.round(minSafeThreshold);
  const amountCoveredByBankTodayRounded = Math.round(amountCoveredByBankToday || 0);

  const isCalorieBar = label === 'Kalorier';
  const isGainMuscleGoal = goalType === 'gain_muscle';

  // UI state
  let statusText = `${currentRounded} / ${goalRounded > 0 ? goalRounded : '∞'} ${unit}`;
  let statusColorClass = 'text-neutral-dark';
  let descriptiveMessage = '';
  let descriptiveMessageColorClass = 'text-neutral';

  // Bar segments
  let greenSegmentWidth = 0;  // "inom mål / upp till mål"
  let redSegmentWidth = 0;    // "under minimum" (lose/maintain)
  let blueSegmentWidth = 0;   // "sparpott täcker"
  let orangeSegmentWidth = 0; // "överskott" (lose/maintain), eller "fram till mål" (gain innan mål) / "stort överskott" (gain över guldzon)
  let orangeTitle = '';

  if (isCalorieBar && isGainMuscleGoal) {
    // ====== GAIN MUSCLE LOGIC ======
    // Goal is a floor (TDEE) and a goldilocks zone up to a ceiling (TDEE + surplus).
    // The `goal` prop passed in is the ceiling (TDEE + surplus).
    const surplus = CALORIE_ADJUSTMENT.gain_muscle;
    const tdeeFloor = goalRounded > surplus ? goalRounded - surplus : 0;
    const optimalCeiling = goalRounded;
    const displayMax = Math.max(optimalCeiling, currentRounded, 1);

    statusText = `${currentRounded} / minst ${tdeeFloor} ${unit}`;

    if (currentRounded < tdeeFloor) {
      // ZON 1: Under TDEE floor -> orange bar
      orangeSegmentWidth = (currentRounded / displayMax) * 100;
      greenSegmentWidth = 0;
      statusColorClass = 'text-orange-500 font-semibold';
      descriptiveMessage = `Ät ${(tdeeFloor - currentRounded).toFixed(0)} ${unit} till för att nå ditt muskelbyggande mål.`;
      descriptiveMessageColorClass = 'text-orange-500';
      orangeTitle = `På väg mot ditt minimum ${tdeeFloor} ${unit}`;
    } else {
      // ZON 2 & 3: At or above TDEE floor
      const greenValue = Math.min(currentRounded, optimalCeiling);
      greenSegmentWidth = ((greenValue - tdeeFloor) / (displayMax - tdeeFloor)) * 100;

      if (currentRounded <= optimalCeiling) {
        // ZON 2: In the goldilocks zone (TDEE to TDEE + surplus)
        orangeSegmentWidth = 0;
        statusColorClass = 'text-primary-darker font-semibold';
        descriptiveMessage = `Perfekt! Du är i ett optimalt överskott för muskeluppbyggnad.`;
        descriptiveMessageColorClass = 'text-primary-darker';
      } else {
        // ZON 3: Above the goldilocks zone -> add orange surplus bar
        greenSegmentWidth = ((optimalCeiling - tdeeFloor) / (displayMax - tdeeFloor)) * 100;
        const surplusOverGold = currentRounded - optimalCeiling;
        orangeSegmentWidth = (surplusOverGold / displayMax) * 100;
        statusColorClass = 'text-orange-600 font-semibold';
        descriptiveMessage = `Du har ett stort kaloriöverskott, vilket kan leda till ökad fettinlagring.`;
        descriptiveMessageColorClass = 'text-orange-600';
        orangeTitle = `Stort överskott över ${optimalCeiling} ${unit}`;
      }
    }
    blueSegmentWidth = 0; // Sparpott is not used for muscle gain goal
  } else if (isCalorieBar) {
    // ====== EXISTING LOGIK: LOSE/MAINTAIN ======
    const effectiveDisplayGoal = Math.max(goalRounded, currentRounded, minSafeThresholdRounded, 1);

    if (currentRounded > 0 && currentRounded < minSafeThresholdRounded && goalRounded > 0) {
      // Under min safe → röd del (men inte om 0)
      redSegmentWidth = Math.min((currentRounded / effectiveDisplayGoal) * 100, 100);
      statusColorClass = 'text-red-600 font-semibold';
      descriptiveMessage = `Intag under minimum: ${minSafeThresholdRounded.toFixed(0)} ${unit}.`;
      descriptiveMessageColorClass = 'text-red-500';
    } else {
      // At or above min safe, or at 0
      redSegmentWidth = 0;

      if (currentRounded <= goalRounded && goalRounded > 0) {
        // Inom mål (och >= minSafe) → grön upp till current
        greenSegmentWidth = (currentRounded / effectiveDisplayGoal) * 100;
        statusColorClass = 'text-primary-darker font-semibold';
        if (currentRounded === goalRounded) {
          descriptiveMessage = `Perfekt! Du har nått ditt kalorimål på ${goalRounded.toFixed(0)} ${unit}.`;
          descriptiveMessageColorClass = 'text-primary-darker';
        } else {
          descriptiveMessage = `Du har upp till ${(goalRounded - currentRounded).toFixed(0)} ${unit} kvar av dagens budget.`;
          descriptiveMessageColorClass = 'text-neutral';
        }
      } else if (currentRounded > goalRounded && goalRounded > 0) {
        // Över mål (och >= minSafe) → grön till mål, sedan blå (bank) + orange (överskott)
        greenSegmentWidth = (goalRounded / effectiveDisplayGoal) * 100;

        const excessOverGoal = currentRounded - goalRounded;

        const blueSegmentValue = Math.min(excessOverGoal, amountCoveredByBankTodayRounded);
        blueSegmentWidth = (blueSegmentValue / effectiveDisplayGoal) * 100;

        const orangeSegmentValue = Math.max(0, excessOverGoal - blueSegmentValue);
        orangeSegmentWidth = (orangeSegmentValue / effectiveDisplayGoal) * 100;

        if (amountCoveredByBankTodayRounded > 0 && orangeSegmentValue === 0) {
          statusColorClass = 'text-blue-600 font-semibold';
          descriptiveMessage = `Du använde ${amountCoveredByBankTodayRounded.toFixed(0)} ${unit} från din sparpott.`;
          descriptiveMessageColorClass = 'text-blue-600';
        } else if (amountCoveredByBankTodayRounded > 0 && orangeSegmentValue > 0) {
          statusColorClass = 'text-orange-600 font-semibold';
          descriptiveMessage = `Du överskred målet med ${orangeSegmentValue.toFixed(0)} ${unit} (efter ${amountCoveredByBankTodayRounded.toFixed(0)} ${unit} från sparpott).`;
          descriptiveMessageColorClass = 'text-orange-600';
        } else {
          statusColorClass = 'text-orange-500 font-semibold';
          descriptiveMessage = `Du har överskridit ditt mål med ${excessOverGoal.toFixed(0)} ${unit}.`;
          descriptiveMessageColorClass = 'text-orange-500';
        }
      } else {
        // Edge cases (t.ex. goal=0)
        greenSegmentWidth = goalRounded > 0 ? Math.min((currentRounded / goalRounded) * 100, 100) : 0;
        if (currentRounded > goalRounded && goalRounded > 0) {
          orangeSegmentWidth = (currentRounded / goalRounded) * 100 - greenSegmentWidth;
        }
        if (goalRounded <= 0 && currentRounded > 0) {
          statusColorClass = 'text-neutral-dark';
          descriptiveMessage = 'Kalorimål ej satt, men du har loggat intag.';
        }
      }
    }
  } else {
    // ====== PROTEIN/CARBS/FAT ======
    const currentPercentageOfGoal = goalRounded > 0 ? (currentRounded / goalRounded) * 100 : 0;
    greenSegmentWidth = Math.min(currentPercentageOfGoal, 100);
    orangeSegmentWidth = currentPercentageOfGoal > 100 ? (currentPercentageOfGoal - 100) : 0;
    redSegmentWidth = 0;
    blueSegmentWidth = 0;

    if (currentRounded > goalRounded && goalRounded > 0) {
      statusColorClass = 'text-orange-500 font-semibold';
      descriptiveMessage = `Du har överskridit ditt mål med ${(currentRounded - goalRounded).toFixed(0)} ${unit}.`;
      descriptiveMessageColorClass = 'text-orange-500';
    } else if (currentRounded >= goalRounded && goalRounded > 0) {
      statusColorClass = 'text-primary-darker font-semibold';
      descriptiveMessage = `Perfekt! Du har nått ditt mål på ${goalRounded.toFixed(0)} ${unit}.`;
      descriptiveMessageColorClass = 'text-primary-darker';
    } else if (currentRounded < goalRounded && currentRounded >= 0 && goalRounded > 0) {
      statusColorClass = 'text-primary-darker font-semibold';
      descriptiveMessage = ``;
      descriptiveMessageColorClass = 'text-neutral';
    } else if (goalRounded <= 0 && currentRounded > 0) {
      statusColorClass = 'text-neutral-dark';
      descriptiveMessage = `Mål för ${label.toLowerCase()} ej satt, men du har loggat intag.`;
    }
  }

  // Gemensamt meddelande om inget annat meddelande satts och det är 0 intag men mål finns
  if (currentRounded === 0 && goalRounded > 0 && descriptiveMessage === '') {
    descriptiveMessage = `Logga ditt första ${isCalorieBar ? 'mål' : label.toLowerCase()} för dagen!`;
    descriptiveMessageColorClass = 'text-neutral';
  }

  // Skala sammanlagda segment så max 100%
  let totalBarWidthPercentage =
    redSegmentWidth + greenSegmentWidth + blueSegmentWidth + orangeSegmentWidth;
  if (totalBarWidthPercentage > 100) {
    const scale = 100 / totalBarWidthPercentage;
    redSegmentWidth *= scale;
    greenSegmentWidth *= scale;
    blueSegmentWidth *= scale;
    orangeSegmentWidth *= scale;
  }

  // Clamp 0..100
  redSegmentWidth = Math.max(0, Math.min(redSegmentWidth, 100));
  greenSegmentWidth = Math.max(0, Math.min(greenSegmentWidth, 100));
  blueSegmentWidth = Math.max(0, Math.min(blueSegmentWidth, 100));
  orangeSegmentWidth = Math.max(0, Math.min(orangeSegmentWidth, 100));

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-base font-medium text-neutral-dark flex items-center">
          {icon && <span className="mr-2.5">{icon}</span>}
          {label}
          {justMetGoal && <CheckCircleIcon className="w-6 h-6 text-primary ml-2 animate-check-pop-in" />}
        </span>
        <span className={`text-base font-medium ${statusColorClass}`}>
          {statusText}
        </span>
      </div>

      <div className={`w-full bg-neutral-light rounded-full h-5 shadow-inner flex overflow-hidden ${justMetGoal ? 'animate-goal-pulse' : ''}`}>
        {redSegmentWidth > 0 && (
          <div
            className="bg-red-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${redSegmentWidth}%` }}
            title={`Intag: ${currentRounded} ${unit} (Under rekommenderat minimum: ${minSafeThresholdRounded} ${unit})`}
          />
        )}
        
        {isGainMuscleGoal && orangeSegmentWidth > 0 && currentRounded < Math.round(goal - CALORIE_ADJUSTMENT.gain_muscle) && (
             <div
                className="bg-orange-400 h-full transition-all duration-300 ease-out"
                style={{ width: `${orangeSegmentWidth}%` }}
                title={orangeTitle}
            />
        )}
        
        {greenSegmentWidth > 0 && (
          <div
            className={`h-full transition-all duration-300 ease-out ${isGainMuscleGoal ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${greenSegmentWidth}%` }}
            title={isGainMuscleGoal ? `Optimalt överskott: ${currentRounded} ${unit}` : `Intag: ${currentRounded} ${unit}`}
          />
        )}

        {blueSegmentWidth > 0 && (
          <div
            className="bg-blue-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${blueSegmentWidth}%` }}
            title={`Använder ${amountCoveredByBankTodayRounded.toFixed(0)} ${unit} från sparpotten`}
          />
        )}

        {!isGainMuscleGoal && orangeSegmentWidth > 0 && (
          <div
            className="bg-orange-400 h-full transition-all duration-300 ease-out"
            style={{ width: `${orangeSegmentWidth}%` }}
            title={`Överskridit mål (efter ev. bank)`}
          />
        )}
        
        {isGainMuscleGoal && orangeSegmentWidth > 0 && currentRounded > goal && (
             <div
                className="bg-orange-400 h-full transition-all duration-300 ease-out"
                style={{ width: `${orangeSegmentWidth}%` }}
                title={orangeTitle}
            />
        )}

        {/* Fallback för tom stapel */}
        {redSegmentWidth + greenSegmentWidth + blueSegmentWidth + orangeSegmentWidth === 0 && (
          <div className="bg-neutral-light h-full w-full" />
        )}
      </div>

      {descriptiveMessage && (
        <p className={`text-sm mt-1.5 animate-fade-in ${descriptiveMessageColorClass}`}>
          {descriptiveMessage}
        </p>
      )}
    </div>
  );
};

export default ProgressDisplay;