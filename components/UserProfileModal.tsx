import { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfileData, Gender, ActivityLevel, GoalType, CalculatedNutritionalRecommendations, GoalSettings, AIStructuredFeedbackResponse, NotificationSettings, DayOfWeek, CoachStyle } from '../types.ts';
import { DEFAULT_USER_PROFILE, DEFAULT_GOALS, CALORIES_PER_GRAM, COACH_PERSONAS } from '../constants.ts';
import { calculateRecommendations, deriveEffectiveGoalType } from '../utils/nutritionalCalculations.ts';
import { UserCircleIcon, XMarkIcon, CheckIcon, FireIcon, ProteinIcon, LeafIcon, CheckCircleIcon, InformationCircleIcon, AICoachIcon, BellIcon, UserGroupIcon, PencilIcon } from './icons.tsx';
import { UserRound, UserRoundCog, User as UserIconLucide, Volume2, Smartphone } from 'lucide-react';


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
  onSave: (profile: UserProfileData, goals: GoalSettings, newPhotoDataUrl?: string | null) => void;
  onClose: () => void;
  isOnboarding: boolean;
  onboardingStep?: 'form' | 'feedback';
  aiFeedbackLoading?: boolean;
  aiFeedbackMessage?: AIStructuredFeedbackResponse | string | null;
  aiFeedbackError?: string | null;
  onSubscribeToPush: () => Promise<boolean>;
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

