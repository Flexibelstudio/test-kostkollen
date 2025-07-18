import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfileData, Gender, ActivityLevel, GoalType, CalculatedNutritionalRecommendations, GoalSettings, AIStructuredFeedbackResponse } from '../types.ts';
import { DEFAULT_USER_PROFILE, DEFAULT_GOALS, CALORIES_PER_GRAM } from '../constants.ts';
import { calculateRecommendations, deriveEffectiveGoalType } from '../utils/nutritionalCalculations.ts';
import { UserCircleIcon, XMarkIcon, CheckIcon, FireIcon, ProteinIcon, LeafIcon, CheckCircleIcon, InformationCircleIcon, AICoachIcon } from './icons.tsx';
import { UserRound, UserRoundCog, User as UserIconLucide } from 'lucide-react';


export const Avatar: React.FC<{
  photoURL?: string | null;
  gender?: Gender;
  size?: number;
  className?: string;
}> = ({ photoURL, gender, size = 40, className = '' }) => {
  const iconSize = size * 0.8;
  const commonIconProps = {
    size: iconSize,
    strokeWidth: 1.5,
    className: 'text-neutral',
  };

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt="Profilbild"
        className={`object-cover rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  
  let iconToRender;
  if (gender === 'female') {
      iconToRender = <UserRound {...commonIconProps} />;
  } else if (gender === 'male') {
      iconToRender = <UserRound {...commonIconProps} />;
  } else {
      iconToRender = <UserIconLucide {...commonIconProps} />; // Neutral fallback
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center bg-neutral-light overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {iconToRender}
    </div>
  );
};

interface UserProfileModalProps {
  initialProfile: UserProfileData;
  onSave: (profile: UserProfileData, goals: GoalSettings) => void;
  onClose: () => void;
  isOnboarding: boolean;
  onboardingStep?: 'form' | 'feedback';
  aiFeedbackLoading?: boolean;
  aiFeedbackMessage?: AIStructuredFeedbackResponse | string | null;
  aiFeedbackError?: string | null;
}

const resizeImage = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  initialProfile,
  onSave,
  onClose,
  isOnboarding = false,
  onboardingStep = 'form',
  aiFeedbackLoading = false,
  aiFeedbackMessage = null,
  aiFeedbackError = null,
}) => {

  const getInitialProfileForState = useCallback(() => {
    // For onboarding, clear some fields to ensure a fresh start
    if (isOnboarding) {
      return {
        name: initialProfile?.name || undefined,
        photoURL: initialProfile?.photoURL || undefined,
        currentWeightKg: undefined,
        heightCm: undefined,
        ageYears: undefined,
        gender: initialProfile?.gender || DEFAULT_USER_PROFILE.gender,
        activityLevel: initialProfile?.activityLevel || DEFAULT_USER_PROFILE.activityLevel,
        goalType: deriveEffectiveGoalType({}),
        measurementMethod: 'inbody',
        desiredWeightChangeKg: undefined,
        skeletalMuscleMassKg: undefined,
        bodyFatMassKg: undefined,
        desiredFatMassChangeKg: undefined,
        desiredMuscleMassChangeKg: undefined,
        goalCompletionDate: undefined,
        isCourseActive: false,
        courseInterest: false,
        isSearchable: true, // Default to searchable for new users
      } as UserProfileData;
    }
    // For editing, use the complete existing profile
    return initialProfile || DEFAULT_USER_PROFILE;
  }, [isOnboarding, initialProfile]);

  const [profile, setProfile] = useState<UserProfileData>(getInitialProfileForState());
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setProfile(getInitialProfileForState());
    setNewPhotoDataUrl(null);
  }, [initialProfile, isOnboarding, getInitialProfileForState]);


  // Derive goalType automatically based on desired changes
  useEffect(() => {
    const newGoalType = deriveEffectiveGoalType(profile);
    if (profile.goalType !== newGoalType) {
        setProfile(prev => ({ ...prev, goalType: newGoalType }));
    }
  }, [profile.measurementMethod, profile.desiredWeightChangeKg, profile.desiredFatMassChangeKg, profile.desiredMuscleMassChangeKg, profile.goalType]);

  const recommendations = useMemo(() => {
    // Only calculate recommendations if we have the necessary data
    if (profile.currentWeightKg && profile.currentWeightKg > 0 &&
        profile.heightCm && profile.heightCm > 0 &&
        profile.ageYears && profile.ageYears > 0) {
        return calculateRecommendations(profile);
    }
    return null;
  }, [profile]);
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
     if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setProfile(prev => ({ ...prev, [name]: checked }));
        return;
    }

    setProfile(prev => ({
      ...prev,
      [name]: (name === 'currentWeightKg' ||
                name === 'heightCm' ||
                name === 'ageYears' ||
                name === 'skeletalMuscleMassKg' ||
                name === 'bodyFatMassKg' ||
                name === 'desiredFatMassChangeKg' ||
                name === 'desiredMuscleMassChangeKg' ||
                name === 'desiredWeightChangeKg')
               ? (value === '' ? undefined : parseFloat(value))
               : value,
    }));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
          try {
              const resizedDataUrl = await resizeImage(file, 800); // Resize to max 800px
              setNewPhotoDataUrl(resizedDataUrl);
          } catch (error) {
              console.error("Image resizing failed:", error);
              alert("Kunde inte bearbeta bilden. Försök med en annan bild.");
          }
      }
  };


  const handleAdjustBodyCompGoal = useCallback((field: 'desiredFatMassChangeKg' | 'desiredMuscleMassChangeKg' | 'desiredWeightChangeKg', direction: 'increase' | 'decrease') => {
    const amount = 0.5;
    setProfile(prev => {
      const currentValue = prev[field] === undefined ? 0 : Number(prev[field]);
      let newValue = direction === 'increase' ? currentValue + amount : currentValue - amount;
      newValue = Math.round(newValue * 10) / 10; // Round to one decimal place
      return {
        ...prev,
        [field]: newValue,
      };
    });
  }, []);


  const handleSaveProfileAndGoals = (e: React.FormEvent) => {
    e.preventDefault();
    let newGoals: GoalSettings;

    if (recommendations) {
      newGoals = {
        calorieGoal: recommendations.recommendedCalories,
        proteinGoal: recommendations.recommendedProteinGrams,
        carbohydrateGoal: recommendations.recommendedCarbsGrams,
        fatGoal: recommendations.recommendedFatGrams,
      };
    } else {
      // If editing personal details only, recommendations might be null if weight is missing.
      // We should pass back existing goals. This relies on the parent to handle it.
      // For now, default goals serve as a fallback.
      newGoals = DEFAULT_GOALS; 
    }
    
    const profileWithNewPhoto = {
        ...profile,
        photoURL: newPhotoDataUrl || profile.photoURL,
    };

    const validatedProfile = {
        ...profileWithNewPhoto,
        currentWeightKg: Number(profileWithNewPhoto.currentWeightKg) || undefined,
        heightCm: Number(profileWithNewPhoto.heightCm) || undefined,
        ageYears: Number(profileWithNewPhoto.ageYears) || undefined,
        skeletalMuscleMassKg: Number(profileWithNewPhoto.skeletalMuscleMassKg) || undefined,
        bodyFatMassKg: Number(profileWithNewPhoto.bodyFatMassKg) || undefined,
        desiredWeightChangeKg: Number(profileWithNewPhoto.desiredWeightChangeKg) || undefined,
        desiredFatMassChangeKg: Number(profileWithNewPhoto.desiredFatMassChangeKg) || undefined,
        desiredMuscleMassChangeKg: Number(profileWithNewPhoto.desiredMuscleMassChangeKg) || undefined,
    };

    onSave(validatedProfile, newGoals);
  };

  // UI classes
  const inputClass = "mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
  const selectClass = inputClass;
  const compactInputClass = "w-20 text-center px-2 py-1.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-base";
  const stepperButtonClass = "px-2.5 py-1 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary active:scale-90 text-lg font-semibold interactive-transition";

  const goalTypeDisplayMap: Record<GoalType, string> = {
    lose_fat: 'Minska fettmassa / vikt',
    maintain: 'Behålla nuvarande vikt/sammansättning',
    gain_muscle: 'Öka muskelmassa / vikt',
  };

  // Enable save button only if essential fields are filled
  const canSave = isOnboarding 
    ? (profile.currentWeightKg && profile.heightCm && profile.ageYears && profile.currentWeightKg > 0 && profile.heightCm > 0 && profile.ageYears > 0)
    : (profile.heightCm && profile.ageYears && profile.heightCm > 0 && profile.ageYears > 0);


  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <UserCircleIcon className="w-8 h-8 text-primary mr-3" />
          <h2 id="user-profile-modal-title" className="text-3xl font-bold text-neutral-dark">
            {isOnboarding && onboardingStep === 'form' ? 'Din resa börjar här' :
             isOnboarding && onboardingStep === 'feedback' ? 'Feedback från Flexibot' :
             'Redigera Profil'}
          </h2>
        </div>
        <button
          onClick={onClose}
          disabled={isOnboarding && onboardingStep === 'form'}
          className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90 transform interactive-transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Stäng profilinställningar"
        >
          <XMarkIcon className="w-7 h-7" />
        </button>
      </div>

      {isOnboarding && onboardingStep === 'form' && (
        <p className="text-lg text-neutral-dark mb-6 bg-primary-100/70 p-4 rounded-md border border-primary-200">
          Välkommen, vänligen fyll i formuläret nedan så börjar vi din resa.
        </p>
      )}

      {isOnboarding && onboardingStep === 'feedback' ? (
        <div className="animate-fade-in min-h-[300px]">
          <div className="flex items-center justify-center mb-4">
              <AICoachIcon className="w-8 h-8 text-secondary mr-2.5" />
              <h3 className="text-2xl font-semibold text-neutral-dark text-center">Din Coach</h3>
          </div>
          {aiFeedbackLoading && (
            <div className="flex flex-col items-center justify-center p-8 text-neutral-dark h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
              Flexibot analyserar dina mål...
            </div>
          )}
          {aiFeedbackError && !aiFeedbackLoading && (
             <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
              <p className="font-medium">Fel från Coach:</p>
              <p>{aiFeedbackError}</p>
            </div>
          )}
          {aiFeedbackMessage && !aiFeedbackLoading && (
             <div className="p-4 bg-primary-100/60 border border-primary-200/80 rounded-lg text-neutral-dark space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {typeof aiFeedbackMessage === 'string' && aiFeedbackMessage.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-base leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
          <div className="mt-8 text-center">
            <button
              onClick={onClose}
              disabled={aiFeedbackLoading}
              className="w-full sm:w-auto px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform interactive-transition disabled:opacity-60"
            >
              Kom igång med min resa!
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveProfileAndGoals} className="space-y-6">
            <section aria-labelledby="profile-picture-heading">
                <h3 id="profile-picture-heading" className="text-2xl font-semibold text-neutral-dark mb-3">Profilbild</h3>
                <div className="flex items-center gap-5">
                    <Avatar photoURL={newPhotoDataUrl || profile.photoURL} gender={profile.gender} size={80} />
                    <div>
                        <label htmlFor="photoUpload" className="cursor-pointer px-4 py-2 bg-neutral-light hover:bg-gray-300 text-neutral-dark font-medium rounded-md shadow-sm interactive-transition">
                            Välj ny bild...
                        </label>
                        <input type="file" id="photoUpload" className="hidden" accept="image/png, image/jpeg" onChange={handleImageSelect} />
                        <p className="text-xs text-neutral mt-2">Stora bilder skalas ned automatiskt.</p>
                    </div>
                </div>
            </section>

            <section aria-labelledby="profile-details-heading">
                <h3 id="profile-details-heading" className="text-2xl font-semibold text-neutral-dark mb-3">Personliga detaljer</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                    <div>
                        <label htmlFor="name" className="block text-base font-medium text-neutral-dark">Ditt namn</label>
                        <input type="text" name="name" id="name" value={profile.name || ''} onChange={handleProfileChange} className={inputClass} placeholder="T.ex. ditt förnamn" />
                    </div>
                    {/* Onboarding gets weight here, but not edit mode */}
                    {isOnboarding && (
                        <div>
                            <label htmlFor="currentWeightKg" className="block text-base font-medium text-neutral-dark">Nuvarande vikt (kg)</label>
                            <input type="number" name="currentWeightKg" id="currentWeightKg" value={profile.currentWeightKg == null ? '' : profile.currentWeightKg} onChange={handleProfileChange} className={inputClass} min="1" step="0.1" placeholder="T.ex. 70" required />
                        </div>
                    )}
                    <div>
                        <label htmlFor="heightCm" className="block text-base font-medium text-neutral-dark">Längd (cm)</label>
                        <input type="number" name="heightCm" id="heightCm" value={profile.heightCm == null ? '' : profile.heightCm} onChange={handleProfileChange} className={inputClass} min="1" placeholder="T.ex. 170" required />
                    </div>
                    <div>
                        <label htmlFor="ageYears" className="block text-base font-medium text-neutral-dark">Ålder (år)</label>
                        <input type="number" name="ageYears" id="ageYears" value={profile.ageYears == null ? '' : profile.ageYears} onChange={handleProfileChange} className={inputClass} min="1" placeholder="T.ex. 30" required />
                    </div>
                    <div>
                        <label htmlFor="gender" className="block text-base font-medium text-neutral-dark">Kön</label>
                        <select name="gender" id="gender" value={profile.gender} onChange={handleProfileChange} className={selectClass} required>
                            <option value="female">Kvinna</option>
                            <option value="male">Man</option>
                        </select>
                    </div>
                </div>
            </section>
            
            {/* GOAL-RELATED SECTIONS - ONLY FOR ONBOARDING */}
            {isOnboarding && (
                <>
                    <section aria-labelledby="measurement-method-heading" className="mt-5 pt-5 border-t border-neutral-light/50">
                        <h4 id="measurement-method-heading" className="text-2xl font-semibold text-neutral-dark mb-2">Hur mäter du dig?</h4>
                        <p className="text-sm text-neutral mb-4">
                            Välj InBody om du har tillgång till en våg som mäter muskel- och fettmassa. Välj Annan våg om du använder en vanlig personvåg.
                        </p>
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
                                Annan våg
                            </button>
                        </div>
                    </section>

                    <section aria-labelledby="body-composition-goals-heading" className="mt-5 pt-5 border-t border-neutral-light/50">
                        <h4 id="body-composition-goals-heading" className="text-2xl font-semibold text-neutral-dark mb-2">Önskad förändring i kroppssammansättning</h4>
                        <p className="text-sm text-neutral mb-4">
                            Ange hur du önskar förändra din vikt/massa. Detta hjälper oss att skräddarsy dina rekommendationer.
                        </p>
                        
                        {profile.measurementMethod === 'scale' ? (
                             <div className="animate-fade-in">
                                <label htmlFor="desiredWeightChangeKg" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad viktförändring (kg)</label>
                                <div className="flex items-center space-x-2">
                                    <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska önskad viktförändring">-</button>
                                    <input type="number" name="desiredWeightChangeKg" id="desiredWeightChangeKg" value={profile.desiredWeightChangeKg == null ? '' : profile.desiredWeightChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                    <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredWeightChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka önskad viktförändring">+</button>
                                </div>
                                <p className="text-xs text-neutral mt-1">Negativt för minskning (t.ex. -5), positivt för ökning.</p>
                            </div>
                        ) : (
                            <div className="space-y-5 animate-fade-in">
                                <div>
                                    <label htmlFor="desiredFatMassChangeKg" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad fettmassaförändring (kg)</label>
                                    <div className="flex items-center space-x-2">
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska önskad fettmassaförändring">-</button>
                                        <input type="number" name="desiredFatMassChangeKg" id="desiredFatMassChangeKg" value={profile.desiredFatMassChangeKg == null ? '' : profile.desiredFatMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredFatMassChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka önskad fettmassaförändring">+</button>
                                    </div>
                                    <p className="text-xs text-neutral mt-1">Negativt för minskning (t.ex. -5), positivt för ökning.</p>
                                </div>
                                <div>
                                    <label htmlFor="desiredMuscleMassChangeKg" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad muskelmassaförändring (kg)</label>
                                    <div className="flex items-center space-x-2">
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska önskad muskelmassaförändring">-</button>
                                        <input type="number" name="desiredMuscleMassChangeKg" id="desiredMuscleMassChangeKg" value={profile.desiredMuscleMassChangeKg == null ? '' : profile.desiredMuscleMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka önskad muskelmassaförändring">+</button>
                                    </div>
                                    <p className="text-xs text-neutral mt-1">Positivt för ökning (t.ex. +2).</p>
                                </div>
                            </div>
                        )}

                        <div className="mt-5">
                            <label htmlFor="goalCompletionDate" className="block text-base font-medium text-neutral-dark mb-1.5">Måldatum</label>
                            <input type="date" name="goalCompletionDate" id="goalCompletionDate" value={profile.goalCompletionDate || ''} onChange={handleProfileChange} className={inputClass} min={new Date().toISOString().split('T')[0]} />
                            <p className="text-xs text-neutral mt-1">När vill du ha uppnått detta mål?</p>
                        </div>
                        <div className="mt-3 p-3 bg-primary-100/60 rounded-md border border-primary-200">
                            <p className="text-base font-medium text-neutral-dark">
                                Baserat på dina val blir ditt primära mål: <strong className="text-primary">{goalTypeDisplayMap[profile.goalType]}</strong>
                            </p>
                        </div>
                    </section>
                    
                    <section aria-labelledby="inbody-values-heading" className="mt-5 pt-5 border-t border-neutral-light/50">
                        <h4 id="inbody-values-heading" className="text-2xl font-semibold text-neutral-dark mb-2">Faktisk kroppssammansättning (valfritt)</h4>
                        <p className="text-sm text-neutral-dark mb-3 flex items-center">
                            <InformationCircleIcon className="w-5 h-5 mr-1.5 text-secondary flex-shrink-0" />
                            Om du har gjort en InBody-mätning eller liknande kan du fylla i dina värden här. Detta används inte direkt för rekommendationer men kan vara bra att spara.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                            <div>
                                <label htmlFor="skeletalMuscleMassKg" className="block text-base font-medium text-neutral-dark">Skelettmuskelmassa (kg)</label>
                                <input type="number" name="skeletalMuscleMassKg" id="skeletalMuscleMassKg" value={profile.skeletalMuscleMassKg == null ? '' : profile.skeletalMuscleMassKg} onChange={handleProfileChange} className={inputClass} min="0" step="0.1" placeholder="Valfritt" />
                            </div>
                            <div>
                                <label htmlFor="bodyFatMassKg" className="block text-base font-medium text-neutral-dark">Kroppsfettmassa (kg)</label>
                                <input type="number" name="bodyFatMassKg" id="bodyFatMassKg" value={profile.bodyFatMassKg == null ? '' : profile.bodyFatMassKg} onChange={handleProfileChange} className={inputClass} min="0" step="0.1" placeholder="Valfritt" />
                            </div>
                        </div>
                    </section>
                    
                    <section aria-labelledby="recommendations-heading" className="mt-6 pt-6 border-t border-neutral-light/70">
                        <h3 id="recommendations-heading" className="text-2xl font-semibold text-neutral-dark mb-3">Dina rekommenderade dagliga mål</h3>
                        {recommendations ? (
                            <div className="p-4 bg-primary-100/60 border border-primary-200/80 rounded-lg space-y-2">
                                <p className="text-neutral-dark">Baserat på dina ifyllda uppgifter, är detta dina uppskattade rekommendationer:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
                                    <div className="flex items-center"><span className="w-5 h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span><strong>{Math.round(recommendations.recommendedCalories)} kcal</strong></div>
                                    <div className="flex items-center"><span className="w-5 h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Protein">💪</span><strong>{Math.round(recommendations.recommendedProteinGrams)}g P</strong></div>
                                    <div className="flex items-center"><span className="w-5 h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span><strong>{Math.round(recommendations.recommendedCarbsGrams)}g K</strong></div>
                                    <div className="flex items-center"><span className="w-5 h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Fett">🥑</span><strong>{Math.round(recommendations.recommendedFatGrams)}g F</strong></div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-neutral">Fyll i dina personliga detaljer ovan för att se rekommendationer.</p>
                        )}
                    </section>
                </>
            )}

            {!isOnboarding && (
                 <section aria-labelledby="community-settings-heading" className="mt-5 pt-5 border-t border-neutral-light/50">
                    <h3 id="community-settings-heading" className="text-2xl font-semibold text-neutral-dark mb-3">Community-inställningar</h3>
                    <div className="flex items-center justify-between p-4 bg-neutral-light/60 rounded-lg">
                        <div>
                            <label htmlFor="isSearchable" className="block text-base font-medium text-neutral-dark">Sökbar som kompis</label>
                            <p className="text-sm text-neutral">Tillåt andra att hitta dig för att bli Peppkompisar.</p>
                        </div>
                        <label htmlFor="isSearchable" className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="isSearchable"
                                name="isSearchable"
                                checked={profile.isSearchable ?? false}
                                onChange={handleProfileChange}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-2 peer-focus:ring-primary-lighter peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                 </section>
            )}
            
            <div className="mt-8 pt-6 border-t border-neutral-light/70 flex flex-col sm:flex-row justify-end items-center gap-4">
                <button
                    type="submit"
                    disabled={!canSave || (isOnboarding && aiFeedbackLoading)}
                    className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-md text-lg font-semibold text-white bg-primary hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 transform interactive-transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <CheckIcon className="w-5 h-5 inline mr-2" />
                    {isOnboarding ? 'Få feedback från Flexibot' : 'Spara profil'}
                </button>
            </div>
        </form>
      )}
    </div>
  );
};

export default UserProfileModal;
