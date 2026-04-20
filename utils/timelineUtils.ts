
import { UserProfileData, WeightLogEntry } from '../types.ts';
import { CALORIE_ADJUSTMENT } from '../constants.ts';


export interface TimelineMilestone {
  dateString: string; // Formatted date for display
  isoDate: string; // ISO date string (YYYY-MM-DD) for comparisons
  targetDescription: string;
  targetWeightKg: number;
  isFinal: boolean;
}

export const calculateGoalTimeline = (profile: UserProfileData, weightLogs: WeightLogEntry[] = []): {
  milestones: TimelineMilestone[];
  paceFeedback: { type: 'warning' | 'info' | 'error'; text: string } | null;
  metrics: {
      currentPacePerWeek: number;
      requiredPacePerWeek: number;
      projectedFinalWeight: number;
      isHealthyPace: boolean;
      isOffTrack: boolean;
      daysRemaining: number;
  } | null;
} => {
    const { desiredFatMassChangeKg, desiredMuscleMassChangeKg, currentWeightKg, goalCompletionDate, measurementMethod, desiredWeightChangeKg, goalStartDate } = profile;

    let goalChange: number | undefined;
    let goalTypeLabel: string | null = null;

    if (measurementMethod === 'scale') {
        goalChange = desiredWeightChangeKg;
        goalTypeLabel = 'Vikt';
    } else { // 'inbody' or legacy
        // Prioritize fat/muscle change, but FALLBACK to weight change if unavailable.
        if (desiredFatMassChangeKg !== undefined && desiredFatMassChangeKg !== 0 && desiredFatMassChangeKg !== null) {
             goalChange = desiredFatMassChangeKg;
             goalTypeLabel = 'Fettmassa';
        } else if (desiredMuscleMassChangeKg !== undefined && desiredMuscleMassChangeKg !== 0 && desiredMuscleMassChangeKg !== null) {
             goalChange = desiredMuscleMassChangeKg;
             goalTypeLabel = 'Muskelmassa';
        } else {
             // FALLBACK: User has InBody selected but might have only set a general weight goal (or simple setup)
             goalChange = desiredWeightChangeKg;
             goalTypeLabel = 'Vikt (Estimerat)';
        }
    }
    
    if (goalChange === undefined || goalChange === null || goalChange === 0 || !currentWeightKg) {
      return { milestones: [], paceFeedback: null, metrics: null };
    }
    
    // FIX: Use persisted goalStartDate. If none, use today (don't infer from logs, forcing a reset visual)
    let startDate = goalStartDate ? new Date(goalStartDate) : undefined;
    
    // If no goalStartDate, try to infer from the first weight log
    if (!startDate && weightLogs && weightLogs.length > 0) {
        startDate = new Date(weightLogs[0].loggedAt);
    }
    
    // Fallback to today if still no start date
    if (!startDate) {
        startDate = new Date();
    }
    startDate.setHours(0, 0, 0, 0);
    
    // Determine the starting weight for the goal based on the *start date*.
    // If we have a goalStartWeight saved, use it. Otherwise fall back to the first log's weight, or currentWeight.
    let startWeightForCalculation = profile.goalStartWeight;
    if (startWeightForCalculation === undefined && weightLogs && weightLogs.length > 0) {
        startWeightForCalculation = weightLogs[0].weightKg;
    }
    if (startWeightForCalculation === undefined) {
        startWeightForCalculation = currentWeightKg;
    }

    let endDate: Date;
    let paceFeedback: { type: 'warning' | 'info' | 'error', text: string } | null = null;
    
    let metrics = null;

    if (goalCompletionDate) {
        endDate = new Date(goalCompletionDate + 'T00:00:00'); // Ensure it's interpreted as local time
        endDate.setHours(0,0,0,0);

        if (endDate <= startDate) {
            return { milestones: [], paceFeedback: { type: 'error', text: "Måldatum måste vara i framtiden." }, metrics: null };
        }
        
        const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const totalWeeks = totalDays > 0 ? totalDays / 7 : 0;
        const weeklyChange = totalWeeks > 0 ? goalChange / totalWeeks : 0;
        
        // Calculate dynamic metrics
        const today = new Date();
        today.setHours(0,0,0,0);
        const daysElapsed = Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const weightChangedSoFar = currentWeightKg - startWeightForCalculation;
        const weightRemaining = (startWeightForCalculation + goalChange) - currentWeightKg;
        
        const currentPacePerWeek = daysElapsed > 0 ? weightChangedSoFar / (daysElapsed / 7) : 0;
        const requiredPacePerWeek = daysRemaining > 0 ? weightRemaining / (daysRemaining / 7) : 0;
        const projectedFinalWeight = currentWeightKg + (currentPacePerWeek * (daysRemaining / 7));
        
        let isHealthyPace = true;
        let isOffTrack = false;

        if (goalChange < 0) { // It's a loss goal
            const weeklyLossKg = Math.abs(weeklyChange);
            const weeklyLossPercentage = (weeklyLossKg / startWeightForCalculation) * 100;
            
            const requiredLossKg = Math.abs(requiredPacePerWeek);
            const requiredLossPercentage = (requiredLossKg / currentWeightKg) * 100;
            
            if (requiredLossPercentage > 1.2) {
                isHealthyPace = false;
            }
            
            // If required loss is significantly higher than planned loss, user is off track
            if (requiredLossKg > weeklyLossKg + 0.2) {
                isOffTrack = true;
            }

            if (weeklyLossPercentage > 1.2) {
                paceFeedback = { type: 'warning', text: "⚠️ Detta är en mycket snabb takt (>1.2% av kroppsvikten per vecka). Överväg en mer hållbar plan." };
            } else if (weeklyLossPercentage > 0.8) {
                paceFeedback = { type: 'info', text: "Observera: Detta är en snabb takt. En hållbar takt är ofta 0.5-1% av kroppsvikten per vecka." };
            }
        } else if (goalChange > 0 && goalTypeLabel === 'Muskelmassa') { // It's a muscle gain goal
             const weeklyGainKg = Math.abs(weeklyChange);
             const requiredGainKg = Math.abs(requiredPacePerWeek);
             
             if (requiredGainKg > 0.6) {
                 isHealthyPace = false;
             }
             if (requiredGainKg > weeklyGainKg + 0.1) {
                 isOffTrack = true;
             }
             
            if (weeklyGainKg > 0.6) {
                paceFeedback = { type: 'error', text: `Orealistisk takt: ${weeklyGainKg.toFixed(2)} kg/vecka. En så snabb viktökning kommer sannolikt bestå mestadels av fett. En hållbar plan för ${goalChange} kg muskler är ca 3-6 månader.` };
            } else if (weeklyGainKg > 0.4) {
                paceFeedback = { type: 'warning', text: `Ambitiös takt: ${weeklyGainKg.toFixed(2)} kg/vecka. Möjligt, men var medveten om ökad risk för fettinlagring.` };
            } else if (weeklyGainKg >= 0.2) {
                paceFeedback = { type: 'info', text: `✅ Optimal takt: ${weeklyGainKg.toFixed(2)} kg/vecka. Detta är en hållbar takt för muskelökning.` };
            }
        }
        
        metrics = {
            currentPacePerWeek,
            requiredPacePerWeek,
            plannedPacePerWeek: weeklyChange,
            projectedFinalWeight,
            isHealthyPace,
            isOffTrack,
            daysRemaining
        };
        
    } else {
        // NEW LOGIC: Calculate date if not provided
        const caloriesPerKg = 7000;
        const totalCalorieChange = goalChange * caloriesPerKg;
        
        let dailyAdjustment: number;
        if (goalChange < 0) {
            dailyAdjustment = CALORIE_ADJUSTMENT.lose_fat;
        } else {
            dailyAdjustment = CALORIE_ADJUSTMENT.gain_muscle;
        }

        if (dailyAdjustment === 0) {
            return { 
                milestones: [], 
                paceFeedback: { type: 'info', text: "Du har valt att bibehålla vikten, så ingen tidslinje behövs." },
                metrics: {
                    currentPacePerWeek: 0,
                    requiredPacePerWeek: 0,
                    plannedPacePerWeek: 0,
                    projectedFinalWeight: currentWeightKg,
                    isHealthyPace: true,
                    isOffTrack: false,
                    daysRemaining: 0
                }
            };
        }

        const totalDays = Math.abs(totalCalorieChange / dailyAdjustment);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + Math.ceil(totalDays));

        const weeklyChange = totalDays > 0 ? goalChange / (totalDays / 7) : 0;
        const changePerWeekAbs = Math.abs(weeklyChange);
        
        if (goalChange < 0) {
            paceFeedback = { type: 'info', text: `Med ett rekommenderat underskott på ${Math.abs(CALORIE_ADJUSTMENT.lose_fat)} kcal/dag, uppskattas din viktnedgång till ca ${changePerWeekAbs.toFixed(1)} kg/vecka.` };
        } else {
             paceFeedback = { type: 'info', text: `Med ett rekommenderat överskott på ${Math.abs(CALORIE_ADJUSTMENT.gain_muscle)} kcal/dag är detta en hållbar takt för muskelökning.` };
        }
    }

    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) {
        return { milestones: [], paceFeedback, metrics };
    }
    const totalWeeks = totalDays / 7;
    const weeklyChange = goalChange / totalWeeks;


    const milestones: TimelineMilestone[] = [];
    const maxMilestones = 12; // Limit number of milestones shown
    const step = Math.max(1, Math.ceil(totalWeeks / maxMilestones));

    for (let i = 1; i <= totalWeeks; i++) {
        if (i % step === 0 || i === 1) { 
            if (milestones.length >= maxMilestones) break;

            const milestoneDate = new Date(startDate);
            milestoneDate.setDate(startDate.getDate() + i * 7);
            
            const cumulativeChange = weeklyChange * i;
            const targetWeight = startWeightForCalculation + cumulativeChange;
            let targetString = `Total förändring: ${cumulativeChange.toFixed(1)} kg ${goalTypeLabel}`;
            targetString += ` (ca ${targetWeight.toFixed(1)} kg)`;

            milestones.push({
                dateString: milestoneDate.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
                isoDate: milestoneDate.toISOString().split('T')[0],
                targetDescription: targetString,
                targetWeightKg: targetWeight,
                isFinal: false,
            });
        }
    }
    
    const finalTargetWeight = startWeightForCalculation + goalChange;
    let finalTargetString = `Slutmål: ${goalChange.toFixed(1)} kg ${goalTypeLabel}`;
    finalTargetString += ` (ca ${finalTargetWeight.toFixed(1)} kg)`;
    
    const lastMilestoneDate = milestones.length > 0 ? new Date(milestones[milestones.length - 1].isoDate) : new Date(0);
    const daysBetweenLastMilestoneAndEnd = (endDate.getTime() - lastMilestoneDate.getTime()) / (1000 * 60 * 60 * 24);

    if (milestones.length === 0 || daysBetweenLastMilestoneAndEnd > 7) {
        milestones.push({
          dateString: endDate.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }),
          isoDate: endDate.toISOString().split('T')[0],
          targetDescription: finalTargetString,
          targetWeightKg: finalTargetWeight,
          isFinal: true
        });
    } else if (milestones.length > 0) {
        milestones[milestones.length-1] = {
            dateString: endDate.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }),
            isoDate: endDate.toISOString().split('T')[0],
            targetDescription: finalTargetString,
            targetWeightKg: finalTargetWeight,
            isFinal: true
        };
    }

    return { milestones, paceFeedback, metrics };
};
