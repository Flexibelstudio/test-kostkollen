import React, { useState, useEffect } from 'react';
import { XMarkIcon, FireIcon, TrophyIcon, CalendarIcon } from './icons';
import { BootcampParticipant, EveningReport, CoachViewMember } from '../types';
import { subscribeToUserEveningReports } from '../services/bootcampService';
import { doc, updateDoc } from 'firebase/firestore';
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

  useEffect(() => {
    const unsubscribe = subscribeToUserEveningReports(participant.cohortId, participant.userId, (data) => {
      setReports(data);
    }, participant.fas1StartDate);
    return () => unsubscribe();
  }, [participant.cohortId, participant.userId, participant.fas1StartDate]);

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
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-center gap-3">
              <div className="bg-orange-100 p-3 rounded-xl text-orange-500">
                <FireIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-orange-600 font-bold uppercase tracking-wider">Nuvarande Streak</p>
                <p className="text-2xl font-extrabold text-orange-500">{participant.currentStreak} dagar</p>
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
                  <div key={idx} className={`p-4 rounded-2xl border ${report.isGreenDay ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-neutral-dark">{report.date}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${report.isGreenDay ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
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
