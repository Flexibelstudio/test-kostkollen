import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfileData, GoalSettings, ActivityLevel, GoalType } from '../types';
import { calculateRecommendations, deriveEffectiveGoalType } from '../utils/nutritionalCalculations';
import BmrTdeeInfoModal from './BmrTdeeInfoModal';
import { InformationCircleIcon, CheckCircleIcon, CheckIcon, PencilIcon, ExclamationTriangleIcon, XMarkIcon } from './icons';

const activityLevelOptions: { value: ActivityLevel; emoji: string; label: string; description: string; example: string }[] = [
    {
        value: 'sedentary',
        emoji: '🪑',
        label: 'Stillasittande',
        description: 'Lite vardagsrörelse och ingen eller mycket lite träning.',
        example: 'Exempel: stillasittande jobb, bilpendling, ingen träning i veckan.'
    },
    {
        value: 'light',
        emoji: '🚶',
        label: 'Lätt aktiv',
        description: 'Viss vardagsrörelse och/eller träning 1–3 gånger per vecka.',
        example: 'Exempel: promenader, hushållsarbete, cykel till jobbet eller kortare träningspass ibland.'
    },
    {
        value: 'moderate',
        emoji: '🧘',
        label: 'Medelaktiv',
        description: 'Regelbunden rörelse och träning 3–5 gånger per vecka.',
        example: 'Exempel: styrketräning, gruppträning, yoga, cykling eller aktiv fritid.'
    },
    {
        value: 'active',
        emoji: '🏋️',
        label: 'Högaktiv',
        description: 'Daglig träning eller ett aktivt arbete där du står, går eller rör dig mycket.',
        example: 'Exempel: 6–7 träningspass i veckan, eller jobb som pedagog, PT eller inom vård och omsorg.'
    },
    {
        value: 'very_active',
        emoji: '🔥',
        label: 'Extremt aktiv',
        description: 'Hård träning och/eller fysiskt krävande arbete – ofta flera pass per dag.',
        example: 'Exempel: idrottare, byggarbetare som tränar tungt, dubbelpass eller mycket hög träningsvolym.'
    }
];

