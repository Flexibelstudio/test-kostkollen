import React, { useState, useEffect } from 'react';
import { XMarkIcon, FireIcon, TrophyIcon, CalendarIcon } from './icons';
import { BootcampParticipant, EveningReport, CoachViewMember } from '../types';
import { subscribeToUserEveningReports } from '../services/bootcampService';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ParticipantDetailModalProps {
  participant: BootcampParticipant;
  member: CoachViewMember;
  cohortName: string;
  onClose: () => void;
  isCoach?: boolean;
}

const ParticipantDetailModal: React.FC<ParticipantDetailModalProps> = ({ participant, member, cohortName, onClose, isCoach = false }) => {
  const [reports, setReports] = useState<EveningReport[]>([]);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [userProfileData, setUserProfileData] = useState<any>(null);

  // Editable values
  const [fas1StartDate, setFas1StartDate] = useState(participant.fas1StartDate || '');
  const [originalStartDate, setOriginalStartDate] = useState(participant.originalStartDate || '');
  const [goalStartDate, setGoalStartDate] = useState('');
  const [goalCompletionDate, setGoalCompletionDate] = useState('');
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToUserEveningReports(participant.cohortId, participant.userId, (data) => {
      setReports(data);
    }, fas1StartDate);
    return () => unsubscribe();
  }, [participant.cohortId, participant.userId, fas1StartDate]);

  useEffect(() => {
    if (!participant.userId) return;
    const fetchUserProfile = async () => {
      try {
        const userDocRef = doc(db, 'users', participant.userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const uData = docSnap.data();
          setUserProfileData(uData);
          setGoalStartDate(uData.goalStartDate || '');
          setGoalCompletionDate(uData.goalCompletionDate || '');
        }
      } catch (err) {
        console.error("Error fetching user profile in coach modal:", err);
      }
    };
    fetchUserProfile();
  }, [participant.userId]);

  const handleClearAttention = async () => {
    if (!isCoach) return;
    try {
      const ref = doc(db, 'bootcampCohorts', participant.cohortId, 'participants', participant.userId);
      await updateDoc(ref, {
        needsCoachAttention: false,
        attentionReason: null
      });
    } catch (error) {
      console.error("Error clearing attention flag:", error);
    }
  };

  const handleSaveDates = async () => {
    setIsSavingDates(true);
    setSaveMessage(null);
    try {
      // 1. Update participant document in bootcampCohorts/{cohortId}/participants/{userId}
      const participantRef = doc(db, 'bootcampCohorts', participant.cohortId, 'participants', participant.userId);
      const participantUpdates: any = {
        fas1StartDate: fas1StartDate
      };
      if (originalStartDate) {
        participantUpdates.originalStartDate = originalStartDate;
      } else {
        participantUpdates.originalStartDate = null;
      }
      await updateDoc(participantRef, participantUpdates);

      // 2. Update user profile document in users/{userId}
      const userRef = doc(db, 'users', participant.userId);
      await updateDoc(userRef, {
        goalStartDate: goalStartDate || null,
        goalCompletionDate: goalCompletionDate || null
      });

      setSaveMessage({ text: 'Datumen har uppdaterats framgångsrikt!', type: 'success' });
      
      // Update local object properties (best effort UI sync)
      participant.fas1StartDate = fas1StartDate;
      participant.originalStartDate = originalStartDate || undefined;

      // Close editing mode after brief success display
      setTimeout(() => {
        setIsEditingDates(false);
        setSaveMessage(null);
      }, 1500);

    } catch (err) {
      console.error("Error saving updated dates:", err);
      setSaveMessage({ text: 'Kunde inte uppdatera datumen.', type: 'error' });
    } finally {
      setIsSavingDates(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-neutral-light flex justify-between items-start bg-neutral-50">
          <div>
            <h2 className="text-2xl font-bold text-neutral-dark">{member.name}</h2>
            <p className="text-neutral-500">{member.email} • {cohortName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F6E2D9]/40 p-4 rounded-2xl border border-[#D96E4A]/30 flex items-center gap-3">
              <div className="bg-[#F6E2D9] p-3 rounded-xl text-[#D96E4A]">
                <FireIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-[#56524D] font-bold uppercase tracking-wider">Nuvarande Streak</p>
                <p className="text-2xl font-extrabold text-[#D96E4A]">{participant.currentStreak} dagar</p>
              </div>
            </div>
            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center gap-3">
              <div className="bg-neutral-200 p-3 rounded-xl text-neutral-500">
                <TrophyIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-neutral-500 font-bold uppercase tracking-wider">Längsta Streak</p>
                <p className="text-2xl font-extrabold text-neutral-dark">{participant.longestStreak} dagar</p>
              </div>
            </div>
          </div>

          {isCoach && participant.needsCoachAttention && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-red-700 flex items-center gap-2">
                  <XMarkIcon className="w-5 h-5" /> Behöver uppmärksamhet
                </h4>
                <p className="text-sm text-red-600 mt-1">{participant.attentionReason}</p>
              </div>
              <button 
                onClick={handleClearAttention}
                className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition-colors text-sm"
              >
                Markera som hanterad
              </button>
            </div>
          )}

          {/* Coach tools for dates & goals */}
          {isCoach && (
            <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-neutral-dark flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Administrera datum & måldatum
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditingDates(!isEditingDates)}
                  className="text-xs font-bold text-primary hover:underline bg-neutral-100 px-3 py-1 rounded-lg hover:bg-neutral-200 transition-all"
                >
                  {isEditingDates ? 'Avbryt' : 'Ändra datum'}
                </button>
              </div>

              {!isEditingDates ? (
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mt-2">
                  <div>
                    <span className="text-neutral-500 block text-xs font-medium">Startdatum (Fas 1):</span>
                    <span className="font-semibold text-neutral-dark">{fas1StartDate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-xs font-medium">Absolut startdatum (Original):</span>
                    <span className="font-semibold text-neutral-dark">{originalStartDate || fas1StartDate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-xs font-medium">Personligt startmål:</span>
                    <span className="font-semibold text-neutral-dark">{goalStartDate || 'Ej specificerat'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-xs font-medium">Personligt slutmål:</span>
                    <span className="font-bold text-primary">{goalCompletionDate || 'Ej specificerat'}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Startdatum (Fas 1)</label>
                      <input
                        type="date"
                        value={fas1StartDate}
                        onChange={(e) => setFas1StartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-neutral-light rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Absolut startdatum (Original)</label>
                      <input
                        type="date"
                        value={originalStartDate}
                        onChange={(e) => setOriginalStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-neutral-light rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Mål startdatum</label>
                      <input
                        type="date"
                        value={goalStartDate}
                        onChange={(e) => setGoalStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-neutral-light rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Mål slutmål</label>
                      <input
                        type="date"
                        value={goalCompletionDate}
                        onChange={(e) => setGoalCompletionDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-neutral-light rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {saveMessage && (
                    <p className={`text-xs font-bold ${saveMessage.type === 'success' ? 'text-[#2B3B2C]' : 'text-red-500'}`}>
                      {saveMessage.text}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      disabled={isSavingDates}
                      onClick={handleSaveDates}
                      className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-opacity-90 transition-all text-xs flex items-center justify-center disabled:opacity-50"
                    >
                      {isSavingDates ? 'Sparar...' : 'Spara ändringar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="font-bold text-neutral-dark mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Kvällsrapporter
            </h3>
            {reports.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Inga rapporter inlämnade ännu.</p>
            ) : (
              <div className="space-y-3">
                {reports.map((report, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border ${report.isGreenDay ? 'bg-[#E8EFE9] border-[#2B3B2C]/20' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-neutral-dark">{report.date}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${report.isGreenDay ? 'bg-[#E8EFE9] text-[#2B3B2C]' : 'bg-red-100 text-red-700'}`}>
                        {report.isGreenDay ? 'Grön Dag' : 'Röd Dag'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                      <div><span className="text-neutral-500">Steg:</span> <span className="font-bold">{report.steps}</span></div>
                      <div><span className="text-neutral-500">Humör:</span> <span className="font-bold">{report.mood}/10</span></div>
                      <div><span className="text-neutral-500">Styrka:</span> <span className="font-bold">{report.strengthTrained ? 'Ja' : 'Nej'}</span></div>
                      {report.sleep && <div><span className="text-neutral-500">Sömn:</span> <span className="font-bold">{report.sleep}h</span></div>}
                    </div>
                    {report.comment && (
                      <div className="mt-3 pt-3 border-t border-black/5 italic text-neutral-700 text-sm">
                        "{report.comment}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantDetailModal;
