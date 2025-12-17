
import React from 'react';
import { TimelineMilestone, WeightLogEntry, GoalType } from '../types';
import { CheckCircleIcon, XCircleIcon } from './icons';

const GoalTimeline: React.FC<{ 
    milestones: TimelineMilestone[],
    paceFeedback: { type: string, text: string } | null,
    weightLogs: WeightLogEntry[],
    goalType: GoalType,
    currentAppDate: Date
}> = ({ milestones, paceFeedback, weightLogs, goalType, currentAppDate }) => {
    const getStatusForMilestone = (milestone: TimelineMilestone): 'on_track' | 'off_track' | 'neutral' => {
        const milestoneDate = new Date(milestone.isoDate);
        if (milestoneDate > currentAppDate) return 'neutral';

        const relevantLogs = weightLogs.filter(log => new Date(log.loggedAt) <= milestoneDate);
        if (relevantLogs.length === 0) return 'neutral';

        const lastLogBeforeMilestone = relevantLogs[relevantLogs.length - 1];
        
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
                    paceFeedback.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-100' :
                    paceFeedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100' :
                    'bg-blue-50 text-blue-800 border border-blue-100'
                }`}>
                {paceFeedback.text}
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
                                {status === 'on_track' && <CheckCircleIcon className="w-full h-full text-green-500" />}
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
