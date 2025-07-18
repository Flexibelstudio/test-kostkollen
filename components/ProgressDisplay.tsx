

import React from 'react';

interface ProgressDisplayProps {
  label: string;
  current: number;
  goal: number;
  unit: string;
  icon?: React.ReactNode;
  minSafeThreshold: number; 
  bankedCaloriesAvailable: number; // Remaining in bank for the week
  amountCoveredByBankToday?: number; // Total used from bank for *this day* for *this item*
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({ 
  label, current, goal, unit, icon, 
  minSafeThreshold, bankedCaloriesAvailable, amountCoveredByBankToday 
}) => {
  
  const currentRounded = Math.round(current);
  const goalRounded = Math.round(goal);
  const minSafeThresholdRounded = Math.round(minSafeThreshold);
  // bankedAvailableRounded is remaining in bank for week, not directly used for today's bar logic visualization of bank usage.
  // const bankedAvailableRounded = Math.round(bankedCaloriesAvailable); 
  const amountCoveredByBankTodayRounded = Math.round(amountCoveredByBankToday || 0);


  const isCalorieBar = label === 'Kalorier';

  let statusText = `${currentRounded} / ${goalRounded > 0 ? goalRounded : '∞'} ${unit}`;
  let statusColorClass = 'text-neutral-dark';
  let descriptiveMessage = "";
  let descriptiveMessageColorClass = "text-neutral";

  // Progress bar segment widths
  let greenSegmentWidth = 0;
  let redSegmentWidth = 0;
  let blueSegmentWidth = 0;
  let orangeSegmentWidth = 0;


  if (isCalorieBar) {
    const effectiveDisplayGoal = Math.max(goalRounded, currentRounded, minSafeThresholdRounded, 1);
    
    if (currentRounded < minSafeThresholdRounded && goalRounded > 0) { // Under min safe
        redSegmentWidth = Math.min((currentRounded / effectiveDisplayGoal) * 100, 100);
        statusColorClass = 'text-red-600 font-semibold';
        descriptiveMessage = `Intag under minimum: ${minSafeThresholdRounded.toFixed(0)} ${unit}.`;
        descriptiveMessageColorClass = 'text-red-500';
    } else { // At or above min safe
        redSegmentWidth = 0;

        if (currentRounded <= goalRounded && goalRounded > 0) { // Within goal (and >= minSafe)
            greenSegmentWidth = (currentRounded / effectiveDisplayGoal) * 100;
            statusColorClass = 'text-primary-darker font-semibold';
            if (currentRounded === goalRounded) {
                descriptiveMessage = `Perfekt! Du har nått ditt kalorimål på ${goalRounded.toFixed(0)} ${unit}.`;
                descriptiveMessageColorClass = 'text-primary-darker';
            } else {
                descriptiveMessage = `Du har upp till ${(goalRounded - currentRounded).toFixed(0)} ${unit} kvar av dagens budget.`;
                descriptiveMessageColorClass = 'text-neutral';
            }
        } else if (currentRounded > goalRounded && goalRounded > 0) { // currentRounded > goalRounded (and >= minSafe)
            greenSegmentWidth = (goalRounded / effectiveDisplayGoal) * 100;
            
            const excessOverGoal = currentRounded - goalRounded; // e.g., 397
            
            const blueSegmentValue = Math.min(excessOverGoal, amountCoveredByBankTodayRounded);
            blueSegmentWidth = (blueSegmentValue / effectiveDisplayGoal) * 100;
            
            const orangeSegmentValue = Math.max(0, excessOverGoal - blueSegmentValue);
            orangeSegmentWidth = (orangeSegmentValue / effectiveDisplayGoal) * 100;
            
            // Descriptive messages for overage
            if (amountCoveredByBankTodayRounded > 0 && orangeSegmentValue === 0) { // Bank covered all excess
                statusColorClass = 'text-blue-600 font-semibold';
                descriptiveMessage = `Du använde ${amountCoveredByBankTodayRounded.toFixed(0)} ${unit} från din sparpott.`;
                descriptiveMessageColorClass = 'text-blue-600';
            } else if (amountCoveredByBankTodayRounded > 0 && orangeSegmentValue > 0) { // Bank covered some, but still over
                statusColorClass = 'text-orange-600 font-semibold';
                descriptiveMessage = `Du överskred målet med ${orangeSegmentValue.toFixed(0)} ${unit} (efter ${amountCoveredByBankTodayRounded.toFixed(0)} ${unit} från sparpott).`;
                descriptiveMessageColorClass = 'text-orange-600';
            } else { // Pure overage, no bank used for this excess
                statusColorClass = 'text-orange-500 font-semibold';
                descriptiveMessage = `Du har överskridit ditt mål med ${excessOverGoal.toFixed(0)} ${unit}.`;
                descriptiveMessageColorClass = 'text-orange-500';
            }
        } else { // Handles goalRounded === 0 or other edge cases
             greenSegmentWidth = goalRounded > 0 ? Math.min((currentRounded / goalRounded) * 100, 100) : 0;
             if (currentRounded > goalRounded && goalRounded > 0) orangeSegmentWidth = (currentRounded / goalRounded) * 100 - greenSegmentWidth;

            if (goalRounded <= 0 && currentRounded > 0) { // Consumed calories but no goal set
                 statusColorClass = 'text-neutral-dark';
                 descriptiveMessage = "Kalorimål ej satt, men du har loggat intag.";
            }
        }
    }
  } else { // Macronutrient-specific logic (Protein, Carbs, Fat)
    const currentPercentageOfGoal = goalRounded > 0 ? (currentRounded / goalRounded) * 100 : 0;
    greenSegmentWidth = Math.min(currentPercentageOfGoal, 100);
    orangeSegmentWidth = currentPercentageOfGoal > 100 ? (currentPercentageOfGoal - 100) : 0; // Represents the part over 100%
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
    } else if (currentRounded < goalRounded && currentRounded >= 0 && goalRounded > 0) { // current is less than goal (and not negative)
      statusColorClass = 'text-primary-darker font-semibold'; // Or neutral if preferred when under goal
      descriptiveMessage = ``;
      descriptiveMessageColorClass = 'text-neutral';
    } else if (goalRounded <= 0 && currentRounded > 0) {
        statusColorClass = 'text-neutral-dark';
        descriptiveMessage = `Mål för ${label.toLowerCase()} ej satt, men du har loggat intag.`;
    }
  }

