import React, { useState, useEffect } from 'react';
import { NutritionalInfo } from '../types.ts';
import { CheckIcon, XMarkIcon } from './icons.tsx';

interface SaveCommonMealModalProps {
  mealInfo: NutritionalInfo;
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

const SaveCommonMealModal: React.FC<SaveCommonMealModalProps> = ({ mealInfo, initialName, onSave, onClose }) => {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-common-meal-title"
    >
      <div 
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-soft-xl w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-5">
            <span className="text-3xl mr-2.5" role="img" aria-hidden="true">📌</span>
            <h2 id="save-common-meal-title" className="text-2xl font-bold text-neutral-dark">Spara som vanligt val</h2>
        </div>
        <p className="text-base text-neutral mb-1.5">
          Ge detta val ett namn så att du enkelt kan logga det igen.
        </p>
        <div className="text-sm text-neutral-dark mb-5 bg-neutral-light/50 p-3 rounded-xl border border-neutral-light">
          <strong>Ursprunglig måltid:</strong> {mealInfo.foodItem || "Okänd"} ({Math.round(mealInfo.calories)} kcal)
        </div>
        <form onSubmit={handleSave}>
          <div>
            <label htmlFor="commonMealName" className="block text-sm font-bold text-neutral-dark mb-1">
              Namn för vanligt val:
            </label>
            <input
              type="text"
              id="commonMealName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 block w-full px-4 py-3 bg-white border border-neutral-light rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base font-medium"
              placeholder="T.ex. Min standardlunch"
              autoFocus
              required
            />
          </div>
          <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-base font-bold text-neutral-dark bg-neutral-light hover:bg-gray-200 rounded-xl active:scale-95 transform transition-all"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="px-6 py-3 text-base font-bold text-white bg-primary hover:bg-primary-darker rounded-xl shadow-lg shadow-primary/20 active:scale-95 transform transition-all flex items-center justify-center"
            >
              <CheckIcon className="w-5 h-5 mr-2" />
              Spara val
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveCommonMealModal;