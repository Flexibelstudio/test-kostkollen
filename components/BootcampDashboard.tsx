import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, ShieldCheckIcon, CheckCircleIcon, FireIcon, CalendarIcon, ChatBubbleLeftRightIcon } from './icons';
import { BootcampParticipant, EveningReport, UserProfileData, GoalSettings } from '../types';
import { subscribeToUserEveningReports, submitEveningReport } from '../services/bootcampService';
import { fetchMealLogsForDate, fetchWaterLog } from '../services/firestoreService';
import { auth } from '../firebase';
import ToastNotification from './ToastNotification';

import BootcampFeed from './BootcampFeed';

interface BootcampDashboardProps {
  participant: BootcampParticipant;
  userProfile: UserProfileData;
  goals: GoalSettings;
  onBack: () => void;
}

const BootcampDashboard: React.FC<BootcampDashboardProps> = ({ participant, userProfile, goals, onBack }) => {
  const [reports, setReports] = useState<EveningReport[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'feed'>('report');

  // Form state
  const [loggedAllMeals, setLoggedAllMeals] = useState(false);
  const [proteinMet, setProteinMet] = useState(false);
  const [waterMet, setWaterMet] = useState(false);
  const [steps, setSteps] = useState('');
  const [comment, setComment] = useState('');
  const [strengthTrained, setStrengthTrained] = useState(false);
  const [mood, setMood] = useState(5);
  const [sleep, setSleep] = useState('');
  const [editingYesterday, setEditingYesterday] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const targetDateStr = editingYesterday ? yesterdayStr : todayStr;
  const hasReportedToday = reports.some(r => r.date === todayStr);
  const yesterdayReport = reports.find(r => r.date === yesterdayStr);
  
  // Can edit yesterday if it's before noon today, and yesterday was reported but maybe we want to fix it.
  // Or maybe we didn't report yesterday at all.
  const currentHour = new Date().getHours();
  const canEditYesterday = currentHour < 12 && (!yesterdayReport || !yesterdayReport.isGreenDay);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeToUserEveningReports(participant.cohortId, auth.currentUser.uid, (fetchedReports) => {
      setReports(fetchedReports);
    });
    return () => unsubscribe();
  }, [participant.cohortId]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchProgress = async () => {
      try {
        const [meals, water] = await Promise.all([
          fetchMealLogsForDate(auth.currentUser!.uid, targetDateStr),
          fetchWaterLog(auth.currentUser!.uid, targetDateStr)
        ]);
        
        const totalProtein = meals.reduce((acc, meal) => acc + meal.nutritionalInfo.protein, 0);
        const totalCalories = meals.reduce((acc, meal) => acc + meal.nutritionalInfo.calories, 0);
        
        setLoggedAllMeals(meals.length > 0 && totalCalories > 400);
        setProteinMet(totalProtein >= goals.proteinGoal);
        setWaterMet(water >= 2000); // 2 liters

        if (editingYesterday && yesterdayReport) {
          setSteps(yesterdayReport.steps.toString());
          setMood(yesterdayReport.mood);
          setStrengthTrained(yesterdayReport.strengthTrained);
          setSleep(yesterdayReport.sleep ? yesterdayReport.sleep.toString() : '');
          setComment(yesterdayReport.comment || '');
        } else if (!editingYesterday) {
          setSteps('');
          setMood(5);
          setStrengthTrained(false);
          setSleep('');
          setComment('');
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    };
    fetchProgress();
  }, [targetDateStr, goals.proteinGoal, editingYesterday, yesterdayReport]);

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
        date: targetDateStr,
        steps: stepsNum,
        mood,
        strengthTrained,
        sleep: sleep ? parseFloat(sleep) : undefined,
        proteinMet,
        waterMet,
        loggedAllMeals,
        comment,
        isGreenDay
      }, userProfile);
      
      if (editingYesterday) {
        if (isGreenDay) {
          setToast({ 
            message: 'Ordningen återställd! Generalen har justerat protokollet och din streak är räddad!', 
            type: 'success' 
          });
        } else {
          setToast({ 
            message: 'Gårdagens rapport har uppdaterats.', 
            type: 'info' 
          });
        }
        setEditingYesterday(false);
      } else {
        setToast({ 
          message: isGreenDay ? 'Grön dag registrerad! Bra jobbat, rekryt!' : 'Röd dag registrerad. Streaken är bruten. Nya tag imorgon!', 
          type: isGreenDay ? 'success' : 'error' 
        });
      }
      
      // Reset form
      setLoggedAllMeals(false);
      setProteinMet(false);
      setWaterMet(false);
      setSteps('');
      setComment('');
      setStrengthTrained(false);
      setMood(5);
      setSleep('');
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

      {/* Tabs */}
      <div className="flex -mb-px border-b border-neutral-light overflow-x-auto hide-scrollbar mb-6">
        <button 
          onClick={() => setActiveTab('report')} 
          className={`py-3 px-6 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === 'report' ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-primary'}`}
        >
          Min Status
        </button>
        <button 
          onClick={() => setActiveTab('feed')} 
          className={`py-3 px-6 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === 'feed' ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-primary'}`}
        >
          Truppen
        </button>
      </div>

      {activeTab === 'report' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Today's Report */}
          <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-neutral-dark flex items-center gap-2">
                <CheckCircleIcon className="w-6 h-6 text-primary" />
                {editingYesterday ? 'Gårdagens Kvällsrapport' : 'Dagens Kvällsrapport'}
              </h2>
              {!editingYesterday && canEditYesterday && (
                <button 
                  onClick={() => setEditingYesterday(true)}
                  className="text-sm font-bold text-orange-600 hover:text-orange-700 underline"
                >
                  Rätta gårdagen
                </button>
              )}
            </div>

            {(!editingYesterday && hasReportedToday) ? (
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-800 mb-2">Rapport inlämnad!</h3>
                <p className="text-emerald-600">
                  Du har redan lämnat din rapport för idag. Generalen har mottagit den. Vila upp dig inför morgondagen.
                </p>
                {canEditYesterday && (
                  <button 
                    onClick={() => setEditingYesterday(true)}
                    className="mt-4 px-4 py-2 bg-orange-100 text-orange-800 rounded-full font-bold text-sm hover:bg-orange-200 transition-colors"
                  >
                    Rätta gårdagens rapport
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-6">
                {editingYesterday && (
                  <div className="p-4 bg-orange-50 text-orange-800 rounded-2xl mb-4 flex justify-between items-center">
                    <span>Du redigerar gårdagens rapport ({yesterdayStr}).</span>
                    <button type="button" onClick={() => setEditingYesterday(false)} className="text-sm font-bold underline">Avbryt</button>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 text-blue-800 rounded-2xl text-sm mb-4">
                    <p>
                      <strong>OBS:</strong> Mat, protein och vatten hämtas automatiskt från din loggbok. 
                      Om du saknar något, gå tillbaka till Hem-fliken och logga det innan du skickar in rapporten.
                    </p>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${loggedAllMeals ? 'bg-emerald-50 border-emerald-200' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${loggedAllMeals ? 'bg-emerald-500 text-white' : 'bg-neutral-200 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold block ${loggedAllMeals ? 'text-emerald-800' : 'text-neutral-dark'}`}>Total Loggningsplikt</span>
                      <span className={`text-sm ${loggedAllMeals ? 'text-emerald-600' : 'text-neutral-500'}`}>
                        {loggedAllMeals ? 'Du har loggat mat idag.' : 'Du har inte loggat tillräckligt med mat idag.'}
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${proteinMet ? 'bg-emerald-50 border-emerald-200' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${proteinMet ? 'bg-emerald-500 text-white' : 'bg-neutral-200 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold block ${proteinMet ? 'text-emerald-800' : 'text-neutral-dark'}`}>Proteinkravet</span>
                      <span className={`text-sm ${proteinMet ? 'text-emerald-600' : 'text-neutral-500'}`}>
                        {proteinMet ? `Du har nått ditt mål (${goals.proteinGoal}g).` : `Du har inte nått ditt proteinmål (${goals.proteinGoal}g).`}
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${waterMet ? 'bg-emerald-50 border-emerald-200' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${waterMet ? 'bg-emerald-500 text-white' : 'bg-neutral-200 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold block ${waterMet ? 'text-emerald-800' : 'text-neutral-dark'}`}>Vätskekontroll</span>
                      <span className={`text-sm ${waterMet ? 'text-emerald-600' : 'text-neutral-500'}`}>
                        {waterMet ? 'Du har druckit minst 2 liter vatten.' : 'Du har inte druckit 2 liter vatten än.'}
                      </span>
                    </div>
                  </div>

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

                  <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={strengthTrained}
                      onChange={(e) => setStrengthTrained(e.target.checked)}
                      className="w-6 h-6 rounded text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-neutral-dark block">Styrketräning</span>
                      <span className="text-sm text-neutral-500">Jag har genomfört ett träningspass idag.</span>
                    </div>
                  </label>

                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <label className="block font-bold text-neutral-dark mb-2">Sömn (Timmar)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      value={sleep}
                      onChange={(e) => setSleep(e.target.value)}
                      placeholder="T.ex. 7.5"
                      className="w-full p-3 rounded-xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <label className="block font-bold text-neutral-dark mb-2">Energinivå / Mående ({mood}/10)</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={mood}
                      onChange={(e) => setMood(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>1 (Låg)</span>
                      <span>10 (Hög)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-neutral-dark mb-2">Kommentar till Generalen (Frivilligt)</label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Hur kändes dagen? Några utmaningar?"
                    className="w-full p-4 rounded-2xl border border-neutral-light focus:ring-2 focus:ring-primary focus:border-transparent min-h-[120px] resize-none"
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
                  {editingYesterday ? 'Uppdatera Gårdagens Rapport' : 'Skicka Kvällsrapport'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: History & Chat */}
        <div className="space-y-6">
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
      )}

      {activeTab === 'feed' && (
        <div className="h-[calc(100vh-250px)]">
          <BootcampFeed cohortId={participant.cohortId} userProfile={userProfile} />
        </div>
      )}
    </div>
  );
};

export default BootcampDashboard;
