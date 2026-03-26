import React, { useState, useEffect } from 'react';
import { User } from '@firebase/auth';
import { UserProfileData, BootcampCohort, CoachViewMember, BootcampParticipant } from '../types';
import { subscribeToCohorts, createCohort, subscribeToAllBootcampParticipants } from '../services/bootcampService';
import { createChat } from '../services/chatService';
import { TrophyIcon, UsersIcon, PlusIcon, XMarkIcon, CalendarIcon, KeyIcon, FireIcon, CheckIcon, ArrowLeftIcon } from './icons';
import BootcampFeed from './BootcampFeed';
import CoachStudioView from './CoachStudioView';
import { subscribeToUserEveningReports } from '../services/bootcampService';
import { createUserPost } from '../services/firestoreService';
import { EveningReport } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface BootcampLedningscentralProps {
  currentUser: User;
  userProfile: UserProfileData;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  membersList: CoachViewMember[];
  onMemberClick: (member: CoachViewMember) => void;
}

import ParticipantDetailModal from './ParticipantDetailModal';
import BootcampContentLibrary from './BootcampContentLibrary';

export const BootcampLedningscentral: React.FC<BootcampLedningscentralProps> = ({
  currentUser,
  userProfile,
  setToastNotification,
  membersList,
  onMemberClick
}) => {
  const [cohorts, setCohorts] = useState<BootcampCohort[]>([]);
  const [participants, setParticipants] = useState<BootcampParticipant[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortCode, setNewCohortCode] = useState('');
  const [newCohortStartDate, setNewCohortStartDate] = useState('');
  const [newCohortIsPublic, setNewCohortIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<BootcampParticipant | null>(null);
  
  const [activeTab, setActiveTab] = useState<'cohorts' | 'participants' | 'library'>('cohorts');
  const [sortConfig, setSortConfig] = useState<{ key: keyof BootcampParticipant | 'name' | 'cohortName'; direction: 'asc' | 'desc' }>({ key: 'currentStreak', direction: 'desc' });

  useEffect(() => {
    const unsubscribeCohorts = subscribeToCohorts((data) => {
      setCohorts(data);
    });
    const unsubscribeParticipants = subscribeToAllBootcampParticipants((data) => {
      setParticipants(data);
    });
    return () => {
      unsubscribeCohorts();
      unsubscribeParticipants();
    };
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
        'public_room',
        newCohortName,
        `Officiell grupp för ${newCohortName}`,
        currentUser.uid,
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
        currentUser.uid,
        newCohortIsPublic
      );

      setToastNotification({ message: 'Bootcamp-trupp skapad!', type: 'success' });
      setIsCreating(false);
      setNewCohortName('');
      setNewCohortCode('');
      setNewCohortStartDate('');
      setNewCohortIsPublic(false);
    } catch (error) {
      console.error("Error creating cohort:", error);
      setToastNotification({ message: 'Ett fel uppstod', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (key: keyof BootcampParticipant | 'name' | 'cohortName') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortedParticipants = () => {
    return [...participants].sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof BootcampParticipant];
      let bVal: any = b[sortConfig.key as keyof BootcampParticipant];

      if (sortConfig.key === 'name') {
        aVal = membersList.find(m => m.id === a.userId)?.name || 'Okänd';
        bVal = membersList.find(m => m.id === b.userId)?.name || 'Okänd';
      } else if (sortConfig.key === 'cohortName') {
        aVal = cohorts.find(c => c.id === a.cohortId)?.name || (a.cohortId === 'solo' ? 'Solo-trupp' : 'Okänd');
        bVal = cohorts.find(c => c.id === b.cohortId)?.name || (b.cohortId === 'solo' ? 'Solo-trupp' : 'Okänd');
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const allCohorts = [
    {
      id: 'solo',
      name: 'Solo-trupp',
      inviteCode: 'N/A',
      startDate: 'Löpande',
      status: 'active' as const,
      isPublic: true,
      chatGroupId: 'solo_chat',
      createdBy: 'system',
      createdAt: Date.now()
    },
    ...cohorts
  ];

  if (selectedCohortId) {
    const cohort = allCohorts.find(c => c.id === selectedCohortId);
    if (!cohort) return null;

    const cohortParticipants = participants.filter(p => p.cohortId === selectedCohortId);

    return (
      <div className="space-y-6 animate-fade-in">
        <button 
          onClick={() => setSelectedCohortId(null)}
          className="flex items-center gap-2 text-neutral-dark hover:text-primary transition-colors mb-4 font-bold"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Tillbaka till Ledningscentral
        </button>

        <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-dark flex items-center gap-2">
                <TrophyIcon className="w-6 h-6 text-primary" />
                {cohort.name}
              </h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
                <span className="flex items-center gap-1"><KeyIcon className="w-4 h-4" /> Kod: {cohort.inviteCode}</span>
                <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> Start: {cohort.startDate}</span>
                <span className="flex items-center gap-1"><UsersIcon className="w-4 h-4" /> {cohortParticipants.length} deltagare</span>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              cohort.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
              cohort.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {cohort.status === 'active' ? 'Aktiv' : cohort.status === 'upcoming' ? 'Kommande' : 'Avslutad'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CoachStudioView 
              currentUser={currentUser} 
              setToastNotification={setToastNotification}
              lockedCoach="hard"
              hideCategory={true}
              className="h-[600px]"
              onPublish={async (draft, category, coach) => {
                await createUserPost(
                  currentUser.uid,
                  draft,
                  'general', // category
                  undefined, // image
                  'bootcamp', // visibility
                  coach.label, // overrideName
                  coach.imageUrl, // overridePhotoURL
                  cohort.id // bootcampId
                );
              }}
            />

            <div className="bg-white rounded-3xl shadow-soft-xl border border-neutral-light overflow-hidden h-[600px] flex flex-col">
              <div className="p-4 border-b border-neutral-light bg-neutral-50">
                <h3 className="font-bold text-neutral-dark">Truppens Flöde</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <BootcampFeed cohortId={cohort.id} userProfile={userProfile} hideCreatePost={true} />
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
              <h3 className="font-bold text-neutral-dark mb-4 flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-primary" />
                Deltagare
              </h3>
              {cohortParticipants.length === 0 ? (
                <p className="text-sm text-neutral-500 italic">Inga deltagare ännu.</p>
              ) : (
                <div className="space-y-3">
                  {cohortParticipants.map(participant => {
                    const member = membersList.find(m => m.id === participant.userId);
                    return (
                      <div 
                        key={participant.userId} 
                        className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100 cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => member && setSelectedParticipant(participant)}
                      >
                        <div>
                          <div className="font-bold text-sm text-neutral-dark">{member?.name || 'Okänd'}</div>
                          <div className="text-xs text-neutral-500">Streak: {participant.currentStreak} 🔥</div>
                        </div>
                        {participant.needsCoachAttention && (
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        {selectedParticipant && membersList.find(m => m.id === selectedParticipant.userId) && (
          <ParticipantDetailModal
            participant={selectedParticipant}
            member={membersList.find(m => m.id === selectedParticipant.userId)!}
            cohortName={cohorts.find(c => c.id === selectedParticipant.cohortId)?.name || 'Solo'}
            onClose={() => setSelectedParticipant(null)}
            isCoach={true}
          />
        )}
      </div>
    );
  }

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
        <div className="flex gap-2">
          <div className="flex bg-neutral-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('cohorts')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'cohorts' ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Trupper
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'participants' ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Deltagare
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'library' ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Bibliotek & Schema
            </button>
          </div>
          {activeTab === 'cohorts' && (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Skapa Ny Trupp
            </button>
          )}
        </div>
      </div>

      {activeTab === 'cohorts' && isCreating && (
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
            <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-light">
              <input
                type="checkbox"
                id="isPublic"
                checked={newCohortIsPublic}
                onChange={(e) => setNewCohortIsPublic(e.target.checked)}
                className="w-5 h-5 text-primary rounded border-neutral-300 focus:ring-primary"
              />
              <div>
                <label htmlFor="isPublic" className="font-bold text-neutral-dark block cursor-pointer">Gör truppen publik i appen</label>
                <p className="text-xs text-neutral-500">Om ikryssad kan vem som helst se och gå med i truppen utan kod.</p>
              </div>
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

      {activeTab === 'cohorts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allCohorts.map(cohort => (
            <div 
              key={cohort.id} 
              className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => setSelectedCohortId(cohort.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-neutral-dark group-hover:text-primary transition-colors">{cohort.name}</h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cohort.isPublic ? 'bg-purple-100 text-purple-700' : 'bg-neutral-200 text-neutral-700'}`}>
                    {cohort.isPublic ? 'Publik Trupp' : 'Privat Trupp'}
                  </span>
                </div>
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

              <div 
                className="pt-4 border-t border-neutral-light flex justify-between items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCohortId(cohort.id);
                }}
              >
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
      )}

      {activeTab === 'participants' && (
        <div className="bg-white rounded-3xl shadow-soft-xl border border-neutral-light overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-light text-sm text-neutral-500 uppercase tracking-wider">
                  <th className="p-4 font-bold cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('name')}>
                    Deltagare {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-4 font-bold cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('cohortName')}>
                    Trupp {sortConfig.key === 'cohortName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-4 font-bold cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('status')}>
                    Fas {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-4 font-bold cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('currentStreak')}>
                    Streak {sortConfig.key === 'currentStreak' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-4 font-bold cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('needsCoachAttention')}>
                    Status {sortConfig.key === 'needsCoachAttention' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-light">
                {getSortedParticipants().map(participant => {
                  const member = membersList.find(m => m.id === participant.userId);
                  const cohort = cohorts.find(c => c.id === participant.cohortId);
                  return (
                    <tr 
                      key={participant.userId} 
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedParticipant(participant)}
                    >
                      <td className="p-4">
                        <div className="font-bold text-neutral-dark">{member?.name || 'Okänd'}</div>
                        <div className="text-xs text-neutral-500">{member?.email || ''}</div>
                      </td>
                      <td className="p-4 text-sm text-neutral-dark">
                        {cohort?.name || 'Solo'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-block ${participant.status === 'fas2' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {participant.status === 'fas2' ? 'Fas 2' : 'Fas 1'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 font-bold text-orange-500">
                          <FireIcon className="w-4 h-4" />
                          {participant.currentStreak}
                        </div>
                      </td>
                      <td className="p-4">
                        {participant.needsCoachAttention ? (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1 w-max">
                            <XMarkIcon className="w-3 h-3" />
                            {participant.attentionReason || 'Behöver uppmärksamhet'}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max">
                            <CheckIcon className="w-3 h-3" />
                            På spår
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {participants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-neutral-500">
                      Inga deltagare hittades.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeTab === 'library' && (
        <BootcampContentLibrary 
            setToastNotification={setToastNotification}
            currentUser={currentUser}
        />
      )}

      {selectedParticipant && membersList.find(m => m.id === selectedParticipant.userId) && (
        <ParticipantDetailModal
          participant={selectedParticipant}
          member={membersList.find(m => m.id === selectedParticipant.userId)!}
          cohortName={cohorts.find(c => c.id === selectedParticipant.cohortId)?.name || 'Solo'}
          onClose={() => setSelectedParticipant(null)}
          isCoach={true}
        />
      )}
    </div>
  );
};
