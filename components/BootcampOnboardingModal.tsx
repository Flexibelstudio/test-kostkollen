import React, { useState } from 'react';
import { UserProfileData, GoalSettings, ActivityLevel } from '../types';
import { calculateRecommendations } from '../utils/nutritionalCalculations';
import { XMarkIcon, ScaleIcon } from './icons';

interface BootcampOnboardingModalProps {
  show: boolean;
  onClose: () => void;
  initialProfile: UserProfileData;
  initialGoals: GoalSettings;
  onJoin: (updatedProfile: UserProfileData, updatedGoals: GoalSettings) => Promise<void>;
  isJoining: boolean;
}

const BootcampOnboardingModal: React.FC<BootcampOnboardingModalProps> = ({
  show,
  onClose,
  initialProfile,
  initialGoals,
  onJoin,
  isJoining
}) => {
  const [measurementMethod, setMeasurementMethod] = useState<'scale' | 'inbody'>(initialProfile.measurementMethod || 'scale');
  const [currentWeightKg, setCurrentWeightKg] = useState<string>(initialProfile.currentWeightKg?.toString() || '');
  const [goalWeightKg, setGoalWeightKg] = useState<string>(initialProfile.goalWeightKg?.toString() || '');
  const [bodyFatPercentage, setBodyFatPercentage] = useState<string>(initialProfile.bodyFatPercentage?.toString() || '');
  const [muscleMassKg, setMuscleMassKg] = useState<string>(initialProfile.muscleMassKg?.toString() || '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(initialProfile.activityLevel || 'sedentary');

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const weight = parseFloat(currentWeightKg);
    const goalWeight = parseFloat(goalWeightKg);
    const bodyFat = parseFloat(bodyFatPercentage);
    const muscleMass = parseFloat(muscleMassKg);

    const updatedProfile: UserProfileData = {
      ...initialProfile,
      measurementMethod,
      currentWeightKg: weight,
      goalWeightKg: goalWeight,
      activityLevel,
      goalType: 'lose_weight', // Force lose weight for bootcamp
    };

    if (measurementMethod === 'inbody') {
      updatedProfile.bodyFatPercentage = bodyFat;
      updatedProfile.muscleMassKg = muscleMass;
    } else {
      updatedProfile.bodyFatPercentage = undefined;
      updatedProfile.muscleMassKg = undefined;
    }

    // Calculate new recommendations
    const recommendations = calculateRecommendations(updatedProfile);

    const updatedGoals: GoalSettings = {
      ...initialGoals,
      dailyCalories: Math.round(recommendations.recommendedCalories),
      dailyProtein: Math.round(recommendations.recommendedProteinGrams),
      dailyCarbs: Math.round(recommendations.recommendedCarbsGrams),
      dailyFat: Math.round(recommendations.recommendedFatGrams),
    };

    await onJoin(updatedProfile, updatedGoals);
  };

  const activityLevelOptions: { value: ActivityLevel; label: string; description: string }[] = [
    { value: 'sedentary', label: 'Stillasittande', description: 'Skrivbordsjobb, lite eller ingen träning.' },
    { value: 'lightly_active', label: 'Lätt aktiv', description: 'Lätt träning/sport 1-3 dagar/vecka.' },
    { value: 'moderately_active', label: 'Måttligt aktiv', description: 'Måttlig träning/sport 3-5 dagar/vecka.' },
    { value: 'very_active', label: 'Mycket aktiv', description: 'Hård träning/sport 6-7 dagar/vecka.' },
    { value: 'extra_active', label: 'Extra aktiv', description: 'Mycket hård träning, fysiskt arbete.' }
  ];

  const inputClass = "mt-1 block w-full rounded-xl border-neutral-light shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 bg-white text-neutral-dark";

  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-neutral-light flex justify-between items-center bg-neutral-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary">
              <ScaleIcon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-neutral-dark">Starta Bootcamp</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl mb-6">
            <p className="text-sm text-orange-800 font-medium">
              <strong>Viktigt:</strong> När du startar bootcampen sätts ditt mål automatiskt till "Gå ner i vikt". 
              Dina kalorier och makros kommer att räknas om baserat på dina nya värden och skriva över dina nuvarande mål.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-neutral-dark mb-2">Mätmetod</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="measurementMethod"
                    value="scale"
                    checked={measurementMethod === 'scale'}
                    onChange={() => setMeasurementMethod('scale')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Vanlig våg</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="measurementMethod"
                    value="inbody"
                    checked={measurementMethod === 'inbody'}
                    onChange={() => setMeasurementMethod('inbody')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>InBody-mätning</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-dark">Nuvarande vikt (kg) *</label>
                <input
                  type="number"
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(e.target.value)}
                  className={inputClass}
                  min="1"
                  step="0.1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-dark">Målvikt (kg) *</label>
                <input
                  type="number"
                  value={goalWeightKg}
                  onChange={(e) => setGoalWeightKg(e.target.value)}
                  className={inputClass}
                  min="1"
                  step="0.1"
                  required
                />
              </div>
            </div>

            {measurementMethod === 'inbody' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-dark">Fettprocent (%) *</label>
                  <input
                    type="number"
                    value={bodyFatPercentage}
                    onChange={(e) => setBodyFatPercentage(e.target.value)}
                    className={inputClass}
                    min="1"
                    step="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-dark">Muskelmassa (kg) *</label>
                  <input
                    type="number"
                    value={muscleMassKg}
                    onChange={(e) => setMuscleMassKg(e.target.value)}
                    className={inputClass}
                    min="1"
                    step="0.1"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-neutral-dark mb-2">Aktivitetsnivå</label>
              <div className="space-y-2">
                {activityLevelOptions.map(opt => (
                  <label key={opt.value} className={`flex items-start p-3 rounded-xl border cursor-pointer transition-colors ${activityLevel === opt.value ? 'border-primary bg-primary-50' : 'border-neutral-light hover:bg-neutral-50'}`}>
                    <input
                      type="radio"
                      name="activityLevel"
                      value={opt.value}
                      checked={activityLevel === opt.value}
                      onChange={() => setActivityLevel(opt.value)}
                      className="mt-1 text-primary focus:ring-primary"
                    />
                    <div className="ml-3">
                      <span className="block font-medium text-neutral-dark">{opt.label}</span>
                      <span className="block text-xs text-neutral-500">{opt.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-light">
              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-darker transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isJoining ? 'Startar...' : 'Spara & Starta Bootcamp'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BootcampOnboardingModal;
