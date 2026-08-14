
import React from 'react';
import { TimelineMilestone, WeightLogEntry, GoalType, UserProfileData } from '../types';
import { CheckCircleIcon, XCircleIcon } from './icons';

const GoalTimeline: React.FC<{ 
    milestones: TimelineMilestone[],
    paceFeedback: { type: string, text: string } | null,
    metrics?: {
        currentPacePerWeek: number;
        requiredPacePerWeek: number;
        projectedFinalWeight: number;
        isHealthyPace: boolean;
        isOffTrack: boolean;
        daysRemaining: number;
    } | null,
    weightLogs: WeightLogEntry[],
    goalType: GoalType,
    currentAppDate: Date,
    isBootcampActive?: boolean,
    userProfile?: UserProfileData,
    onAdjustGoal?: (type: 'pace' | 'date' | 'auto_adjust') => void
}> = ({ milestones, paceFeedback, metrics, weightLogs, goalType, currentAppDate, isBootcampActive, userProfile, onAdjustGoal }) => {
    const getStatusForMilestone = (milestone: TimelineMilestone): 'on_track' | 'off_track' | 'neutral' => {
        const milestoneDate = new Date(milestone.isoDate);
        milestoneDate.setHours(23, 59, 59, 999); // Include logs from the same day
        
        if (milestoneDate > currentAppDate) return 'neutral';

        const relevantLogs = weightLogs.filter(log => new Date(log.loggedAt) <= milestoneDate);
        if (relevantLogs.length === 0) return 'neutral';

        const lastLogBeforeMilestone = relevantLogs[relevantLogs.length - 1];
        
        // If we have userProfile and targetChangeKg, we can accurately measure the specific metric's delta
        if (userProfile && milestone.targetChangeKg !== undefined) {
            let startMetric = userProfile.goalStartWeight;
            let currentMetric = lastLogBeforeMilestone.weightKg;

            if (goalType === 'lose_fat' && userProfile.measurementMethod === 'inbody') {
                startMetric = userProfile.goalStartFatMassKg ?? startMetric;
                currentMetric = lastLogBeforeMilestone.bodyFatMassKg ?? currentMetric;
            } else if (goalType === 'gain_muscle' && userProfile.measurementMethod === 'inbody') {
                startMetric = userProfile.goalStartMuscleMassKg ?? startMetric;
                currentMetric = lastLogBeforeMilestone.skeletalMuscleMassKg ?? currentMetric;
            }

            if (startMetric !== undefined) {
                const actualChange = currentMetric - startMetric;
                if (goalType === 'lose_fat') {
                    // e.g. target = -0.4, actual = -1.3 -> -1.3 <= -0.4 (TRUE, on track)
                    return actualChange <= milestone.targetChangeKg ? 'on_track' : 'off_track';
                } else if (goalType === 'gain_muscle') {
                    // e.g. target = +0.5, actual = +0.2 -> 0.2 >= 0.5 (FALSE, off track)
                    return actualChange >= milestone.targetChangeKg ? 'on_track' : 'off_track';
                }
            }
        }
        
        // Fallback to absolute weight comparison
        if (goalType === 'lose_fat') {
            return lastLogBeforeMilestone.weightKg <= milestone.targetWeightKg ? 'on_track' : 'off_track';
        } else if (goalType === 'gain_muscle') {
             return lastLogBeforeMilestone.weightKg >= milestone.targetWeightKg ? 'on_track' : 'off_track';
        }
        return 'neutral';
    };

    if (milestones.length === 0) {
        return (
            <div className="bg-neutral-light/30 p-6 rounded-2xl border border-dashed border-neutral-light text-center">
                <p className="text-neutral font-medium">Sätt ett mål och ett datum i din profil för att se din tidslinje här.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-light">
            <h3 id="goal-timeline-heading" className="text-lg font-bold text-neutral-dark mb-4">Tidslinje</h3>
            
            {paceFeedback && (
                <div className={`p-3 mb-5 rounded-xl text-sm font-medium ${
                    paceFeedback.type === 'warning' ? 'bg-[#F6E2D9] text-[#56524D] border border-[#D96E4A]/20' :
                    paceFeedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100' :
                    'bg-[#F6E2D9] text-[#56524D] border border-[#D96E4A]/20'
                }`}>
                {paceFeedback.text}
                </div>
            )}

            {metrics && metrics.isOffTrack && onAdjustGoal && (
                <div className="mb-6 p-4 bg-[#F6E2D9]/40 border border-[#D96E4A]/30 rounded-xl">
                    <h4 className="font-bold text-[#56524D] mb-2">Du ligger efter din plan</h4>
                    
                    {isBootcampActive ? (
                        <div>
                            <p className="text-sm text-[#56524D] mb-3">
                                Med din nuvarande takt beräknas du landa på <strong>{metrics.projectedFinalWeight.toFixed(1)} kg</strong> vid bootcampens slut.
                            </p>
                            {!metrics.isHealthyPace && (
                                <div className="mb-3">
                                    <p className="text-sm text-red-600 font-medium mb-2">
                                        Att nå ditt ursprungliga mål kräver nu ett ohälsosamt tempo ({Math.abs(metrics.requiredPacePerWeek).toFixed(1)} kg/vecka).
                                    </p>
                                    <button 
                                        onClick={() => onAdjustGoal('auto_adjust')}
                                        className="w-full py-2 bg-[#D96E4A] text-white text-sm font-bold rounded-lg hover:bg-[#C05A38] transition-colors"
                                    >
                                        Justera till ett hälsosamt mål
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm text-[#56524D] mb-3">
                                För att nå ditt mål i tid krävs nu en takt på <strong>{Math.abs(metrics.requiredPacePerWeek).toFixed(1)} kg/vecka</strong>.
                            </p>
                            <div className="flex flex-col gap-2">
                                {metrics.isHealthyPace && (
                                    <button 
                                        onClick={() => onAdjustGoal('pace')}
                                        className="w-full py-2 bg-white border border-[#D96E4A]/40 text-[#56524D] text-sm font-bold rounded-lg hover:bg-[#F6E2D9] transition-colors"
                                    >
                                        Behåll måldatum (kräver tuffare tempo)
                                    </button>
                                )}
                                <button 
                                    onClick={() => onAdjustGoal('date')}
                                    className="w-full py-2 bg-[#D96E4A] text-white text-sm font-bold rounded-lg hover:bg-[#C05A38] transition-colors"
                                >
                                    Flytta fram måldatum (behåll hållbart tempo)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="relative pl-4 space-y-6">
                {/* Vertical Line */}
                <div className="absolute top-2 bottom-4 left-[19px] w-0.5 bg-neutral-light rounded-full"></div>
                
                {milestones.map((milestone, index) => {
                    const status = getStatusForMilestone(milestone);
                    return (
                        <div key={index} className="relative flex items-start group">
                            {/* Dot/Icon */}
                            <div className={`
                                absolute left-0 top-0.5 flex items-center justify-center w-10 h-10 rounded-full z-10 border-4 border-white transition-colors
                                ${milestone.isFinal 
                                    ? 'bg-primary text-white shadow-md' 
                                    : (status !== 'neutral' 
                                        ? 'bg-white' 
                                        : 'bg-neutral-light')
                                }
                            `} style={{ transform: 'translateX(-50%)' }}>
                                {status === 'on_track' && <CheckCircleIcon className="w-full h-full text-[#2B3B2C]" />}
                                {status === 'off_track' && <XCircleIcon className="w-full h-full text-red-500" />}
                                {status === 'neutral' && !milestone.isFinal && <div className="w-3 h-3 bg-white rounded-full"></div>}
                                {milestone.isFinal && status === 'neutral' && <span className="text-xs">🏁</span>}
                            </div>

                            {/* Content */}
                            <div className="ml-8 pt-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-sm font-bold ${milestone.isFinal ? 'text-primary-darker' : 'text-neutral-dark'}`}>
                                        {milestone.dateString}
                                    </span>
                                    {milestone.isFinal && <span className="text-[10px] bg-primary-100 text-primary-darker px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Mål</span>}
                                </div>
                                <p className="text-xs text-neutral">
                                    {milestone.targetDescription}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GoalTimeline;
