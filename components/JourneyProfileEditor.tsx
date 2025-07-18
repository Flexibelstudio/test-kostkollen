
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfileData, GoalSettings, ActivityLevel, GoalType } from '../types';
import { calculateRecommendations, deriveEffectiveGoalType } from '../utils/nutritionalCalculations';
import BmrTdeeInfoModal from './BmrTdeeInfoModal';
import { InformationCircleIcon, CheckCircleIcon, CheckIcon, PencilIcon, ExclamationTriangleIcon, XMarkIcon } from './icons';

const activityLevelOptions: { value: ActivityLevel; label: string }[] = [
    { value: 'sedentary', label: 'Stillasittande (lite/ingen träning)' },
    { value: 'light', label: 'Lätt aktiv (träning 1-3 dgr/v)' },
    { value: 'moderate', label: 'Måttligt aktiv (träning 3-5 dgr/v)' },
    { value: 'active', label: 'Aktiv (träning 6-7 dgr/v)' },
    { value: 'very_active', label: 'Mycket aktiv (hård träning/fysiskt jobb)' },
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
        setProfile(initialProfile);
    }, [initialProfile, initialGoals]);
    
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


    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({
          ...prev,
          [name]: (name === 'currentWeightKg' || name === 'heightCm' || name === 'ageYears' || name === 'skeletalMuscleMassKg' || name === 'bodyFatMassKg' || name === 'desiredFatMassChangeKg' || name === 'desiredMuscleMassChangeKg' || name === 'desiredWeightChangeKg')
                   ? (value === '' ? undefined : parseFloat(value))
                   : value,
        }));
    };
     const handleAdjustBodyCompGoal = useCallback((field: 'desiredFatMassChangeKg' | 'desiredMuscleMassChangeKg' | 'desiredWeightChangeKg', direction: 'increase' | 'decrease') => {
        const amount = 0.5;
        setProfile(prev => {
        const currentValue = prev[field] === undefined ? 0 : Number(prev[field]);
        let newValue = direction === 'increase' ? currentValue + amount : currentValue - amount;
        newValue = Math.round(newValue * 10) / 10;
        return {
            ...prev,
            [field]: newValue,
        };
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

    const isGoalActive = useMemo(() => {
        if (profile.mainGoalCompleted) return false;
        if (profile.measurementMethod === 'scale') {
            return !!(profile.desiredWeightChangeKg && profile.goalCompletionDate);
        } else {
            return !!((profile.desiredFatMassChangeKg || profile.desiredMuscleMassChangeKg) && profile.goalCompletionDate);
        }
    }, [profile]);
    
    const handleUpdateGoalClick = () => {
        if (isGoalActive) {
            setShowResetConfirmModal(true);
        } else {
            setIsEditing(true);
        }
    };
    
    const confirmGoalReset = () => {
        setShowResetConfirmModal(false);
        setIsEditing(true);
    };

    const inputClass = "mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
    const goalTypeDisplayMap: Record<GoalType, string> = {
        lose_fat: 'Minska fettmassa / vikt', maintain: 'Behålla nuvarande vikt/sammansättning', gain_muscle: 'Öka muskelmassa / vikt'
    };
    const compactInputClass = "w-20 text-center px-2 py-1.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-base";
    const stepperButtonClass = "px-2.5 py-1 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary active:scale-90 text-lg font-semibold interactive-transition";
    const canSave = profile.currentWeightKg && profile.heightCm && profile.ageYears;

    
    return (
        <>
            <form onSubmit={handleSave} className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                
                 {/* ALWAYS VISIBLE: Calculated Goals */}
                <section aria-labelledby="calculated-goals-heading" className="mb-6">
                    <h4 id="calculated-goals-heading" className="text-lg font-semibold text-neutral-dark mb-4 text-center">Dina Beräknade Dagliga Mål</h4>
                    {recommendations ? (
                        <div className="p-4 bg-primary-100/60 border border-primary-200/80 rounded-lg space-y-4">
                            <div className="p-3 mb-2 bg-white/50 rounded-md border border-primary-200/50">
                                <p className="text-base font-medium text-neutral-dark text-center">
                                    Baserat på dina val blir ditt primära mål: <strong className="text-primary-darker">{goalTypeDisplayMap[profile.goalType]}</strong>
                                </p>
                            </div>
                            <div className="flex justify-center items-center text-center space-x-6">
                                <p>
                                    BMR: <strong className="text-xl font-semibold text-primary">{recommendations.bmr} kcal</strong>
                                </p>
                                <p>
                                    TDEE: <strong className="text-xl font-semibold text-primary">{recommendations.tdee} kcal</strong>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowBmrTdeeInfoModal(true)}
                                    className="p-1 text-primary hover:text-primary-darker rounded-full hover:bg-primary-100"
                                    aria-label="Information om BMR och TDEE"
                                >
                                    <InformationCircleIcon className="w-5 h-5"/>
                                </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 pt-3 border-t border-primary-200/50">
                                <div className="text-center">
                                    <p className="text-sm font-medium text-neutral-dark">Kalorier</p>
                                    <p className="text-lg font-bold text-neutral-darker">{Math.round(recommendations.recommendedCalories)} kcal</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-neutral-dark">Protein</p>
                                    <p className="text-lg font-bold text-neutral-darker">{Math.round(recommendations.recommendedProteinGrams)} g</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-neutral-dark">Kolhydrater</p>
                                    <p className="text-lg font-bold text-neutral-darker">{Math.round(recommendations.recommendedCarbsGrams)} g</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-neutral-dark">Fett</p>
                                    <p className="text-lg font-bold text-neutral-darker">{Math.round(recommendations.recommendedFatGrams)} g</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-neutral text-center">Fyll i dina profildata för att se dina beräknade mål.</p>
                    )}
                </section>
                
                {isEditing ? (
                    // EDITING VIEW
                    <div className="space-y-6 animate-fade-in pt-6 border-t border-neutral-light/70">
                        <section aria-labelledby="journey-details-heading">
                            <h4 id="journey-details-heading" className="text-lg font-semibold text-neutral-dark mb-3">Din Profil</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                                <div>
                                    <label htmlFor="currentWeightKg-editor" className="block text-base font-medium text-neutral-dark">Nuvarande vikt (kg)</label>
                                    <input type="number" name="currentWeightKg" id="currentWeightKg-editor" value={profile.currentWeightKg == null ? '' : profile.currentWeightKg} onChange={handleProfileChange} className={inputClass} min="1" step="0.1" placeholder="T.ex. 70" required />
                                </div>
                                <div>
                                    <label htmlFor="activityLevel-editor" className="block text-base font-medium text-neutral-dark">Aktivitetsnivå</label>
                                    <select name="activityLevel" id="activityLevel-editor" value={profile.activityLevel} onChange={handleProfileChange} className={inputClass} required>
                                        {activityLevelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section aria-labelledby="measurement-method-heading-editor">
                            <h4 id="measurement-method-heading-editor" className="text-lg font-semibold text-neutral-dark mb-2">Hur mäter du dig?</h4>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button type="button" onClick={() => setProfile(prev => ({ ...prev, measurementMethod: 'inbody' }))} className={`flex-1 text-center px-4 py-3 rounded-lg border-2 font-semibold transition-colors duration-200 ${profile.measurementMethod === 'inbody' ? 'bg-primary-100/70 border-primary text-primary-darker' : 'bg-neutral-light border-neutral-light hover:border-gray-300'}`}>
                                    InBody / Avancerad våg
                                </button>
                                <button type="button" onClick={() => setProfile(prev => ({ ...prev, measurementMethod: 'scale' }))} className={`flex-1 text-center px-4 py-3 rounded-lg border-2 font-semibold transition-colors duration-200 ${profile.measurementMethod === 'scale' ? 'bg-primary-100/70 border-primary text-primary-darker' : 'bg-neutral-light border-neutral-light hover:border-gray-300'}`}>
                                    Annan våg
                                </button>
                            </div>
                        </section>

                        <section aria-labelledby="body-composition-goals-heading-editor">
                            <h4 id="body-composition-goals-heading-editor" className="text-lg font-semibold text-neutral-dark mb-2">Önskad förändring</h4>
                            <div className="space-y-5">
                                {profile.measurementMethod === 'scale' ? (
                                    <div className="animate-fade-in">
                                        <label htmlFor="desiredWeightChangeKg-editor" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad viktförändring (kg)</label>
                                        <div className="flex items-center space-x-2">
                                            <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'decrease')} className={stepperButtonClass}>-</button>
                                            <input type="number" name="desiredWeightChangeKg" id="desiredWeightChangeKg-editor" value={profile.desiredWeightChangeKg == null ? '' : profile.desiredWeightChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                            <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'increase')} className={stepperButtonClass}>+</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-5 animate-fade-in">
                                        <div>
                                            <label htmlFor="desiredFatMassChangeKg-editor" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad fettmassaförändring (kg)</label>
                                            <div className="flex items-center space-x-2">
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'decrease')} className={stepperButtonClass}>-</button>
                                                <input type="number" name="desiredFatMassChangeKg" id="desiredFatMassChangeKg-editor" value={profile.desiredFatMassChangeKg == null ? '' : profile.desiredFatMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'increase')} className={stepperButtonClass}>+</button>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="desiredMuscleMassChangeKg-editor" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad muskelmassaförändring (kg)</label>
                                            <div className="flex items-center space-x-2">
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'decrease')} className={stepperButtonClass}>-</button>
                                                <input type="number" name="desiredMuscleMassChangeKg" id="desiredMuscleMassChangeKg-editor" value={profile.desiredMuscleMassChangeKg == null ? '' : profile.desiredMuscleMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'increase')} className={stepperButtonClass}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="goalCompletionDate-editor" className="block text-base font-medium text-neutral-dark mb-1.5">Måldatum</label>
                                    <input type="date" name="goalCompletionDate" id="goalCompletionDate-editor" value={profile.goalCompletionDate || ''} onChange={handleProfileChange} className={inputClass} min={new Date().toISOString().split('T')[0]} />
                                </div>
                            </div>
                        </section>
                        
                        <div className="mt-8 pt-6 border-t border-neutral-light/70 flex flex-col sm:flex-row justify-end items-center gap-4">
                            {showSavedMessage && <div className="flex items-center text-base text-green-600 animate-fade-in order-first sm:order-none mr-auto"><CheckCircleIcon className="w-6 h-6 mr-1.5" />Profil och mål har uppdaterats!</div>}
                            <button type="submit" disabled={!canSave} className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-md text-lg font-semibold text-white bg-primary hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 transform interactive-transition disabled:opacity-50">
                                <CheckIcon className="w-5 h-5 inline mr-2" /> Spara Ändringar
                            </button>
                        </div>
                    </div>
                ) : (
                    // DEFAULT VIEW
                    <div className="mt-6 pt-6 border-t border-neutral-light/70 text-center">
                         {showSavedMessage && <div className="flex items-center justify-center text-base text-green-600 animate-fade-in mb-4"><CheckCircleIcon className="w-6 h-6 mr-1.5" />Profil och mål har uppdaterats!</div>}
                        <button type="button" onClick={handleUpdateGoalClick} className="w-full px-6 py-3 bg-secondary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-secondary-darker focus:outline-none focus:ring-2 focus:ring-secondary active:scale-95 transform interactive-transition">
                           <PencilIcon className="w-5 h-5 inline mr-2" /> Uppdatera mål
                        </button>
                    </div>
                )}
            </form>

            {showResetConfirmModal && (
                 <div
                    className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
                    onClick={() => setShowResetConfirmModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-goal-reset-title"
                >
                <div
                    className="bg-white p-6 rounded-lg shadow-soft-xl w-full max-w-sm animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 id="confirm-goal-reset-title" className="text-lg font-semibold text-neutral-dark">Är du säker?</h3>
                            <div className="mt-2">
                                <p className="text-sm text-neutral-dark">
                                    Om du uppdaterar ditt mål kommer dina nuvarande framsteg och tidslinje att nollställas. Ditt gamla mål kommer att raderas.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                        onClick={confirmGoalReset}
                    >
                        Ja, uppdatera
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={() => setShowResetConfirmModal(false)}
                    >
                        Avbryt
                    </button>
                    </div>
                </div>
                </div>
            )}
            
            {showBmrTdeeInfoModal && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setShowBmrTdeeInfoModal(false)}>
                    <div onClick={e => e.stopPropagation()}>
                    <BmrTdeeInfoModal
                        onClose={() => setShowBmrTdeeInfoModal(false)}
                    />
                    </div>
                </div>
            )}
        </>
    );
};

export default ProfileAndGoalEditor;