const ProfileAndGoalEditor: React.FC<{
    initialProfile: UserProfileData;
    initialGoals: GoalSettings;
    onSave: (profile: UserProfileData, goals: GoalSettings) => void;
}> = ({ initialProfile, initialGoals, onSave }) => {
    const [profile, setProfile] = useState(initialProfile);
    const [showSavedMessage, setShowSavedMessage] = useState(false);
    const [showBmrTdeeInfoModal, setShowBmrTdeeInfoModal] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setProfile(initialProfile);
        }
    }, [initialProfile, isEditing]);
    
    useEffect(() => {
        const newGoalType = deriveEffectiveGoalType(profile);
        if (profile.goalType !== newGoalType) {
            setProfile(prev => ({ ...prev, goalType: newGoalType }));
        }
    }, [profile.measurementMethod, profile.desiredWeightChangeKg, profile.desiredFatMassChangeKg, profile.desiredMuscleMassChangeKg, profile.goalType]);

    const recommendations = useMemo(() => {
        if (profile.currentWeightKg && profile.heightCm && profile.ageYears) {
            return calculateRecommendations(profile);
        }
        return null;
    }, [profile]);


    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string; type: string } }) => {
        const { name, value } = e.target;
        
        let updatedProfile = {
          ...profile,
          [name]: (name === 'currentWeightKg' || name === 'heightCm' || name === 'ageYears' || name === 'skeletalMuscleMassKg' || name === 'bodyFatMassKg' || name === 'desiredFatMassChangeKg' || name === 'desiredMuscleMassChangeKg' || name === 'desiredWeightChangeKg')
                   ? (value === '' ? undefined : parseFloat(value))
                   : value,
        };

        // Enforce one goal at a time for 'inbody'
        if (name === 'desiredFatMassChangeKg' && value !== '' && parseFloat(value) !== 0) {
            updatedProfile.desiredMuscleMassChangeKg = undefined;
        } else if (name === 'desiredMuscleMassChangeKg' && value !== '' && parseFloat(value) !== 0) {
            updatedProfile.desiredFatMassChangeKg = undefined;
        }
        
        setProfile(updatedProfile);
    };
     const handleAdjustBodyCompGoal = useCallback((field: 'desiredFatMassChangeKg' | 'desiredMuscleMassChangeKg' | 'desiredWeightChangeKg', direction: 'increase' | 'decrease') => {
        const amount = 0.5;
        setProfile(prev => {
        const currentValue = prev[field] === undefined ? 0 : Number(prev[field]);
        let newValue = direction === 'increase' ? currentValue + amount : currentValue - amount;
        newValue = Math.round(newValue * 10) / 10;
        
        const updatedProfile = { ...prev, [field]: newValue };
        
        // Enforce one goal at a time for 'inbody'
        if (field === 'desiredFatMassChangeKg' && newValue !== 0) {
            updatedProfile.desiredMuscleMassChangeKg = undefined;
        } else if (field === 'desiredMuscleMassChangeKg' && newValue !== 0) {
            updatedProfile.desiredFatMassChangeKg = undefined;
        }

        return updatedProfile;
        });
    }, []);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const newGoals: GoalSettings = recommendations
            ? {
                calorieGoal: Math.round(recommendations.recommendedCalories),
                proteinGoal: Math.round(recommendations.recommendedProteinGrams),
                carbohydrateGoal: Math.round(recommendations.recommendedCarbsGrams),
                fatGoal: Math.round(recommendations.recommendedFatGrams),
              }
            : initialGoals; // Fallback to initialGoals if recommendations can't be calculated
        onSave(profile, newGoals);
        setShowSavedMessage(true);
        setTimeout(() => setShowSavedMessage(false), 3000);
        setIsEditing(false);
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setProfile(initialProfile);
    };
    
    const handleResetGoals = (e: React.FormEvent) => {
        e.preventDefault();
        setProfile(prev => ({
            ...prev,
            mainGoalCompleted: true, // Mark current as done
            desiredFatMassChangeKg: undefined,
            desiredMuscleMassChangeKg: undefined,
            desiredWeightChangeKg: undefined,
            goalCompletionDate: undefined
        }));
        setShowResetConfirmModal(false);
        // Save will be triggered by the main save button
    }
    
    const goalTypeDisplayMap: Record<GoalType, string> = {
        lose_fat: 'Minska fettmassa / vikt',
        maintain: 'Behålla nuvarande vikt/sammansättning',
        gain_muscle: 'Öka muskelmassa / vikt',
    };

    const inputClass = "mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
    const compactInputClass = "w-20 text-center px-2 py-1.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-base";
    const stepperButtonClass = "px-2.5 py-1 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary active:scale-90 text-lg font-semibold interactive-transition";


    return (
        <section aria-labelledby="profile-goal-editor-heading" className="bg-white p-4 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
            <div className="flex justify-between items-center mb-4">
                <h3 id="profile-goal-editor-heading" className="text-xl font-semibold text-neutral-dark">Min Profil & Mål</h3>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="flex items-center px-3 py-1.5 text-sm font-medium text-neutral-dark bg-neutral-light hover:bg-gray-200 rounded-md shadow-sm active:scale-95 interactive-transition">
                        <PencilIcon className="w-4 h-4 mr-1.5" /> Redigera
                    </button>
                )}
            </div>

            {isEditing ? (
                <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
                    {/* Activity Level */}
                    <section aria-labelledby="activity-level-heading">
                        <h4 id="activity-level-heading" className="text-lg font-semibold text-neutral-dark mb-3">Aktivitetsnivå</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {activityLevelOptions.map(opt => (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onClick={() => handleProfileChange({ target: { name: 'activityLevel', value: opt.value, type: 'select' } } as any)}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                                        profile.activityLevel === opt.value
                                            ? 'bg-primary-100/70 border-primary shadow-md'
                                            : 'bg-neutral-light/60 border-neutral-light hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">{opt.emoji}</span>
                                        <div>
                                            <p className={`font-semibold ${profile.activityLevel === opt.value ? 'text-primary-darker' : 'text-neutral-dark'}`}>{opt.label}</p>
                                            <p className="text-xs text-neutral-dark">{opt.description}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                    
                    {/* Measurement Method */}
                    <section aria-labelledby="measurement-method-heading">
                        <h4 id="measurement-method-heading" className="text-lg font-semibold text-neutral-dark mb-2">Hur mäter du dig?</h4>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => setProfile(prev => ({ ...prev, measurementMethod: 'inbody' }))}
                                className={`flex-1 text-center px-4 py-3 rounded-lg border-2 font-semibold transition-colors duration-200 ${profile.measurementMethod === 'inbody' ? 'bg-primary-100/70 border-primary text-primary-darker' : 'bg-neutral-light border-neutral-light hover:border-gray-300'}`}
                            >
                                InBody / Avancerad våg
                            </button>
                            <button
                                type="button"
                                onClick={() => setProfile(prev => ({ ...prev, measurementMethod: 'scale' }))}
                                className={`flex-1 text-center px-4 py-3 rounded-lg border-2 font-semibold transition-colors duration-200 ${profile.measurementMethod === 'scale' ? 'bg-primary-100/70 border-primary text-primary-darker' : 'bg-neutral-light border-neutral-light hover:border-gray-300'}`}
                            >
                                Vanlig våg
                            </button>
                        </div>
                    </section>

                    {/* Body Comp Goals */}
                    <section aria-labelledby="body-composition-goals-heading">
                        <h4 id="body-composition-goals-heading" className="text-lg font-semibold text-neutral-dark mb-2">Önskad förändring</h4>
                         {profile.measurementMethod === 'scale' ? (
                             <div className="animate-fade-in">
                                <label htmlFor="desiredWeightChangeKg" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad viktförändring (kg)</label>
                                <div className="flex items-center space-x-2">
                                    <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska">-</button>
                                    <input type="number" name="desiredWeightChangeKg" id="desiredWeightChangeKg" value={profile.desiredWeightChangeKg == null ? '' : profile.desiredWeightChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                    <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka">+</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label htmlFor="desiredFatMassChangeKg" className="block text-base font-medium text-neutral-dark mb-1.5">Fettmassaförändring (kg)</label>
                                    <div className="flex items-center space-x-2">
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska">-</button>
                                        <input type="number" name="desiredFatMassChangeKg" id="desiredFatMassChangeKg" value={profile.desiredFatMassChangeKg == null ? '' : profile.desiredFatMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="desiredMuscleMassChangeKg" className="block text-base font-medium text-neutral-dark mb-1.5">Muskelmassaförändring (kg)</label>
                                    <div className="flex items-center space-x-2">
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska">-</button>
                                        <input type="number" name="desiredMuscleMassChangeKg" id="desiredMuscleMassChangeKg" value={profile.desiredMuscleMassChangeKg == null ? '' : profile.desiredMuscleMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka">+</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="mt-4">
                            <label htmlFor="goalCompletionDate" className="block text-base font-medium text-neutral-dark mb-1.5">Måldatum</label>
                            <input type="date" name="goalCompletionDate" id="goalCompletionDate" value={profile.goalCompletionDate || ''} onChange={handleProfileChange} className={inputClass} min={new Date().toISOString().split('T')[0]} />
                        </div>
                    </section>

                    {/* Save/Cancel Buttons */}
                    <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-neutral-light/70">
                        <button type="button" onClick={handleCancel} className="px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md active:scale-95 transform interactive-transition">
                            Avbryt
                        </button>
                        <button type="submit" className="px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 transform interactive-transition">
                            <CheckIcon className="w-5 h-5 inline mr-1.5" />
                            Spara ändringar
                        </button>
                    </div>

                </form>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    {/* Summary View */}
                    <div className="p-4 bg-neutral-light/50 rounded-lg">
                        <p className="text-sm font-medium text-neutral">Aktivitetsnivå</p>
                        <p className="text-base text-neutral-dark">{activityLevelOptions.find(o => o.value === profile.activityLevel)?.label || 'Ej satt'}</p>
                    </div>
                     <div className="p-4 bg-neutral-light/50 rounded-lg">
                        <p className="text-sm font-medium text-neutral">Mätmetod</p>
                        <p className="text-base text-neutral-dark">{profile.measurementMethod === 'inbody' ? 'InBody / Avancerad våg' : 'Vanlig våg'}</p>
                    </div>
                    {recommendations && (
                        <div className="p-4 bg-primary-100/50 rounded-lg">
                             <div className="flex justify-between items-center mb-2">
                                <p className="text-sm font-medium text-neutral">Rekommenderade Mål</p>
                                <button onClick={() => setShowBmrTdeeInfoModal(true)} className="text-primary hover:underline text-xs flex items-center gap-1">
                                    <InformationCircleIcon className="w-4 h-4" /> Info BMR/TDEE
                                </button>
                             </div>
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm text-neutral-dark">
                                <div><strong>{Math.round(recommendations.recommendedCalories)}</strong> kcal</div>
                                <div><strong>{Math.round(recommendations.recommendedProteinGrams)} g</strong> Protein</div>
                                <div><strong>{Math.round(recommendations.recommendedCarbsGrams)} g</strong> Kolh.</div>
                                <div><strong>{Math.round(recommendations.recommendedFatGrams)} g</strong> Fett</div>
                             </div>
                        </div>
                    )}
                    {showSavedMessage && (
                        <div className="p-3 bg-green-100 text-green-700 rounded-md text-center text-sm font-medium flex items-center justify-center animate-fade-in">
                            <CheckCircleIcon className="w-5 h-5 mr-2" /> Profil & mål sparade!
                        </div>
                    )}
                </div>
            )}
             {isEditing && !profile.mainGoalCompleted && (profile.desiredFatMassChangeKg || profile.desiredMuscleMassChangeKg || profile.desiredWeightChangeKg) && (
                 <div className="mt-6 pt-4 border-t border-dashed border-neutral-light/80 text-center">
                    <button
                        type="button"
                        onClick={() => setShowResetConfirmModal(true)}
                        className="text-sm text-neutral hover:text-red-600 hover:underline"
                    >
                        Har du uppnått ditt mål eller vill du nollställa det? Klicka här.
                    </button>
                 </div>
            )}

            {showBmrTdeeInfoModal && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowBmrTdeeInfoModal(false)}>
                    <BmrTdeeInfoModal onClose={() => setShowBmrTdeeInfoModal(false)} />
                </div>
            )}
            
            {showResetConfirmModal && (
                <div
                    className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
                    onClick={() => setShowResetConfirmModal(false)}
                >
                    <div className="bg-white p-6 rounded-lg shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-neutral-dark mb-4 flex items-center"><ExclamationTriangleIcon className="w-6 h-6 mr-2 text-yellow-500"/> Bekräfta nollställning</h3>
                        <p className="text-neutral mb-6">
                            Detta kommer att markera ditt nuvarande mål som slutfört och nollställa dina önskade förändringar. Du kan sedan sätta ett nytt mål. Vill du fortsätta?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setShowResetConfirmModal(false)} className="px-4 py-2 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md active:scale-95 interactive-transition">Avbryt</button>
                            <button onClick={handleSave} className="px-4 py-2 text-white bg-primary hover:bg-primary-darker rounded-md active:scale-95 interactive-transition">Ja, nollställ</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ProfileAndGoalEditor;
