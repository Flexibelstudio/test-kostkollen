import React, { useState, useEffect } from 'react';
import { CoachViewMember, AIDataForCoachSummary } from '../types';
import { fetchDetailedMemberDataForCoach } from '../services/firestoreService';
import { getAICoachSummaryForMember } from '../services/geminiService';
import { UserCircleIcon, XMarkIcon, SparklesIcon } from './icons';
import { Avatar } from './UserProfileModal';


interface MemberDetailModalProps {
    member: CoachViewMember | null;
    onClose: () => void;
}

const StatDisplay: React.FC<{ label: string; value: string | number | undefined }> = ({ label, value }) => (
    <div>
        <p className="text-sm text-neutral">{label}</p>
        <p className="text-base font-semibold text-neutral-dark">{value || 'N/A'}</p>
    </div>
);

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ member, onClose }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [detailedData, setDetailedData] = useState<AIDataForCoachSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (member) {
            const getSummary = async () => {
                setIsLoading(true);
                setError(null);
                setSummary(null);
                setDetailedData(null);
                try {
                    const fetchedDetailedData = await fetchDetailedMemberDataForCoach(member.id);
                    setDetailedData(fetchedDetailedData);
                    const aiSummary = await getAICoachSummaryForMember(fetchedDetailedData);
                    setSummary(aiSummary);
                } catch (e: any) {
                    setError(e.message || "Ett fel uppstod vid hämtning av data.");
                } finally {
                    setIsLoading(false);
                }
            };
            getSummary();
        }
    }, [member]);

    if (!member) return null;

    const latestLog = detailedData?.last5WeightLogs && detailedData.last5WeightLogs.length > 0
        ? detailedData.last5WeightLogs[detailedData.last5WeightLogs.length - 1]
        : null;

    return (
        <div
            className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-detail-title"
        >
            <div
                className="bg-white p-6 rounded-xl shadow-soft-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-start justify-between mb-4 pb-4 border-b border-neutral-light/70">
                    <div className="flex items-center gap-3">
                        <Avatar photoURL={member.photoURL} gender={member.gender} size={56} />
                        <div>
                            <h2 id="member-detail-title" className="text-2xl font-bold text-neutral-dark">
                                {member.name}
                            </h2>
                            <p className="text-sm text-neutral">{member.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90"
                        aria-label="Stäng medlemsdetaljer"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                        <StatDisplay label="Status" value={member.status === 'approved' ? 'Godkänd' : 'Väntar'} />
                        <StatDisplay label="Streak" value={`${member.currentStreak || 0} dagar`} />
                        <StatDisplay label="Senaste Logg" value={member.lastLogDate} />
                        <StatDisplay label="Mål" value={member.goalSummary} />
                    </div>
                    
                    {latestLog && (
                        <div className="mb-5">
                            <h3 className="text-lg font-semibold text-neutral-dark mb-2">Senaste Mätning ({new Date(latestLog.loggedAt).toLocaleDateString('sv-SE')})</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                               <StatDisplay label="Vikt" value={`${latestLog.weightKg.toFixed(1)} kg`} />
                               {latestLog.skeletalMuscleMassKg != null && (
                                   <StatDisplay label="Muskler" value={`${latestLog.skeletalMuscleMassKg.toFixed(1)} kg`} />
                               )}
                               {latestLog.bodyFatMassKg != null && (
                                   <StatDisplay label="Fett" value={`${latestLog.bodyFatMassKg.toFixed(1)} kg`} />
                               )}
                           </div>
                        </div>
                    )}

                    <section className="bg-primary-100/50 p-4 rounded-lg border border-primary-200">
                        <h3 className="text-lg font-semibold text-primary-darker mb-2 flex items-center">
                            <SparklesIcon className="w-5 h-5 mr-2" />
                            AI-Sammanfattning
                        </h3>
                        {isLoading && !detailedData && (
                             <div className="flex items-center justify-center p-4 text-neutral-dark h-full">
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mr-3"></div>
                                Genererar sammanfattning...
                            </div>
                        )}
                        {error && !isLoading && (
                            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
                                <p>{error}</p>
                            </div>
                        )}
                        {summary && !isLoading && (
                             <div className="text-neutral-dark space-y-3">
                                {summary.split('\n\n').map((paragraph, index) => (
                                    <div key={index}>
                                        {paragraph.split('\n').map((line, lineIndex) => {
                                            if (line.startsWith('**')) {
                                                return <p key={lineIndex} className="font-bold mt-2">{line.replace(/\*\*/g, '')}</p>
                                            }
                                            if (line.startsWith('* ')) {
                                                return <p key={lineIndex} className="ml-4 text-sm">{line}</p>
                                            }
                                            return <p key={lineIndex} className="text-sm">{line}</p>
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default MemberDetailModal;