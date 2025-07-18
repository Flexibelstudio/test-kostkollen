

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
    // Modal container (handled by App.tsx for backdrop animation)
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg">
        <div className="flex items-center mb-5">
            <span className="text-3xl mr-2.5" role="img" aria-hidden="true">📌</span>
            <h2 id="save-common-meal-title" className="text-2xl font-semibold text-neutral-dark">Spara som vanligt val</h2>
        </div>
        <p className="text-base text-neutral mb-1.5">
          Ge detta val ett namn så att du enkelt kan logga det igen.
        </p>
        <p className="text-sm text-neutral-dark mb-5 bg-neutral-light p-2.5 rounded-md">
          <strong>Ursprunglig måltid:</strong> {mealInfo.foodItem || "Okänd"} ({mealInfo.calories.toFixed(0)} kcal)
        </p>
        <form onSubmit={handleSave}>
          <div>
            <label htmlFor="commonMealName" className="block text-base font-medium text-neutral-dark">
              Namn för vanligt val:
            </label>
            <input
              type="text"
              id="commonMealName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base"
              required
            />
          </div>
          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral focus:ring-opacity-50 active:scale-95 transform"
            >
              <XMarkIcon className="w-5 h-5 inline mr-1.5" />
              Avbryt
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
            >
              <CheckIcon className="w-5 h-5 inline mr-1.5" />
              Spara val
            </button>
          </div>
        </form>
      </div>
  );
};

export default SaveCommonMealModal;
