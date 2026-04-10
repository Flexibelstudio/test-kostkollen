export const calculateProgressPercentage = (
    method: 'scale' | 'inbody' | undefined,
    startWeight?: number, currentWeight?: number, desiredWeightChange?: number,
    startFat?: number, currentFat?: number, desiredFatChange?: number,
    startMuscle?: number, currentMuscle?: number, desiredMuscleChange?: number,
    isGoalCompleted?: boolean
): number => {
    if (isGoalCompleted) return 100;

    let start, current, goalChange;

    const isScaleGoal = method === 'scale';
    const isFatLossGoal = !isScaleGoal && desiredFatChange && desiredFatChange < 0;
    const isMuscleGainGoal = !isScaleGoal && desiredMuscleChange && desiredMuscleChange > 0;

    if (isFatLossGoal) {
        if (currentFat != null && startFat != null) {
            start = startFat;
            current = currentFat;
            goalChange = desiredFatChange;
        } else {
            start = startWeight;
            current = currentWeight;
            goalChange = desiredFatChange;
        }
    } else if (isMuscleGainGoal) {
        if (currentMuscle != null && startMuscle != null) {
            start = startMuscle;
            current = currentMuscle;
            goalChange = desiredMuscleChange;
        } else {
            start = startWeight;
            current = currentWeight;
            goalChange = desiredMuscleChange;
        }
    } else {
        start = startWeight;
        current = currentWeight;
        goalChange = desiredWeightChange;
    }
    
    if (start == null || current == null || !goalChange) return 0;
    
    const totalChangeNeeded = Math.abs(goalChange);
    let changeAchieved;
    
    if (goalChange > 0) { 
        changeAchieved = current - start;
    } else { 
        changeAchieved = start - current;
    }
    
    changeAchieved = Math.max(0, changeAchieved);

    if (totalChangeNeeded < 0.01) return 100;

    const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
    return Math.max(0, Math.min(progressRaw, 100));
};

export const getGoalShortDescription = (
    method: 'scale' | 'inbody' | undefined,
    desiredWeightChange?: number,
    desiredFatChange?: number,
    desiredMuscleChange?: number
): string => {
    if (method === 'scale' && desiredWeightChange) {
        return `Mål: ${desiredWeightChange > 0 ? '+' : ''}${desiredWeightChange} kg`;
    } else if (method === 'inbody') {
        if (desiredFatChange) return `Mål: ${desiredFatChange} kg fett`;
        if (desiredMuscleChange) return `Mål: +${desiredMuscleChange} kg muskler`;
    }
    return 'Mål: Bibehålla';
};
