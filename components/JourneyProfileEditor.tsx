
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfileData, GoalSettings, ActivityLevel, GoalType } from '../types';
import { calculateRecommendations, deriveEffectiveGoalType } from '../utils/nutritionalCalculations';
import { calculateGoalTimeline } from '../utils/timelineUtils';
import BmrTdeeInfoModal from './BmrTdeeInfoModal';
import GoalTimeline from './JourneyGoalTimeline';
import ProteinInfoModal from './ProteinInfoModal';
import { InformationCircleIcon, CheckCircleIcon, CheckIcon, PencilIcon } from './icons';

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

const ToggleSwitch: React.FC<{
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    onChange: () => void;
}> = ({ id, label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 bg-neutral-light/30 rounded-xl hover:bg-neutral-light/50 transition-colors border border-neutral-light/50">
        <div className="pr-4">
            <label htmlFor={id} className="block text-sm font-semibold text-neutral-dark cursor-pointer">{label}</label>
            {description && <p className="text-xs text-neutral mt-0.5">{description}</p>}
        </div>
        <label htmlFor={id} className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input 
                type="checkbox" 
                id={id}
                checked={checked}
                onChange={onChange}
                className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-2 peer-focus:ring-primary-lighter peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
    </div>
);

interface ProfileAndGoalEditorProps {
    initialProfile: UserProfileData;
    initialGoals: GoalSettings;
    onSave: (profile: UserProfileData, goals: GoalSettings) => void;
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
    isFullGoalEdit: boolean;
    latestMeasuredWeight?: number;
    latestMeasuredMuscle?: number;
    latestMeasuredFat?: number;
}

const ProfileAndGoalEditor: React.FC<ProfileAndGoalEditorProps> = ({ 
    initialProfile, 
    initialGoals, 
    onSave,
    isEditing,
    setIsEditing,
    isFullGoalEdit,
    latestMeasuredWeight,
    latestMeasuredMuscle,
    latestMeasuredFat
}) => {
    const [profile, setProfile] = useState(initialProfile);
    const [showSavedMessage, setShowSavedMessage] = useState(false);
    const [showBmrTdeeInfoModal, setShowBmrTdeeInfoModal] = useState<boolean>(false);
    const [showProteinInfoModal, setShowProteinInfoModal] = useState<boolean>(false);
    
    // Manual goals state
    const [isManualGoalMode, setIsManualGoalMode] = useState(false);
    const [manualGoals, setManualGoals] = useState<GoalSettings>(initialGoals);

    // Sync profile when editing starts or stops
    useEffect(() => {
        if (!isEditing) {
            setProfile(initialProfile);
            setManualGoals(initialGoals);
            setIsManualGoalMode(false);
        } else if (isFullGoalEdit) {
            // When full goal edit starts, reset the goal-related fields to allow new input
            // Pre-fill "current" values with latest measurements if available, so user can edit if needed
            setProfile(prev => ({
                ...prev,
                currentWeightKg: latestMeasuredWeight ?? prev.currentWeightKg,
                skeletalMuscleMassKg: latestMeasuredMuscle ?? prev.skeletalMuscleMassKg,
                bodyFatMassKg: latestMeasuredFat ?? prev.bodyFatMassKg,
                mainGoalCompleted: true, 
                desiredFatMassChangeKg: null,
                desiredMuscleMassChangeKg: null,
                desiredWeightChangeKg: null,
                goalCompletionDate: null
            }));
        }
    }, [initialProfile, initialGoals, isEditing, isFullGoalEdit, latestMeasuredWeight, latestMeasuredMuscle, latestMeasuredFat]);
    
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
    
    // Sync manual goals with recommendations if NOT in manual mode
    useEffect(() => {
        if (recommendations && !isManualGoalMode) {
            setManualGoals({
                calorieGoal: Math.round(recommendations.recommendedCalories),
                proteinGoal: Math.round(recommendations.recommendedProteinGrams),
                carbohydrateGoal: Math.round(recommendations.recommendedCarbsGrams),
                fatGoal: Math.round(recommendations.recommendedFatGrams),
            });
        }
    }, [recommendations, isManualGoalMode]);

    const timeline = useMemo(() => {
        // Only calculate and show the projected timeline when actively setting a new goal
        if (isEditing && isFullGoalEdit) {
            return calculateGoalTimeline(profile, []); // Pass empty logs to simulate new timeline
        }
        // Return empty state otherwise to avoid showing it in non-edit mode or simple activity edit
        return { milestones: [], paceFeedback: null };
    }, [profile, isEditing, isFullGoalEdit]);


    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string; type: string } }) => {
        const { name, value } = e.target;
        
        let updatedProfile = {
          ...profile,
          [name]: (name === 'currentWeightKg' || name === 'heightCm' || name === 'ageYears' || name === 'skeletalMuscleMassKg' || name === 'bodyFatMassKg' || name === 'desiredFatMassChangeKg' || name === 'desiredMuscleMassChangeKg' || name === 'desiredWeightChangeKg')
                   ? (value === '' ? undefined : parseFloat(value))
                   : value,
        };

        if (name === 'desiredMuscleMassChangeKg' && typeof updatedProfile.desiredMuscleMassChangeKg === 'number' && updatedProfile.desiredMuscleMassChangeKg < 0) {
            updatedProfile.desiredMuscleMassChangeKg = 0;
        }

        // Enforce one goal at a time for 'inbody'
        if (name === 'desiredFatMassChangeKg' && value !== '' && parseFloat(value) !== 0) {
            updatedProfile.desiredMuscleMassChangeKg = null;
        } else if (name === 'desiredMuscleMassChangeKg' && value !== '' && parseFloat(value) !== 0) {
            updatedProfile.desiredFatMassChangeKg = null;
        }
        
        setProfile(updatedProfile);
    };

    const handleManualGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Parse value, handle empty string as 0 to allow clearing input
        const numValue = value === '' ? 0 : Math.max(0, parseInt(value, 10));

        setManualGoals(prev => {
            // SCENARIO 1: Ändrar Kalorier -> Skala om makros
            if (name === 'calorieGoal') {
                const oldCalories = prev.calorieGoal;
                
                // Räkna ut summan av kalorier från nuvarande makros för att se om de är giltiga
                const totalCurrentMacroEnergy = (prev.proteinGoal * 4) + (prev.carbohydrateGoal * 4) + (prev.fatGoal * 9);
                
                let pRatio = 0.30;
                let cRatio = 0.40;
                let fRatio = 0.30;

                if (oldCalories >= 200 && totalCurrentMacroEnergy > 0) {
                     pRatio = (prev.proteinGoal * 4) / totalCurrentMacroEnergy;
                     cRatio = (prev.carbohydrateGoal * 4) / totalCurrentMacroEnergy;
                     fRatio = (prev.fatGoal * 9) / totalCurrentMacroEnergy;
                }

                return {
                    ...prev,
                    calorieGoal: numValue,
                    proteinGoal: Math.round((numValue * pRatio) / 4),
                    carbohydrateGoal: Math.round((numValue * cRatio) / 4),
                    fatGoal: Math.round((numValue * fRatio) / 9)
                };
            }

            // SCENARIO 2: Ändrar en Makro (P/K/F) -> Räkna om totala kalorier
            const nextGoals = { ...prev, [name]: numValue };

            const newTotalCalories =
                (nextGoals.proteinGoal * 4) +
                (nextGoals.carbohydrateGoal * 4) +
                (nextGoals.fatGoal * 9);

            return {
                ...nextGoals,
                calorieGoal: Math.round(newTotalCalories)
            };
        });
    };

     const handleAdjustBodyCompGoal = useCallback((field: 'desiredFatMassChangeKg' | 'desiredMuscleMassChangeKg' | 'desiredWeightChangeKg', direction: 'increase' | 'decrease') => {
        const amount = 0.5;
        setProfile(prev => {
        const currentValue = prev[field] === undefined ? 0 : Number(prev[field]);
        let newValue = direction === 'increase' ? currentValue + amount : currentValue - amount;
        newValue = Math.round(newValue * 10) / 10;
        
        if (field === 'desiredMuscleMassChangeKg' && newValue < 0) {
            newValue = 0;
        }

        const updatedProfile = { ...prev, [field]: newValue };
        
        // Enforce one goal at a time for 'inbody'
        if (field === 'desiredFatMassChangeKg' && newValue !== 0) {
            updatedProfile.desiredMuscleMassChangeKg = null;
        } else if (field === 'desiredMuscleMassChangeKg' && newValue !== 0) {
            updatedProfile.desiredFatMassChangeKg = null;
        }

        return updatedProfile;
        });
    }, []);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Determine goals to save
        let newGoals: GoalSettings;
        if (isManualGoalMode) {
            newGoals = manualGoals;
        } else if (recommendations) {
            newGoals = {
                calorieGoal: Math.round(recommendations.recommendedCalories),
                proteinGoal: Math.round(recommendations.recommendedProteinGrams),
                carbohydrateGoal: Math.round(recommendations.recommendedCarbsGrams),
                fatGoal: Math.round(recommendations.recommendedFatGrams),
            };
        } else {
            newGoals = initialGoals;
        }
        
        // Ensure isolation between measurement methods and definitve clearing
        let profileToSave = { 
            ...profile,
            desiredWeightChangeKg: profile.measurementMethod === 'scale' ? (profile.desiredWeightChangeKg ?? null) : null,
            desiredFatMassChangeKg: profile.measurementMethod === 'inbody' ? (profile.desiredFatMassChangeKg ?? null) : null,
            desiredMuscleMassChangeKg: profile.measurementMethod === 'inbody' ? (profile.desiredMuscleMassChangeKg ?? null) : null,
        };

        if (isFullGoalEdit) {
            profileToSave.mainGoalCompleted = false;
            // The "Start Weight/Muscle/Fat" for the goal becomes what is currently in the inputs.
            // This handles cases where user switches mode and fills in new baseline data.
            profileToSave.goalStartWeight = profile.currentWeightKg;
            
            // Set start mass values based on measurement method
            if (profile.measurementMethod === 'inbody') {
                profileToSave.goalStartFatMassKg = profile.bodyFatMassKg; 
                profileToSave.goalStartMuscleMassKg = profile.skeletalMuscleMassKg;
            } else {
                profileToSave.goalStartFatMassKg = null; 
                profileToSave.goalStartMuscleMassKg = null;
            }
            
            // FIX: Set start date to FULL ISO STRING to include time.
            // This ensures logs created *before* this moment on the same day are filtered out.
            profileToSave.goalStartDate = new Date().toISOString();
        }

        onSave(profileToSave, newGoals);
        setShowSavedMessage(true);
        setTimeout(() => setShowSavedMessage(false), 3000);
        setIsEditing(false);
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setProfile(initialProfile);
    };
    
    const inputClass = "mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed";
    const compactInputClass = "w-20 text-center px-2 py-1.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-base disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed";
    const stepperButtonClass = "px-2.5 py-1 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary active:scale-90 text-lg font-semibold interactive-transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed";
    const manualInputClass = "block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed font-medium text-right pr-8";


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
                        <h4 id="activity-level-heading" className="text-base font-semibold text-neutral-dark mb-2">Aktivitetsnivå</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {activityLevelOptions.map(opt => (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onClick={() => handleProfileChange({ target: { name: 'activityLevel', value: opt.value, type: 'select' } } as any)}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                                        profile.activityLevel === opt.value
                                            ? 'bg-primary-100/70 border-primary shadow-sm'
                                            : 'bg-white border-neutral-light hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">{opt.emoji}</span>
                                        <div>
                                            <p className={`text-sm font-semibold ${profile.activityLevel === opt.value ? 'text-primary-darker' : 'text-neutral-dark'}`}>{opt.label}</p>
                                            {profile.activityLevel === opt.value && <p className="text-xs text-neutral-dark mt-0.5">{opt.description}</p>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Manual Goals Override */}
                    <section aria-labelledby="manual-goals-heading" className="bg-neutral-light/10 p-4 rounded-xl border border-neutral-light/50">
                        <div className="mb-4">
                            <ToggleSwitch
                                id="manualGoalOverride"
                                label="Ange manuella mål"
                                description="Om du vill styra dina makros helt själv."
                                checked={isManualGoalMode}
                                onChange={() => setIsManualGoalMode(!isManualGoalMode)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <label className="block text-xs font-semibold text-neutral-dark mb-1">Kalorier</label>
                                <input 
                                    type="number" 
                                    name="calorieGoal"
                                    value={manualGoals.calorieGoal}
                                    onChange={handleManualGoalChange}
                                    disabled={!isManualGoalMode}
                                    className={manualInputClass}
                                />
                                <span className="absolute right-3 top-[26px] text-xs text-neutral-400">kcal</span>
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-semibold text-neutral-dark mb-1">Protein</label>
                                <input 
                                    type="number" 
                                    name="proteinGoal"
                                    value={manualGoals.proteinGoal}
                                    onChange={handleManualGoalChange}
                                    disabled={!isManualGoalMode}
                                    className={manualInputClass}
                                />
                                <span className="absolute right-3 top-[26px] text-xs text-neutral-400">g</span>
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-semibold text-neutral-dark mb-1">Kolhydrater</label>
                                <input 
                                    type="number" 
                                    name="carbohydrateGoal"
                                    value={manualGoals.carbohydrateGoal}
                                    onChange={handleManualGoalChange}
                                    disabled={!isManualGoalMode}
                                    className={manualInputClass}
                                />
                                <span className="absolute right-3 top-[26px] text-xs text-neutral-400">g</span>
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-semibold text-neutral-dark mb-1">Fett</label>
                                <input 
                                    type="number" 
                                    name="fatGoal"
                                    value={manualGoals.fatGoal}
                                    onChange={handleManualGoalChange}
                                    disabled={!isManualGoalMode}
                                    className={manualInputClass}
                                />
                                <span className="absolute right-3 top-[26px] text-xs text-neutral-400">g</span>
                            </div>
                        </div>
                        {!isManualGoalMode && (
                            <p className="text-xs text-neutral text-center mt-3 flex items-center justify-center">
                                <InformationCircleIcon className="w-3 h-3 mr-1" /> Värden beräknas automatiskt
                            </p>
                        )}
                    </section>
                    
                     {isFullGoalEdit && (
                        <div className="p-4 bg-secondary-100/60 rounded-lg border border-secondary-200/80 animate-fade-in">
                            <h4 className="text-lg font-semibold text-secondary-darker mb-2">Sätt ditt nya mål</h4>
                            <p className="text-sm text-neutral-dark mb-4">
                                Ange din önskade förändring nedan. Appen kommer automatiskt att beräkna en rekommenderad tidsplan.
                            </p>
                            
                            {/* Measurement Method */}
                            <section aria-labelledby="measurement-method-heading">
                                <h5 id="measurement-method-heading" className="text-sm font-semibold text-neutral-dark mb-2">Mätmetod</h5>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setProfile(prev => ({ ...prev, measurementMethod: 'inbody' }))}
                                        className={`flex-1 text-center px-4 py-2 rounded-lg border-2 font-semibold transition-colors duration-200 text-sm ${profile.measurementMethod === 'inbody' ? 'bg-primary-100/70 border-primary text-primary-darker' : 'bg-white border-neutral-light hover:border-gray-300'}`}
                                    >
                                        InBody / Avancerad
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProfile(prev => ({ ...prev, measurementMethod: 'scale' }))}
                                        className={`flex-1 text-center px-4 py-2 rounded-lg border-2 font-semibold transition-colors duration-200 text-sm ${profile.measurementMethod === 'scale' ? 'bg-primary-100/70 border-primary text-primary-darker' : 'bg-white border-neutral-light hover:border-gray-300'}`}
                                    >
                                        Vanlig våg
                                    </button>
                                </div>
                            </section>

                            {/* Current stats input - CRITICAL: Visible when InBody selected so user can set start point */}
                            {profile.measurementMethod === 'inbody' && (
                                <section aria-labelledby="current-stats-heading" className="mt-4 animate-fade-in">
                                    <h5 id="current-stats-heading" className="text-sm font-semibold text-neutral-dark mb-2">Din startpunkt (Nuvarande status)</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="skeletalMuscleMassKg" className="block text-xs font-medium text-neutral-dark mb-1">Muskelmassa (kg)</label>
                                            <input type="number" name="skeletalMuscleMassKg" id="skeletalMuscleMassKg" value={profile.skeletalMuscleMassKg == null ? '' : profile.skeletalMuscleMassKg} onChange={handleProfileChange} className={compactInputClass + " w-full"} step="0.1" placeholder="Valfritt"/>
                                        </div>
                                        <div>
                                            <label htmlFor="bodyFatMassKg" className="block text-xs font-medium text-neutral-dark mb-1">Fettmassa (kg)</label>
                                            <input type="number" name="bodyFatMassKg" id="bodyFatMassKg" value={profile.bodyFatMassKg == null ? '' : profile.bodyFatMassKg} onChange={handleProfileChange} className={compactInputClass + " w-full"} step="0.1" placeholder="Valfritt"/>
                                        </div>
                                    </div>
                                    <p className="text-xs text-neutral mt-1">Fyll i detta för att sätta en korrekt startpunkt för ditt nya mål.</p>
                                </section>
                            )}

                            {/* Body Comp Goals */}
                            <section aria-labelledby="body-composition-goals-heading" className="mt-4">
                                <h5 id="body-composition-goals-heading" className="text-sm font-semibold text-neutral-dark mb-2">Önskad förändring</h5>
                                {profile.measurementMethod === 'scale' ? (
                                    <div className="animate-fade-in">
                                        <label htmlFor="desiredWeightChangeKg" className="block text-xs font-medium text-neutral-dark mb-1">Viktförändring (kg)</label>
                                        <div className="flex items-center space-x-2">
                                            <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska">-</button>
                                            <input type="number" name="desiredWeightChangeKg" id="desiredWeightChangeKg" value={profile.desiredWeightChangeKg == null ? '' : profile.desiredWeightChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                            <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka">+</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 animate-fade-in">
                                        <div>
                                            <label htmlFor="desiredFatMassChangeKg" className="block text-xs font-medium text-neutral-dark mb-1">Fettmassaförändring (kg)</label>
                                            <div className="flex items-center space-x-2">
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska">-</button>
                                                <input type="number" name="desiredFatMassChangeKg" id="desiredFatMassChangeKg" value={profile.desiredFatMassChangeKg == null ? '' : profile.desiredFatMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka">+</button>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="desiredMuscleMassChangeKg" className="block text-xs font-medium text-neutral-dark mb-1">Muskelmassaförändring (kg)</label>
                                            <div className="flex items-center space-x-2">
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska">-</button>
                                                <input type="number" name="desiredMuscleMassChangeKg" id="desiredMuscleMassChangeKg" value={profile.desiredMuscleMassChangeKg == null ? '' : profile.desiredMuscleMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" min="0" placeholder="0.0"/>
                                                <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka">+</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-4">
                                    <label htmlFor="goalCompletionDate" className="block text-xs font-medium text-neutral-dark mb-1">Eget måldatum (valfritt)</label>
                                    <input type="date" name="goalCompletionDate" id="goalCompletionDate" value={profile.goalCompletionDate || ''} onChange={handleProfileChange} className={inputClass.replace('disabled:bg-gray-100', 'bg-white')} min={new Date().toISOString().split('T')[0]}/>
                                </div>
                            </section>

                            {/* Timeline Preview */}
                             {timeline.paceFeedback && (
                                <div className={`mt-3 p-3 rounded-md text-sm font-medium animate-fade-in ${
                                    timeline.paceFeedback.type === 'error' ? 'bg-red-100 text-red-800' :
                                    timeline.paceFeedback.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                    {timeline.paceFeedback.text}
                                </div>
                            )}
                            {timeline.milestones.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-base font-semibold text-neutral-dark mb-2">Beräknad tidsplan:</h4>
                                    <GoalTimeline milestones={timeline.milestones} paceFeedback={null} weightLogs={[]} goalType={profile.goalType} currentAppDate={new Date()} userProfile={profile} />
                                </div>
                            )}
                        </div>
                    )}

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
                    {/* Display current active goals (either manual or auto) */}
                    <div className="p-4 bg-primary-100/50 rounded-lg">
                         <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-medium text-neutral">Dina Dagliga Mål</p>
                            <button onClick={() => setShowBmrTdeeInfoModal(true)} className="text-primary hover:underline text-xs flex items-center gap-1">
                                <InformationCircleIcon className="w-4 h-4" /> Info BMR/TDEE
                            </button>
                         </div>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm text-neutral-dark">
                            <div><strong>{Math.round(initialGoals.calorieGoal)}</strong> kcal</div>
                            <div className="flex items-center">
                                <strong>{Math.round(initialGoals.proteinGoal)} g</strong>&nbsp;Protein
                                <button 
                                    type="button" 
                                    onClick={() => setShowProteinInfoModal(true)}
                                    className="ml-1 text-neutral-400 hover:text-primary transition-colors"
                                    aria-label="Information om proteinmål"
                                >
                                    <InformationCircleIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <div><strong>{Math.round(initialGoals.carbohydrateGoal)} g</strong> Kolh.</div>
                            <div><strong>{Math.round(initialGoals.fatGoal)} g</strong> Fett</div>
                         </div>
                    </div>
                    
                    {showSavedMessage && (
                        <div className="p-3 bg-green-100 text-green-700 rounded-md text-center text-sm font-medium flex items-center justify-center animate-fade-in">
                            <CheckCircleIcon className="w-5 h-5 mr-2" /> Profil & mål sparade!
                        </div>
                    )}
                </div>
            )}

            {showBmrTdeeInfoModal && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowBmrTdeeInfoModal(false)}>
                    <BmrTdeeInfoModal onClose={() => setShowBmrTdeeInfoModal(false)} />
                </div>
            )}

            {showProteinInfoModal && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowProteinInfoModal(false)}>
                    <div onClick={e => e.stopPropagation()}>
                        <ProteinInfoModal onClose={() => setShowProteinInfoModal(false)} />
                    </div>
                </div>
            )}
        </section>
    );
};

export default ProfileAndGoalEditor;