const ToggleSwitch: React.FC<{
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}> = ({ id, label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3.5 bg-neutral-light/40 rounded-xl hover:bg-neutral-light/60 transition-colors">
        <div className="pr-4">
            <label htmlFor={id} className="block text-base font-semibold text-neutral-dark cursor-pointer">{label}</label>
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

const renderMarkdown = (text: string) => {
  // 1. Bold: **text**
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 2. Lists & Newlines
  const lines = html.split('\n');
  let inList = false;
  let result = '';
  
  lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('* ')) {
          if (!inList) {
              result += '<ul class="list-disc ml-5 space-y-1">';
              inList = true;
          }
          result += `<li>${trimmed.substring(2)}</li>`;
      } else {
          if (inList) {
              result += '</ul>';
              inList = false;
          }
          if (result && !result.endsWith('</ul>')) {
             result += '<br />';
          }
          result += line;
      }
  });
  
  if (inList) result += '</ul>';
  
  return result;
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
  onSubscribeToPush,
}) => {

    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
    const [isSubscribing, setIsSubscribing] = useState(false);
    
    // Get Persona Details based on profile
    const coachStyle = initialProfile.coachStyle || 'balanced';
    const persona = COACH_PERSONAS[coachStyle];
    
    // Theme colors based on coach style
    let coachTheme = { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', iconBg: 'bg-blue-100', iconText: 'text-blue-600' };
    if (coachStyle === 'soft') {
        coachTheme = { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', iconBg: 'bg-green-100', iconText: 'text-green-600' };
    } else if (coachStyle === 'hard') {
        coachTheme = { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', iconBg: 'bg-red-100', iconText: 'text-red-600' };
    }

    useEffect(() => {
        // This effect runs when the modal opens to get the current, actual permission state.
        if (typeof Notification !== 'undefined') {
            setPermissionStatus(Notification.permission);
        }
    }, []);

    const handleActivatePush = async () => {
        setIsSubscribing(true);
        const success = await onSubscribeToPush();
        if (success) {
            setPermissionStatus('granted');
        } else {
            // Re-check the permission in case it was denied
            setPermissionStatus(Notification.permission);
        }
        setIsSubscribing(false);
    };

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
        notificationSettings: initialProfile?.notificationSettings || DEFAULT_USER_PROFILE.notificationSettings,
        coachStyle: initialProfile?.coachStyle || DEFAULT_USER_PROFILE.coachStyle,
      } as UserProfileData;
    }
    // For editing, use the complete existing profile but ensure defaults for new fields
    return {
        ...DEFAULT_USER_PROFILE,
        ...(initialProfile || {}),
        coachStyle: initialProfile?.coachStyle || DEFAULT_USER_PROFILE.coachStyle
    } as UserProfileData;
  }, [isOnboarding, initialProfile]);

  const [profile, setProfile] = useState<UserProfileData>(getInitialProfileForState());
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState<string | null>(null);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => {
    try {
        return localStorage.getItem('isSoundMuted') === 'true';
    } catch (e) {
        console.warn("Could not read sound setting from localStorage.", e);
        return false;
    }
  });

  // Manual goals override state
  const [isManualGoalMode, setIsManualGoalMode] = useState(false);
  const [manualGoals, setManualGoals] = useState<GoalSettings>(DEFAULT_GOALS);


  useEffect(() => {
    // Only reset the profile state if we are NOT in the 'feedback' step.
    // This prevents the form from clearing visually when saving (which updates initialProfile)
    // while the component waits for AI feedback or transitions.
    if (onboardingStep !== 'feedback') {
        setProfile(getInitialProfileForState());
        setNewPhotoDataUrl(null);
        setIsManualGoalMode(false); // Reset to auto mode on open
    }
  }, [initialProfile, isOnboarding, getInitialProfileForState, onboardingStep]);


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
  
  // Sync manual goals with recommendations when recommendations change AND NOT in manual mode
  useEffect(() => {
      if (!isManualGoalMode && recommendations) {
          setManualGoals({
              calorieGoal: Math.round(recommendations.recommendedCalories),
              proteinGoal: Math.round(recommendations.recommendedProteinGrams),
              carbohydrateGoal: Math.round(recommendations.recommendedCarbsGrams),
              fatGoal: Math.round(recommendations.recommendedFatGrams),
          });
      }
  }, [recommendations, isManualGoalMode]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string; type: string } }) => {
    const { name, value } = e.target;
    // Fix: Rename 'type' to 'inputType' to avoid ReferenceError and collision with TS 'type' keyword in closures
    const inputType = e.target.type;
    
    setProfile(prev => {
        if (inputType === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            return { ...prev, [name]: checked };
        }
        
        const updatedValue = (name === 'currentWeightKg' ||
                name === 'heightCm' ||
                name === 'ageYears' ||
                name === 'skeletalMuscleMassKg' ||
                name === 'bodyFatMassKg' ||
                name === 'desiredFatMassChangeKg' ||
                name === 'desiredMuscleMassChangeKg' ||
                name === 'desiredWeightChangeKg')
               ? (value === '' ? undefined : parseFloat(value))
               : value;

        let updatedProfile = {
          ...prev,
          [name]: updatedValue,
        };

        // Enforce one goal at a time for 'inbody'
        if (name === 'desiredFatMassChangeKg' && value !== '' && parseFloat(value) !== 0) {
            updatedProfile.desiredMuscleMassChangeKg = undefined;
        } else if (name === 'desiredMuscleMassChangeKg' && value !== '' && parseFloat(value) !== 0) {
            updatedProfile.desiredFatMassChangeKg = undefined;
        }

        return updatedProfile;
    });
  };

  const handleManualGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const numValue = parseInt(value, 10) || 0;
      setManualGoals(prev => ({
          ...prev,
          [name]: numValue
      }));
  };

  const handleNotificationSettingChange = (setting: keyof NotificationSettings) => {
    setProfile(prev => ({
        ...prev,
        notificationSettings: {
            ...(prev.notificationSettings || DEFAULT_USER_PROFILE.notificationSettings),
            [setting]: !(prev.notificationSettings?.[setting] ?? true)
        }
    }));
  };

  const handleToggleSound = () => {
    const newMutedState = !isSoundMuted;
    setIsSoundMuted(newMutedState);
    try {
        if (newMutedState) {
            localStorage.setItem('isSoundMuted', 'true');
        } else {
            localStorage.removeItem('isSoundMuted'); // Clean up
        }
    } catch (e) {
        console.warn("Could not write sound setting to localStorage.", e);
    }
  };


  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
          try {
              const resizedDataUrl = await resizeImage(file, 512); // Resize to max 512px
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


  const handleSaveProfileAndGoals = (e: React.FormEvent) => {
    e.preventDefault();
    let newGoals: GoalSettings;

    if (isManualGoalMode) {
        newGoals = manualGoals;
    } else if (recommendations) {
      newGoals = {
        calorieGoal: recommendations.recommendedCalories,
        proteinGoal: recommendations.recommendedProteinGrams,
        carbohydrateGoal: recommendations.recommendedCarbsGrams,
        fatGoal: recommendations.recommendedFatGrams,
      };
    } else {
      newGoals = DEFAULT_GOALS; 
    }
    
    const validatedProfile = {
        ...profile,
        currentWeightKg: Number(profile.currentWeightKg) || null,
        heightCm: Number(profile.heightCm) || null,
        ageYears: Number(profile.ageYears) || null,
        skeletalMuscleMassKg: Number(profile.skeletalMuscleMassKg) || null,
        bodyFatMassKg: Number(profile.bodyFatMassKg) || null,
        desiredWeightChangeKg: Number(profile.desiredWeightChangeKg) || null,
        desiredFatMassChangeKg: Number(profile.desiredFatMassChangeKg) || null,
        desiredMuscleMassChangeKg: Number(profile.desiredMuscleMassChangeKg) || null,
    };

    onSave(validatedProfile, newGoals, newPhotoDataUrl);
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
    ? (
        !!profile.name?.trim() &&
        !!profile.gender &&
        !!profile.coachStyle &&
        (profile.currentWeightKg || 0) > 0 && 
        (profile.heightCm || 0) > 0 && 
        (profile.ageYears || 0) > 0
      )
    : (
        (profile.heightCm || 0) > 0 && 
        (profile.ageYears || 0) > 0
      );


  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-primary shadow-sm mr-4">
            <UserCircleIcon className="w-7 h-7" />
          </div>
          <h2 id="user-profile-modal-title" className="text-2xl sm:text-3xl font-bold text-neutral-dark">
            {isOnboarding && onboardingStep === 'form' ? 'Din resa börjar här' :
             isOnboarding && onboardingStep === 'feedback' ? `Coach: ${persona.label}, ${persona.roleTitle}` :
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
          {aiFeedbackLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-neutral-dark h-full space-y-4">
              <div className="w-16 h-16 bg-neutral-light rounded-2xl flex items-center justify-center animate-pulse">
                  <span className="text-3xl">{persona.emoji}</span>
              </div>
              <p className="text-lg font-medium">{persona.label} analyserar din plan...</p>
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}
          
          {aiFeedbackError && !aiFeedbackLoading && (
             <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
              <p className="font-medium">Ett fel uppstod:</p>
              <p>{aiFeedbackError}</p>
            </div>
          )}
          
          {aiFeedbackMessage && !aiFeedbackLoading && (
             <div className="flex flex-col gap-4">
                <div className="flex items-end gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${coachTheme.iconBg} ${coachTheme.iconText}`}>
                        <span className="text-3xl">{persona.emoji}</span>
                    </div>
                    <div className={`p-5 rounded-2xl rounded-bl-none border shadow-sm ${coachTheme.bg} ${coachTheme.border} ${coachTheme.text}`}>
                        <h4 className="font-bold text-lg mb-2">Meddelande från {persona.label}, {persona.roleTitle}</h4>
                        {typeof aiFeedbackMessage === 'string' && aiFeedbackMessage.split('\n\n').map((paragraph, index) => (
                            <div key={index} className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(paragraph) }} />
                        ))}
                    </div>
                </div>
            </div>
          )}
          
          <div className="mt-8 text-center">
            <button
              onClick={onClose}
              disabled={aiFeedbackLoading}
              className="w-full sm:w-auto px-10 py-4 bg-primary text-white text-xl font-bold rounded-2xl shadow-lg hover:bg-primary-darker focus:outline-none focus:ring-4 focus:ring-primary/30 active:scale-95 transform interactive-transition disabled:opacity-60"
            >
              Kör igång!
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
                        <label htmlFor="name" className="block text-base font-medium text-neutral-dark">Ditt namn *</label>
                        <input type="text" name="name" id="name" value={profile.name || ''} onChange={handleProfileChange} className={inputClass} placeholder="T.ex. ditt förnamn" required />
                    </div>
                    {isOnboarding && (
                        <div>
                            <label htmlFor="currentWeightKg" className="block text-base font-medium text-neutral-dark">Nuvarande vikt (kg) *</label>
                            <input type="number" name="currentWeightKg" id="currentWeightKg" value={profile.currentWeightKg == null ? '' : profile.currentWeightKg} onChange={handleProfileChange} className={inputClass} min="1" step="0.1" placeholder="T.ex. 70" required />
                        </div>
                    )}
                    <div>
                        <label htmlFor="heightCm" className="block text-base font-medium text-neutral-dark">Längd (cm) *</label>
                        <input type="number" name="heightCm" id="heightCm" value={profile.heightCm == null ? '' : profile.heightCm} onChange={handleProfileChange} className={inputClass} min="1" placeholder="T.ex. 170" required />
                    </div>
                    <div>
                        <label htmlFor="ageYears" className="block text-base font-medium text-neutral-dark">Ålder (år) *</label>
                        <input type="number" name="ageYears" id="ageYears" value={profile.ageYears == null ? '' : profile.ageYears} onChange={handleProfileChange} className={inputClass} min="1" placeholder="T.ex. 30" required />
                    </div>
                    <div>
                        <label htmlFor="gender" className="block text-base font-medium text-neutral-dark">Kön *</label>
                        <select name="gender" id="gender" value={profile.gender} onChange={handleProfileChange} className={selectClass} required>
                            <option value="female">Kvinna</option>
                            <option value="male">Man</option>
                        </select>
                    </div>
                </div>
            </section>
            
            <section aria-labelledby="coach-style-heading" className="mt-5 pt-5 border-t border-neutral-light/50">
                <h4 id="coach-style-heading" className="text-2xl font-semibold text-neutral-dark mb-3">Välj vem du vill bli coachad av *</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(Object.keys(COACH_PERSONAS) as CoachStyle[]).map(style => {
                        const p = COACH_PERSONAS[style];
                        
                        let colorClasses;
                        let iconBgClass;
                        if (style === 'soft') {
                            colorClasses = 'bg-green-50 text-green-700 border-green-200';
                            iconBgClass = 'bg-green-100 text-green-600';
                        } else if (style === 'balanced') {
                            colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
                            iconBgClass = 'bg-blue-100 text-blue-600';
                        } else {
                            colorClasses = 'bg-red-50 text-red-700 border-red-200';
                            iconBgClass = 'bg-red-100 text-red-600';
                        }

                        const isSelected = profile.coachStyle === style;

                        return (
                            <button
                                type="button"
                                key={style}
                                onClick={() => setProfile(prev => ({ ...prev, coachStyle: style }))}
                                className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center text-center ${
                                    isSelected
                                        ? `${colorClasses} shadow-md`
                                        : 'bg-neutral-light/60 border-neutral-light hover:border-gray-300 text-neutral-dark'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 shadow-sm transition-transform ${isSelected ? 'scale-110 ' + iconBgClass : 'bg-white text-neutral-600'}`}>
                                    {p.emoji}
                                </div>
                                <span className="font-bold text-sm">{p.label}, {p.roleTitle}</span>
                                <span className="text-xs opacity-80 mt-1">{p.description}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {isOnboarding && (
                <>
                    <section aria-labelledby="activity-level-heading" className="mt-5 pt-5 border-t border-neutral-light/50">
                        <h4 id="activity-level-heading" className="text-2xl font-semibold text-neutral-dark mb-3">Aktivitetsnivå</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {activityLevelOptions.map(opt => (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onClick={() => handleProfileChange({ target: { name: 'activityLevel', value: opt.value, type: 'select' } } as any)}
                                    className={`w-full text-left p-3 rounded-2xl border-2 transition-all duration-200 ${
                                        profile.activityLevel === opt.value
                                            ? 'bg-primary-50 border-primary shadow-md'
                                            : 'bg-neutral-light/60 border-neutral-light hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm mr-4 flex-shrink-0">
                                            {opt.emoji}
                                        </div>
                                        <div>
                                            <p className={`font-bold ${profile.activityLevel === opt.value ? 'text-primary-darker' : 'text-neutral-dark'}`}>{opt.label}</p>
                                            <p className="text-sm text-neutral-600 leading-snug mt-0.5">{opt.description}</p>
                                            <p className="text-xs text-neutral-500 mt-1 italic">{opt.example}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                    
                    <section aria-labelledby="measurement-method-heading" className="mt-5 pt-5 border-t border-neutral-light/50">
                        <h4 id="measurement-method-heading" className="text-2xl font-semibold text-neutral-dark mb-2">Hur mäter du dig?</h4>
                        <p className="text-sm text-neutral mb-4">
                            Välj InBody om du har tillgång till en våg som mäter muskel- och fettmassa. Välj Vanlig våg om du använder en vanlig personvåg.
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
                                Vanlig våg
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
                                    <p className="text-xs text-neutral mt-1">Sätt ett mål för antingen fett eller muskler.</p>
                                </div>
                                <div>
                                    <label htmlFor="desiredMuscleMassChangeKg" className="block text-base font-medium text-neutral-dark mb-1.5">Önskad muskelmassaförändring (kg)</label>
                                    <div className="flex items-center space-x-2">
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'decrease')} className={stepperButtonClass} aria-label="Minska önskad muskelmassaförändring">-</button>
                                        <input type="number" name="desiredMuscleMassChangeKg" id="desiredMuscleMassChangeKg" value={profile.desiredMuscleMassChangeKg == null ? '' : profile.desiredMuscleMassChangeKg} onChange={handleProfileChange} className={compactInputClass} step="0.1" placeholder="0.0"/>
                                        <button type="button" onClick={() => handleAdjustBodyCompGoal('desiredMuscleMassChangeKg', 'increase')} className={stepperButtonClass} aria-label="Öka önskad muskelmassaförändring">+</button>
                                    </div>
                                    <p className="text-xs text-neutral mt-1">Sätt ett mål för antingen fett eller muskler.</p>
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
                        <h3 id="recommendations-heading" className="text-2xl font-semibold text-neutral-dark mb-3">Dina dagliga mål</h3>
                        
                        {/* Toggle for Manual Goals */}
                        <div className="mb-4">
                            <ToggleSwitch
                                id="manualGoalOverride"
                                label="Ange egna mål manuellt"
                                description="Om du vill åsidosätta de automatiskt beräknade målen."
                                checked={isManualGoalMode}
                                onChange={() => setIsManualGoalMode(!isManualGoalMode)}
                            />
                        </div>

                        {recommendations ? (
                            <div className={`p-4 rounded-lg space-y-4 border ${isManualGoalMode ? 'bg-white border-neutral-light' : 'bg-primary-100/60 border-primary-200/80'}`}>
                                <p className="text-neutral-dark">
                                    {isManualGoalMode 
                                        ? "Du har valt att ställa in dina mål manuellt. Justera värdena nedan."
                                        : "Baserat på dina ifyllda uppgifter, är detta dina uppskattade rekommendationer:"
                                    }
                                </p>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Calories */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-dark flex items-center mb-1">
                                            <span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span> Kalorier
                                        </label>
                                        <input 
                                            type="number" 
                                            name="calorieGoal"
                                            value={isManualGoalMode ? manualGoals.calorieGoal : Math.round(recommendations.recommendedCalories)}
                                            onChange={handleManualGoalChange}
                                            disabled={!isManualGoalMode}
                                            className={isManualGoalMode ? inputClass : "block w-full px-3 py-2 bg-transparent border-0 font-bold text-lg text-neutral-dark focus:ring-0 p-0"}
                                        />
                                        {!isManualGoalMode && <span className="text-xs text-neutral">kcal</span>}
                                    </div>

                                    {/* Protein */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-dark flex items-center mb-1">
                                            <span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Protein">💪</span> Protein (g)
                                        </label>
                                        <input 
                                            type="number" 
                                            name="proteinGoal"
                                            value={isManualGoalMode ? manualGoals.proteinGoal : Math.round(recommendations.recommendedProteinGrams)}
                                            onChange={handleManualGoalChange}
                                            disabled={!isManualGoalMode}
                                            className={isManualGoalMode ? inputClass : "block w-full px-3 py-2 bg-transparent border-0 font-bold text-lg text-neutral-dark focus:ring-0 p-0"}
                                        />
                                    </div>

                                    {/* Carbs */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-dark flex items-center mb-1">
                                            <span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span> Kolhydrater (g)
                                        </label>
                                        <input 
                                            type="number" 
                                            name="carbohydrateGoal"
                                            value={isManualGoalMode ? manualGoals.carbohydrateGoal : Math.round(recommendations.recommendedCarbsGrams)}
                                            onChange={handleManualGoalChange}
                                            disabled={!isManualGoalMode}
                                            className={isManualGoalMode ? inputClass : "block w-full px-3 py-2 bg-transparent border-0 font-bold text-lg text-neutral-dark focus:ring-0 p-0"}
                                        />
                                    </div>

                                    {/* Fat */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-dark flex items-center mb-1">
                                            <span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Fett">🥑</span> Fett (g)
                                        </label>
                                        <input 
                                            type="number" 
                                            name="fatGoal"
                                            value={isManualGoalMode ? manualGoals.fatGoal : Math.round(recommendations.recommendedFatGrams)}
                                            onChange={handleManualGoalChange}
                                            disabled={!isManualGoalMode}
                                            className={isManualGoalMode ? inputClass : "block w-full px-3 py-2 bg-transparent border-0 font-bold text-lg text-neutral-dark focus:ring-0 p-0"}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-neutral">Fyll i dina personliga detaljer ovan för att se rekommendationer.</p>
                        )}
                    </section>
                </>
            )}

            {!isOnboarding && (
                 <div className="space-y-4 mt-6">
                    <h3 className="text-xl font-bold text-neutral-dark px-1">Inställningar</h3>

                    {/* Community Card */}
                    <div className="bg-white p-5 rounded-2xl shadow-soft-lg border border-neutral-light">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                                <UserGroupIcon className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-neutral-dark">Community</h4>
                        </div>
                        <ToggleSwitch
                            id="isSearchable"
                            label="Sökbar som kompis"
                            description="Tillåt andra att hitta dig för att bli Peppkompisar."
                            checked={profile.isSearchable ?? false}
                            onChange={() => setProfile(prev => ({...prev, isSearchable: !prev.isSearchable}))}
                         />
                    </div>

                    {/* Sound Card */}
                    <div className="bg-white p-5 rounded-2xl shadow-soft-lg border border-neutral-light">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                                <Volume2 className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-neutral-dark">Ljud & Feedback</h4>
                        </div>
                         <ToggleSwitch
                            id="appSound"
                            label="App-ljud"
                            description="Ljudeffekter för klick, notiser och milstolpar."
                            checked={!isSoundMuted}
                            onChange={handleToggleSound}
                         />
                    </div>
                    
                    {/* Notifications Card */}
                    <div className="bg-white p-5 rounded-2xl shadow-soft-lg border border-neutral-light">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-sm">
                                <BellIcon className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-neutral-dark">Notiser</h4>
                        </div>
                        
                         <div className="space-y-4">
                            <div>
                                <h5 className="text-sm font-bold text-neutral-500 uppercase tracking-wide mb-2 px-1 border-t border-neutral-light/50 pt-4">Påminnelser</h5>
                                <div className="space-y-3">
                                    <ToggleSwitch 
                                        id="waterReminder"
                                        label="Vattenpåminnelse"
                                        description="Vid lunch om inget vatten loggats"
                                        checked={profile.notificationSettings?.waterReminder ?? true}
                                        onChange={() => handleNotificationSettingChange('waterReminder')}
                                    />
                                    <ToggleSwitch 
                                        id="foodReminder"
                                        label="Matloggningspåminnelse"
                                        description="Kl 18:00 om ingen mat loggats"
                                        checked={profile.notificationSettings?.foodReminder ?? true}
                                        onChange={() => handleNotificationSettingChange('foodReminder')}
                                    />
                                    <ToggleSwitch 
                                        id="weighInReminder"
                                        label="Vägningspåminnelse"
                                        checked={profile.notificationSettings?.weighInReminder ?? true}
                                        onChange={() => handleNotificationSettingChange('weighInReminder')}
                                    />
                                    <div className="pl-4 pr-1 py-2">
                                        <label htmlFor="preferredWeighInDay" className="block text-sm font-medium text-neutral-dark mb-1">Föredragen dag för vägning</label>
                                        <select name="preferredWeighInDay" id="preferredWeighInDay" value={profile.preferredWeighInDay || 'måndag'} onChange={handleProfileChange} className={selectClass + ' text-sm py-2'}>
                                            {(['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'] as DayOfWeek[]).map(day => (
                                                <option key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <ToggleSwitch 
                                        id="inactivityReminder"
                                        label="Inaktivitetspåminnelse"
                                        description="Om du inte loggat på 3 dagar"
                                        checked={profile.notificationSettings?.inactivityReminder ?? true}
                                        onChange={() => handleNotificationSettingChange('inactivityReminder')}
                                    />
                                    <ToggleSwitch 
                                        id="milestoneNudge"
                                        label="Milstolpe-pepp"
                                        description="När du närmar dig en ny nivå/streak"
                                        checked={profile.notificationSettings?.milestoneNudge ?? true}
                                        onChange={() => handleNotificationSettingChange('milestoneNudge')}
                                    />
                                </div>
                            </div>

                            <div>
                                <h5 className="text-sm font-bold text-neutral-500 uppercase tracking-wide mb-2 px-1 border-t border-neutral-light/50 pt-4">Socialt</h5>
                                <div className="space-y-3">
                                    <ToggleSwitch 
                                        id="friendRequests"
                                        label="Peppkompis-förfrågningar"
                                        checked={profile.notificationSettings?.friendRequests ?? true}
                                        onChange={() => handleNotificationSettingChange('friendRequests')}
                                    />
                                    <ToggleSwitch 
                                        id="newEvents"
                                        label="Händelser i flödet"
                                        description="Från dina kompisar"
                                        checked={profile.notificationSettings?.newEvents ?? true}
                                        onChange={() => handleNotificationSettingChange('newEvents')}
                                    />
                                    <ToggleSwitch 
                                        id="comments"
                                        label="Kommentarer"
                                        description="På dina inlägg"
                                        checked={profile.notificationSettings?.comments ?? true}
                                        onChange={() => handleNotificationSettingChange('comments')}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                     {/* Push Notification Card */}
                     <div className="bg-white p-5 rounded-2xl shadow-soft-lg border border-neutral-light">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 shadow-sm">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-neutral-dark">Enhet & Pushnotiser</h4>
                        </div>
                        
                         <div className="p-4 bg-neutral-light/40 rounded-xl">
                            {permissionStatus === 'granted' && (
                                <div className="flex items-center text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                                    <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                                    <span className="font-medium">Pushnotiser är aktiva på denna enhet.</span>
                                </div>
                            )}
                            {permissionStatus === 'denied' && (
                                <div className="flex items-start text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
                                    <XMarkIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                                    <span className="font-medium">Du har blockerat notiser. För att aktivera dem, gå till din webbläsares inställningar för denna sida.</span>
                                </div>
                            )}
                            {permissionStatus === 'default' && (
                                <button
                                    type="button"
                                    onClick={handleActivatePush}
                                    disabled={isSubscribing}
                                    className="w-full px-5 py-3 text-base font-bold text-white bg-primary hover:bg-primary-darker rounded-xl shadow-md active:scale-95 transform interactive-transition flex items-center justify-center disabled:opacity-60"
                                >
                                    {isSubscribing ? (
                                        <><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Bearbetar...</>
                                    ) : (
                                        <><BellIcon className="w-5 h-5 mr-2" /> Aktivera Pushnotiser</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                 </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-neutral-light/70 flex flex-col sm:flex-row justify-end items-center gap-4">
                <button
                    type="submit"
                    disabled={!canSave || aiFeedbackLoading}
                    className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-md text-lg font-semibold text-white bg-primary hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 transform interactive-transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[180px]"
                >
                    {aiFeedbackLoading ? (
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                            <span>{isOnboarding ? 'Analyserar...' : 'Sparar...'}</span>
                        </div>
                    ) : (
                        <>
                            <CheckIcon className="w-5 h-5 inline mr-2" />
                            <span>{isOnboarding ? 'Fortsätt till sista steget' : 'Spara profil'}</span>
                        </>
                    )}
                </button>
            </div>
        </form>
      )}
    </div>
  );
};

export default UserProfileModal;