  // Common descriptive message for zero intake (applies to all types if no other message is set)
  if (currentRounded === 0 && goalRounded > 0 && descriptiveMessage === "") {
    descriptiveMessage = `Logga ditt första ${isCalorieBar ? 'mål' : label.toLowerCase()} för dagen!`;
    descriptiveMessageColorClass = "text-neutral";
  }
  
  // Ensure total bar width doesn't exceed 100% for display by scaling segments
  // This is primarily for the calorie bar where multiple colors can sum up.
  // For macros, green + orange is fine to overflow visually if current > goal.
  if (isCalorieBar) {
    let totalBarWidthPercentage = redSegmentWidth + greenSegmentWidth + blueSegmentWidth + orangeSegmentWidth;
    if (totalBarWidthPercentage > 100) {
        const scaleFactor = 100 / totalBarWidthPercentage;
        redSegmentWidth *= scaleFactor;
        greenSegmentWidth *= scaleFactor;
        blueSegmentWidth *= scaleFactor;
        orangeSegmentWidth *= scaleFactor;
    }
    // Ensure individual segments are not negative and cap at 100
    redSegmentWidth = Math.max(0, Math.min(redSegmentWidth, 100));
    greenSegmentWidth = Math.max(0, Math.min(greenSegmentWidth, 100));
    blueSegmentWidth = Math.max(0, Math.min(blueSegmentWidth, 100));
    orangeSegmentWidth = Math.max(0, Math.min(orangeSegmentWidth, 100));
  }


  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-base font-medium text-neutral-dark flex items-center">
          {icon && <span className="mr-2.5">{icon}</span>}
          {label}
        </span>
        <span className={`text-base font-medium ${statusColorClass}`}>
          {statusText}
        </span>
      </div>
      <div className="w-full bg-neutral-light rounded-full h-5 shadow-inner flex overflow-hidden">
        {redSegmentWidth > 0 && (
          <div
            className="bg-red-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${redSegmentWidth}%` }}
            title={`Intag: ${currentRounded} ${unit} (Under rekommenderat minimum: ${minSafeThresholdRounded} ${unit})`}
          ></div>
        )}
        {greenSegmentWidth > 0 && (
          <div
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${greenSegmentWidth}%`}}
            title={`Intag: ${currentRounded} ${unit}`}
          ></div>
        )}
        {blueSegmentWidth > 0 && (
            <div
                className="bg-blue-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${blueSegmentWidth}%` }}
                title={`Använder ${amountCoveredByBankTodayRounded.toFixed(0)} kcal från sparpotten`}
            ></div>
        )}
        {orangeSegmentWidth > 0 && (
            <div
                className="bg-orange-400 h-full transition-all duration-300 ease-out"
                style={{ width: `${orangeSegmentWidth}%` }}
                title={`Överskridit mål (efter ev. bank)`}
            ></div>
        )}
        {/* Fallback for empty bar if all segments are 0 but bar should show */}
        {redSegmentWidth === 0 && greenSegmentWidth === 0 && blueSegmentWidth === 0 && orangeSegmentWidth === 0 && (
             <div className="bg-neutral-light h-full w-full"></div>
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