
import React, { useState } from 'react';
import { XMarkIcon } from './icons';

export interface MentalWellbeingData {
  stressLevel: number | null; // 1=low stress, 5=high stress
  energyLevel: number | null; // 1=low energy, 5=high energy
  sleepQuality: number | null; // 1=bad sleep, 5=good sleep
  mood: number | null; // 1=bad mood, 5=good mood
}

interface MentalWellbeingModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: MentalWellbeingData) => void;
}

const MentalWellbeingModal: React.FC<MentalWellbeingModalProps> = ({ show, onClose, onSave }) => {
  const [wellbeingData, setWellbeingData] = useState<MentalWellbeingData>({
    stressLevel: null,
    energyLevel: null,
    sleepQuality: null,
    mood: null,
  });

  const handleSelect = (category: keyof MentalWellbeingData, value: number) => {
    setWellbeingData(prev => ({ ...prev, [category]: value === prev[category] ? null : value })); // Allow deselecting
  };

  const handleSave = () => {
    onSave(wellbeingData);
  };
  
  const isSaveDisabled = Object.values(wellbeingData).every(value => value === null);

  if (!show) return null;

  const EMOJI_SETS = {
    stress: ['😌', '😊', '😐', '😟', '😩'], // Low to High stress
    energy: ['😩', '😟', '😐', '😊', '😁'], // Low to High energy
    sleep: ['😴', '😟', '😐', '😊', '😌'],   // Bad to Good sleep
    mood: ['😩', '😟', '😐', '😊', '😁'],    // Bad to Good mood
  };

  const EmojiSelector: React.FC<{
    question: string;
    emojis: string[];
    selectedValue: number | null;
    onSelect: (value: number) => void;
  }> = ({ question, emojis, selectedValue, onSelect }) => (
    <div>
      <label className="block text-lg font-medium text-neutral-dark mb-3">{question}</label>
      <div className="flex justify-between items-center bg-neutral-light/60 p-3 rounded-xl shadow-inner">
        {emojis.map((emoji, index) => {
          const value = index + 1;
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={`text-3xl sm:text-4xl p-2 rounded-full transition-all duration-200 ease-in-out transform focus:outline-none ${
                selectedValue === value ? 'scale-125' : 'scale-100 opacity-60 hover:opacity-100 hover:scale-110'
              }`}
              aria-pressed={selectedValue === value}
              aria-label={`${question}, betyg ${value} av 5`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mental-wellbeing-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg animate-scale-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 id="mental-wellbeing-modal-title" className="text-2xl sm:text-3xl font-bold text-neutral-dark">
            Mitt Mentala Välbefinnande
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
            aria-label="Stäng"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar">
          <p className="text-base text-neutral-dark mb-8">
            Logga hur du mår. Det hjälper dig och AI:n att förstå din helhetshälsa. Informationen används för att ge dig bättre råd.
          </p>

          <div className="space-y-6">
            <EmojiSelector
              question="Upplever du stress?"
              emojis={EMOJI_SETS.stress}
              selectedValue={wellbeingData.stressLevel}
              onSelect={(value) => handleSelect('stressLevel', value)}
            />
            <EmojiSelector
              question="Hur är din energinivå?"
              emojis={EMOJI_SETS.energy}
              selectedValue={wellbeingData.energyLevel}
              onSelect={(value) => handleSelect('energyLevel', value)}
            />
            <EmojiSelector
              question="Hur har du sovit?"
              emojis={EMOJI_SETS.sleep}
              selectedValue={wellbeingData.sleepQuality}
              onSelect={(value) => handleSelect('sleepQuality', value)}
            />
            <EmojiSelector
              question="Hur är ditt humör generellt?"
              emojis={EMOJI_SETS.mood}
              selectedValue={wellbeingData.mood}
              onSelect={(value) => handleSelect('mood', value)}
            />
          </div>
        </div>


        <div className="mt-6 pt-6 border-t border-neutral-light/60 flex flex-col sm:flex-row gap-4 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="w-full px-5 py-3 text-lg font-semibold text-white bg-primary hover:bg-primary-darker rounded-lg shadow-md active:scale-95 interactive-transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Spara & Fortsätt
          </button>
        </div>
      </div>
    </div>
  );
};

export default MentalWellbeingModal;
