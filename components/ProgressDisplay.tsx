import React from 'react';
import { GoalType } from '../types'; // Import GoalType

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
  const currentRounded = Math.round(current);
  const goalRounded = Math.round(goal);
  const minSafeThresholdRounded = Math.round(minSafeThreshold);
  const amountCoveredByBankTodayRounded = Math.round(amountCoveredByBankToday || 0);

  const isCalorieBar = label === 'Kalorier';
  const isGain = (goalType || '').toLowerCase().includes('gain'); // ex: 'gain_muscle'

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

  if (isCalorieBar && isGain) {
    // ====== GAIN LOGIK ======
    // Målet är ett golv (minimum). Guldzon: goal ~ goal + 300.
    const optimalSurplus = 300;
    const optimalCeiling = goalRounded + optimalSurplus;
    const displayMax = Math.max(optimalCeiling, currentRounded, goalRounded, 1);

    // Text: "Minst X kcal"
    statusText = `${currentRounded} / minst ${goalRounded} ${unit}`;

    if (currentRounded < goalRounded) {
      // ZON 1: under minimum → orange fyllning mot målet
      orangeSegmentWidth = (currentRounded / displayMax) * 100;
      statusColorClass = 'text-orange-500 font-semibold';
      descriptiveMessage = `Ät ${(goalRounded - currentRounded).toFixed(0)} ${unit} till för att nå ditt muskelbyggande mål.`;
      descriptiveMessageColorClass = 'text-orange-500';
      orangeTitle = `På väg mot ditt minimum ${goalRounded} ${unit}`;
    } else {
      // ZON 2 & 3: uppnått minst goal → grön
      greenSegmentWidth = (Math.min(currentRounded, optimalCeiling) / displayMax) * 100;

      if (currentRounded <= optimalCeiling) {
        // ZON 2: i guldzonen (goal..goal+300)
        statusColorClass = 'text-primary-darker font-semibold';
        descriptiveMessage = `Perfekt! Du är i ett optimalt överskott för muskeluppbyggnad.`;
        descriptiveMessageColorClass = 'text-primary-darker';
        // ingen orange topp här
      } else {
        // ZON 3: stort överskott över guldzonen → lägg en orange topp
        const surplusOverGold = currentRounded - optimalCeiling;
        orangeSegmentWidth = (surplusOverGold / displayMax) * 100;
        statusColorClass = 'text-orange-600 font-semibold';
        descriptiveMessage = `Du har ett stort kaloriöverskott, vilket kan leda till ökad fettinlagring.`;
        descriptiveMessageColorClass = 'text-orange-600';
        orangeTitle = `Stort överskott över ${optimalCeiling} ${unit}`;
      }
    }
  } else if (isCalorieBar) {
    // ====== EXISTING LOGIK: LOSE/MAINTAIN ======
    const effectiveDisplayGoal = Math.max(goalRounded, currentRounded, minSafeThresholdRounded, 1);

    if (currentRounded < minSafeThresholdRounded && goalRounded > 0) {
      // Under min safe → röd del
      redSegmentWidth = Math.min((currentRounded / effectiveDisplayGoal) * 100, 100);
      statusColorClass = 'text-red-600 font-semibold';
      descriptiveMessage = `Intag under minimum: ${minSafeThresholdRounded.toFixed(0)} ${unit}.`;
      descriptiveMessageColorClass = 'text-red-500';
    } else {
      // At or above min safe
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
    } else if (currentRounded === goalRounded && goalRounded > 0) {
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
        </span>
        <span className={`text-base font-medium ${statusColorClass}`}>
          {isCalorieBar && isGain
            ? // För gain: visa "Minst X kcal"
              `${currentRounded} / minst ${goalRounded} ${unit}`
            : statusText}
        </span>
      </div>

      <div className="w-full bg-neutral-light rounded-full h-5 shadow-inner flex overflow-hidden">
        {redSegmentWidth > 0 && (
          <div
            className="bg-red-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${redSegmentWidth}%` }}
            title={`Intag: ${currentRounded} ${unit} (Under rekommenderat minimum: ${minSafeThresholdRounded} ${unit})`}
          />
        )}

        {greenSegmentWidth > 0 && (
          <div
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${greenSegmentWidth}%` }}
            title={`Intag: ${currentRounded} ${unit}`}
          />
        )}

        {blueSegmentWidth > 0 && (
          <div
            className="bg-blue-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${blueSegmentWidth}%` }}
            title={`Använder ${amountCoveredByBankTodayRounded.toFixed(0)} ${unit} från sparpotten`}
          />
        )}

        {orangeSegmentWidth > 0 && (
          <div
            className="bg-orange-400 h-full transition-all duration-300 ease-out"
            style={{ width: `${orangeSegmentWidth}%` }}
            title={
              isCalorieBar && isGain
                ? (orangeTitle || (currentRounded < goalRounded
                    ? `På väg mot ditt minimum ${goalRounded} ${unit}`
                    : `Stort överskott över ${(goalRounded + 300)} ${unit}`))
                : `Överskridit mål (efter ev. bank)`
            }
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
