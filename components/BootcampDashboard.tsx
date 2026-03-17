import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, ShieldCheckIcon, CheckCircleIcon, FireIcon, CalendarIcon, ChatBubbleLeftRightIcon } from './icons';
import { BootcampParticipant, EveningReport } from '../types';
import { subscribeToUserEveningReports, submitEveningReport } from '../services/bootcampService';
import { auth } from '../firebase';
import ToastNotification from './ToastNotification';

interface BootcampDashboardProps {
  participant: BootcampParticipant;
  onBack: () => void;
}

const BootcampDashboard: React.FC<BootcampDashboardProps> = ({ participant, onBack }) => {
  const [reports, setReports] = useState<EveningReport[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [loggedAllMeals, setLoggedAllMeals] = useState(false);
  const [proteinMet, setProteinMet] = useState(false);
  const [waterMet, setWaterMet] = useState(false);
  const [steps, setSteps] = useState('');
  const [comment, setComment] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const hasReportedToday = reports.some(r => r.date === todayStr);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeToUserEveningReports(participant.cohortId, auth.currentUser.uid, (fetchedReports) => {
      setReports(fetchedReports);
    });
    return () => unsubscribe();
  }, [participant.cohortId]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const stepsNum = parseInt(steps, 10);
    if (isNaN(stepsNum)) {
      setToast({ message: 'Ange antal steg som en siffra.', type: 'error' });
      return;
    }

    const stepsMet = stepsNum >= 10000;
    const isGreenDay = loggedAllMeals && proteinMet && waterMet && stepsMet;

    setIsSubmitting(true);
    try {
      await submitEveningReport(participant.cohortId, auth.currentUser.uid, {
        date: todayStr,
        steps: stepsNum,
        mood: 5, // Default or add a slider if needed
        strengthTrained: false, // Optional for now
        proteinMet,
        waterMet,
        loggedAllMeals,
        comment,
        isGreenDay
      });
      
      setToast({ 
        message: isGreenDay ? 'Grön dag registrerad! Bra jobbat, rekryt!' : 'Röd dag registrerad. Streaken är bruten. Nya tag imorgon!', 
        type: isGreenDay ? 'success' : 'error' 
      });
      
      // Reset form
      setLoggedAllMeals(false);
      setProteinMet(false);
      setWaterMet(false);
      setSteps('');
      setComment('');
    } catch (error) {
      console.error("Error submitting report:", error);
      setToast({ message: 'Ett fel uppstod. Försök igen.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in pb-20">
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-dark hover:text-primary transition-colors mb-6 font-bold"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Tillbaka till Kurser
      </button>

      {/* Header */}
      <div className="bg-neutral-darker text-white p-6 rounded-3xl shadow-soft-xl mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheckIcon className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-extrabold">Bootcamp Status</h1>
            </div>
            <p className="text-neutral-300">
              {participant.cohortId === 'solo' ? 'Solo-uppdrag' : 'Trupp-uppdrag'} • {participant.status === 'fas1' ? 'Fas 1 (Dag 1-14)' : 'Fas 2'}
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-black/40 px-4 py-3 rounded-2xl border border-white/10 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-1 text-orange-400 mb-1">
                <FireIcon className="w-5 h-5" />
                <span className="font-bold text-xl">{participant.currentStreak}</span>
              </div>
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold">Nuvarande</span>
            </div>
            <div className="bg-black/40 px-4 py-3 rounded-2xl border border-white/10 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-1 text-neutral-300 mb-1">
                <FireIcon className="w-5 h-5" />
                <span className="font-bold text-xl">{participant.longestStreak}</span>
              </div>
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold">Längsta</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Today's Report */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
            <h2 className="text-xl font-bold text-neutral-dark mb-6 flex items-center gap-2">
              <CheckCircleIcon className="w-6 h-6 text-primary" />
              Dagens Kvällsrapport
            </h2>

            {hasReportedToday ? (
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-800 mb-2">Rapport inlämnad!</h3>
                <p className="text-emerald-600">
                  Du har redan lämnat din rapport för idag. Generalen har mottagit den. Vila upp dig inför morgondagen.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-6">
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={loggedAllMeals}
                      onChange={(e) => setLoggedAllMeals(e.target.checked)}
                      className="w-6 h-6 rounded text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-neutral-dark block">Total Loggningsplikt</span>
                      <span className="text-sm text-neutral-500">Jag har loggat all mat och dryck idag.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={proteinMet}
                      onChange={(e) => setProteinMet(e.target.checked)}
                      className="w-6 h-6 rounded text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-neutral-dark block">Proteinkravet</span>
                      <span className="text-sm text-neutral-500">Jag har nått mitt dagliga proteinmål.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={waterMet}
                      onChange={(e) => setWaterMet(e.target.checked)}
                      className="w-6 h-6 rounded text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-neutral-dark block">Vätskekontroll</span>
                      <span className="text-sm text-neutral-500">Jag har druckit minst 2 liter rent vatten.</span>
                    </div>
                  </label>

                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <label className="block font-bold text-neutral-dark mb-2">Stegmålet (Minst 10 000)</label>
                    <input 
                      type="number" 
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      placeholder="Ange antal steg..."
                      className="w-full p-3 rounded-xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-neutral-dark mb-2">Kommentar till Generalen</label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Hur kändes dagen? Några utmaningar?"
                    className="w-full p-4 rounded-2xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent min-h-[120px] resize-none"
                    required
                  />
                </div>

                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200">
                  <p className="text-sm text-orange-800 font-medium">
                    <strong>OBS:</strong> Om du inte kan kryssa i alla boxar och har minst 10 000 steg, kommer detta att registreras som en <strong className="text-red-600">Röd Dag</strong> och din streak bryts.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-neutral-darker text-white font-bold rounded-xl hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Skicka Kvällsrapport
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: History & Chat */}
        <div className="space-y-6">
          {participant.cohortId !== 'solo' && (
            <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
              <h3 className="font-bold text-neutral-dark mb-2 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary" />
                Truppens Chatt
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Kommunicera med din trupp, peppa varandra och dela med er av tips.
              </p>
              <button className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors">
                Öppna Chatt
              </button>
            </div>
          )}

          <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
            <h3 className="font-bold text-neutral-dark mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Historik (Senaste 7 dagarna)
            </h3>
            
            {reports.length === 0 ? (
              <p className="text-sm text-neutral-500 italic text-center py-4">Inga rapporter inlämnade ännu.</p>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 7).map((report, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <span className="text-sm font-medium text-neutral-dark">{report.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">{report.steps} steg</span>
                      <div className={`w-3 h-3 rounded-full ${report.isGreenDay ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    </div>
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

export default BootcampDashboard;
