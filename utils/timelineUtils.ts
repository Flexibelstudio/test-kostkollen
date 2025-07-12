

import { UserProfileData } from '../types.ts';

export interface TimelineMilestone {
  dateString: string; // Formatted date for display
  isoDate: string; // ISO date string (YYYY-MM-DD) for comparisons
  targetDescription: string;
  targetWeightKg: number;
  isFinal: boolean;
}

export const calculateGoalTimeline = (profile: UserProfileData): {
  milestones: TimelineMilestone[];
  paceFeedback: { type: 'warning' | 'info' | 'error'; text: string } | null;
} => {
    const { desiredFatMassChangeKg, desiredMuscleMassChangeKg, currentWeightKg, goalCompletionDate, measurementMethod, desiredWeightChangeKg } = profile;

    let goalChange: number | undefined;
    let goalTypeLabel: string | null = null;

    if (measurementMethod === 'scale') {
        goalChange = desiredWeightChangeKg;
        goalTypeLabel = 'Vikt';
    } else { // 'inbody' or legacy
        // Prioritize fat change for timeline calculation as it's more directly related to weight pace.
        goalChange = desiredFatMassChangeKg ?? desiredMuscleMassChangeKg;
        goalTypeLabel = desiredFatMassChangeKg !== undefined ? 'Fettmassa' : (desiredMuscleMassChangeKg !== undefined ? 'Muskelmassa' : null);
    }
    
    if (!goalChange || !goalCompletionDate || !currentWeightKg) {
      return { milestones: [], paceFeedback: null };
    }
    
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(goalCompletionDate + 'T00:00:00'); // Ensure it's interpreted as local time
    endDate.setHours(0,0,0,0);

    if (endDate <= startDate) {
      return { milestones: [], paceFeedback: { type: 'error', text: "Måldatum måste vara i framtiden." } };
    }

    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) {
      return { milestones: [], paceFeedback: { type: 'error', text: "Måldatum måste vara i framtiden." } };
    }
    const totalWeeks = totalDays / 7;
    const weeklyChange = goalChange / totalWeeks;

    let paceFeedback: { type: 'warning' | 'info' | 'error', text: string } | null = null;
    if (goalChange < 0) { // It's a loss goal
      const weeklyLossKg = Math.abs(weeklyChange);
      const weeklyLossPercentage = (weeklyLossKg / currentWeightKg) * 100;
      if (weeklyLossPercentage > 1.2) {
        paceFeedback = { type: 'warning', text: "⚠️ Detta är en mycket snabb takt (>1.2% av kroppsvikten per vecka). Överväg en mer hållbar plan." };
      } else if (weeklyLossPercentage > 0.8) {
        paceFeedback = { type: 'info', text: "Observera: Detta är en snabb takt. En hållbar takt är ofta 0.5-1% av kroppsvikten per vecka." };
      }
    }

    const milestones: TimelineMilestone[] = [];
    const maxMilestones = 12; // Limit number of milestones shown
    const step = Math.max(1, Math.ceil(totalWeeks / maxMilestones));

    for (let i = 1; i <= totalWeeks; i++) {
        if (i % step === 0 || i === 1) { 
            if (milestones.length >= maxMilestones) break;

            const milestoneDate = new Date(startDate);
            milestoneDate.setDate(startDate.getDate() + i * 7);
            
            const cumulativeChange = weeklyChange * i;
            const targetWeight = currentWeightKg + cumulativeChange;
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
    
    const finalTargetWeight = currentWeightKg + goalChange;
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

    return { milestones, paceFeedback };
};