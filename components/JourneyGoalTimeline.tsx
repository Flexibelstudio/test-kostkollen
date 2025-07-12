

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
            <div className="bg-white p-6 rounded-xl shadow-soft-lg border border-neutral-light text-center">
                <p className="text-neutral-dark text-lg">Ange ett mål och ett måldatum för att se din personliga tidslinje här.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
            <h3 id="goal-timeline-heading" className="text-xl font-semibold text-neutral-dark mb-3">Din Tidslinje till Målet</h3>
            {paceFeedback && (
                <div className={`p-3 mb-4 rounded-md text-sm font-medium ${
                    paceFeedback.type === 'warning' ? 'bg-red-100 text-red-800' :
                    paceFeedback.type === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                }`}>
                {paceFeedback.text}
                </div>
            )}
            <div className="relative pl-4">
                <div className="absolute top-2 bottom-2 left-3 w-0.5 bg-primary-200 rounded-full"></div>
                <ul className="space-y-6">
                    {milestones.map((milestone, index) => {
                        const status = getStatusForMilestone(milestone);
                        return (
                            <li key={index} className="relative flex items-start">
                                <div className={`absolute left-0 top-1.5 flex items-center justify-center w-6 h-6 rounded-full z-10 ${milestone.isFinal ? 'bg-primary' : (status !== 'neutral' ? 'bg-white' : 'bg-primary-200')}`} style={{ transform: 'translateX(-50%)' }}>
                                    {status === 'on_track' && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                                    {status === 'off_track' && <XCircleIcon className="w-6 h-6 text-red-500" />}
                                    {status === 'neutral' && <div className={`w-2.5 h-2.5 rounded-full ${milestone.isFinal ? 'bg-white' : 'bg-primary'}`}></div>}
                                </div>
                                <div className="ml-8">
                                    <p className={`font-bold ${milestone.isFinal ? 'text-primary' : 'text-primary-darker'}`}>{milestone.dateString}</p>
                                    <p className="text-neutral-dark text-sm">{milestone.targetDescription}</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};

export default GoalTimeline;