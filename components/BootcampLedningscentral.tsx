import React, { useState, useEffect } from 'react';
import { User } from '@firebase/auth';
import { UserProfileData, BootcampCohort, CoachViewMember } from '../types';
import { subscribeToCohorts, createCohort } from '../services/bootcampService';
import { createChat } from '../services/chatService';
import { TrophyIcon, UsersIcon, PlusIcon, XMarkIcon, CalendarIcon, KeyIcon } from './icons';

interface BootcampLedningscentralProps {
  currentUser: User;
  userProfile: UserProfileData;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  membersList: CoachViewMember[];
}

export const BootcampLedningscentral: React.FC<BootcampLedningscentralProps> = ({
  currentUser,
  userProfile,
  setToastNotification,
  membersList
}) => {
  const [cohorts, setCohorts] = useState<BootcampCohort[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortCode, setNewCohortCode] = useState('');
  const [newCohortStartDate, setNewCohortStartDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToCohorts((data) => {
      setCohorts(data);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohortName.trim() || !newCohortCode.trim() || !newCohortStartDate) {
      setToastNotification({ message: 'Fyll i alla fält', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create the official chat group
      const chatGroupId = await createChat(
        newCohortName,
        'public_room',
        currentUser.uid,
        `Officiell grupp för ${newCohortName}`,
        [], // members will be added when they join
        'admin_only',
        false,
        true // isSystemGroup
      );

      // 2. Create the cohort
      await createCohort(
        newCohortName,
        newCohortCode,
        newCohortStartDate,
        chatGroupId,
        currentUser.uid
      );

      setToastNotification({ message: 'Bootcamp-trupp skapad!', type: 'success' });
      setIsCreating(false);
      setNewCohortName('');
      setNewCohortCode('');
      setNewCohortStartDate('');
    } catch (error) {
      console.error("Error creating cohort:", error);
      setToastNotification({ message: 'Ett fel uppstod', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-dark flex items-center gap-2">
            <TrophyIcon className="w-6 h-6 text-primary" />
            Ledningscentral: Bootcamp
          </h2>
          <p className="text-neutral-500">Hantera General Börjes trupper och rekryter.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Skapa Ny Trupp
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-neutral-dark">Skapa Ny Trupp</h3>
            <button onClick={() => setIsCreating(false)} className="text-neutral-400 hover:text-red-500">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleCreateCohort} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-neutral-dark mb-1">Truppens Namn</label>
              <input
                type="text"
                value={newCohortName}
                onChange={(e) => setNewCohortName(e.target.value)}
                placeholder="T.ex. Generalens April-trupp"
                className="w-full p-3 rounded-xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-dark mb-1">Inbjudningskod</label>
              <input
                type="text"
                value={newCohortCode}
                onChange={(e) => setNewCohortCode(e.target.value.toUpperCase())}
                placeholder="T.ex. BÖRJE-APRIL"
                className="w-full p-3 rounded-xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
                required
              />
              <p className="text-xs text-neutral-500 mt-1">Detta är koden deltagarna använder för att gå med.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-dark mb-1">Startdatum</label>
              <input
                type="date"
                value={newCohortStartDate}
                onChange={(e) => setNewCohortStartDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-neutral-500 font-bold hover:bg-neutral-light rounded-xl transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Skapar...' : 'Skapa Trupp'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cohorts.map(cohort => (
          <div key={cohort.id} className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light hover:border-primary/30 transition-colors cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-neutral-dark group-hover:text-primary transition-colors">{cohort.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                cohort.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                cohort.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {cohort.status === 'active' ? 'Aktiv' : cohort.status === 'upcoming' ? 'Kommande' : 'Avslutad'}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <KeyIcon className="w-4 h-4" />
                <span className="font-mono font-bold">{cohort.inviteCode}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <CalendarIcon className="w-4 h-4" />
                <span>Startar: {cohort.startDate}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-light flex justify-between items-center">
              <span className="text-sm font-bold text-primary">Hantera Trupp &rarr;</span>
            </div>
          </div>
        ))}

        {cohorts.length === 0 && !isCreating && (
          <div className="col-span-full bg-white p-12 rounded-3xl shadow-soft-xl border border-neutral-light text-center">
            <TrophyIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-neutral-dark mb-2">Inga trupper ännu</h3>
            <p className="text-neutral-500 mb-6">Skapa din första Bootcamp-trupp för att komma igång.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-colors inline-flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Skapa Ny Trupp
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
