import React, { useMemo, useState } from 'react';
import { CoachViewMember, UserProfileData } from '../types';
import { TrendingUp, Target, AlertTriangle, Star, Zap, Rocket, Users, Award, MessageCircle, ArrowRight } from 'lucide-react';
import AIMessageModal from './AIMessageModal';
import AIPostModal from './AIPostModal';
import { sendDirectMessage } from '../services/chatService';
import { createUserPost } from '../services/firestoreService';
import { User } from 'firebase/auth';

interface GrowthEngineViewProps {
    membersList: CoachViewMember[];
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    currentUser: User;
    userProfile: UserProfileData | null;
}

const GrowthEngineView: React.FC<GrowthEngineViewProps> = ({ membersList, setToastNotification, currentUser, userProfile }) => {
    const activeMembers = useMemo(() => membersList.filter(m => 
        m.status === 'approved' && 
        m.role === 'member' && 
        (m.subscriptionStatus === 'active' || m.subscriptionStatus === 'trialing' || m.subscriptionStatus === 'canceling')
    ), [membersList]);
    const currentCount = activeMembers.length;
    
    const milestones = [100, 500, 1000];
    const nextMilestone = milestones.find(m => m > currentCount) || 1000;
    const progressPercent = Math.min(100, (currentCount / nextMilestone) * 100);
    
    const remaining = nextMilestone - currentCount;
    const weeksToGoal = 26; // 6 months
    const requiredPerWeek = Math.ceil(remaining / weeksToGoal);

    // Risk users: No activity in 4-21 days
    const today = new Date();
    const riskUsers = useMemo(() => {
        return activeMembers.filter(m => {
            // Exclude users created in the last 7 days
            if (m.memberSince) {
                const memberSinceDate = new Date(m.memberSince);
                const diffDaysSinceCreation = Math.floor((today.getTime() - memberSinceDate.getTime()) / (1000 * 3600 * 24));
                if (diffDaysSinceCreation < 7) {
                    return false;
                }
            }

            if (!m.lastLogDate) return true;
            const lastLog = new Date(m.lastLogDate);
            const diffDays = Math.floor((today.getTime() - lastLog.getTime()) / (1000 * 3600 * 24));
            return diffDays >= 4 && diffDays <= 21;
        }).slice(0, 5); // Show top 5
    }, [activeMembers]);

    // Super users: High streak
    const superUsers = useMemo(() => {
        return [...activeMembers].sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0)).filter(m => (m.currentStreak || 0) >= 7).slice(0, 5);
    }, [activeMembers]);

    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [messageContext, setMessageContext] = useState('');
    const [messageTargets, setMessageTargets] = useState<CoachViewMember[]>([]);

    const [isPostModalOpen, setIsPostModalOpen] = useState(false);
    const [postContext, setPostContext] = useState('');

    const openMessageModal = (context: string, targets: CoachViewMember[]) => {
        if (targets.length === 0) {
            setToastNotification({ message: 'Inga användare att skicka till.', type: 'error' });
            return;
        }
        setMessageContext(context);
        setMessageTargets(targets);
        setIsMessageModalOpen(true);
    };

    const handleSendMessage = async (message: string, targets: CoachViewMember[]) => {
        const senderName = userProfile?.name || 'Coach';
        
        try {
            // Send messages in parallel
            await Promise.all(targets.map(async (target) => {
                // Replace placeholder with actual name if present
                const personalizedMessage = message.replace(/\[Namn\]/gi, target.name || 'där');
                await sendDirectMessage(
                    currentUser.uid,
                    senderName,
                    target.id,
                    target.name || 'Användare',
                    personalizedMessage
                );
            }));
            
            setToastNotification({ 
                message: `Meddelande skickat till ${targets.length} ${targets.length === 1 ? 'person' : 'personer'}!`, 
                type: 'success' 
            });
        } catch (error) {
            console.error("Error sending messages:", error);
            setToastNotification({ message: 'Ett fel uppstod när meddelandet skulle skickas.', type: 'error' });
        }
    };

    const openPostModal = (context: string) => {
        setPostContext(context);
        setIsPostModalOpen(true);
    };

    const handleSendPost = async (message: string) => {
        const senderName = userProfile?.name || 'Coach';
        const senderPhotoURL = userProfile?.photoURL || undefined;

        try {
            await createUserPost(
                currentUser.uid,
                message,
                'general',
                undefined,
                'global', // visibility
                senderName,
                senderPhotoURL
            );
            
            setToastNotification({ 
                message: 'Inlägget har publicerats i communityt!', 
                type: 'success' 
            });
        } catch (error) {
            console.error("Error creating post:", error);
            setToastNotification({ message: 'Ett fel uppstod när inlägget skulle publiceras.', type: 'error' });
        }
    };

    const handleAction = (actionName: string) => {
        setToastNotification({ message: `${actionName} utförd! (Demo)`, type: 'success' });
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header / Roadmap */}
            <section className="bg-gradient-to-br from-primary-darker to-primary p-8 rounded-3xl shadow-soft-xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                    <Rocket className="w-64 h-64" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <Target className="w-8 h-8 text-primary-200" />
                        <h2 className="text-3xl font-extrabold">Tillväxtmål: {nextMilestone} Medlemmar</h2>
                    </div>
                    <p className="text-primary-100 text-lg mb-8 max-w-2xl">
                        Ni är just nu {currentCount} aktiva medlemmar. För att nå målet inom 6 månader behöver ni netto-öka med {requiredPerWeek} medlemmar per vecka.
                    </p>

                    <div className="bg-white/20 p-6 rounded-2xl backdrop-blur-sm border border-white/30">
                        <div className="flex justify-between items-end mb-2">
                            <span className="font-bold text-xl">{currentCount}</span>
                            <span className="font-bold text-xl text-primary-100">{nextMilestone}</span>
                        </div>
                        <div className="w-full bg-black/20 rounded-full h-4 mb-2 overflow-hidden">
                            <div className="bg-white h-4 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <p className="text-sm text-primary-100 font-medium text-right">{remaining} kvar till nästa milstolpe!</p>
                    </div>
                </div>
            </section>

            {/* AI Recommendations */}
            <section>
                <h3 className="text-2xl font-bold text-neutral-dark mb-4 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-accent" />
                    Veckans Fokus (AI-Rekommendationer)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-soft-lg border border-neutral-light flex flex-col h-full">
                        <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <h4 className="font-bold text-lg mb-2">Rädda risk-användare</h4>
                        <p className="text-neutral text-sm mb-4 flex-grow">
                            {riskUsers.length} användare har inte loggat in på över 4 dagar. Ett personligt meddelande minskar risken för avhopp med 40%.
                        </p>
                        <button 
                            onClick={() => openMessageModal('Dessa användare har inte loggat in på 4-21 dagar. Skriv ett kort peppande meddelande för att få dem att komma tillbaka och fortsätta sin resa.', riskUsers)} 
                            className="w-full py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Skicka pepp till alla
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-soft-lg border border-neutral-light flex flex-col h-full">
                        <div className="bg-[#F1EAE0] w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                            <Users className="w-6 h-6 text-[#56524D]" />
                        </div>
                        <h4 className="font-bold text-lg mb-2">Driv engagemang</h4>
                        <p className="text-neutral text-sm mb-4 flex-grow">
                            Aktiviteten i communityt är något lägre än förra veckan. Starta en omröstning för att få igång diskussionen.
                        </p>
                        <button 
                            onClick={() => openPostModal('Aktiviteten i communityt är något lägre än förra veckan. Skriv ett inlägg som ställer en intressant fråga eller startar en omröstning för att få igång diskussionen bland medlemmarna.')} 
                            className="w-full py-2.5 bg-[#F1EAE0] text-[#56524D] font-bold rounded-xl hover:bg-[#E5DCD0] transition-colors flex items-center justify-center gap-2"
                        >
                            <Zap className="w-4 h-4" />
                            Generera inlägg
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-soft-lg border border-neutral-light flex flex-col h-full">
                        <div className="bg-[#F6E2D9] w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                            <Star className="w-6 h-6 text-[#D96E4A]" />
                        </div>
                        <h4 className="font-bold text-lg mb-2">Belöna ambassadörer</h4>
                        <p className="text-neutral text-sm mb-4 flex-grow">
                            Ni har {superUsers.length} användare med en streak över 7 dagar. Be dem bjuda in en vän!
                        </p>
                        <button 
                            onClick={() => openMessageModal('Dessa användare har en streak på över 7 dagar. De är superanvändare. Skriv ett meddelande där du berömmer dem för deras grymma insats och fråga om de vill rekommendera appen till en vän.', superUsers)} 
                            className="w-full py-2.5 bg-[#F6E2D9] text-[#D96E4A] font-bold rounded-xl hover:bg-[#F1EAE0] transition-colors flex items-center justify-center gap-2"
                        >
                            <Award className="w-4 h-4" />
                            Skicka värvningslänk
                        </button>
                    </div>
                </div>
            </section>

            {/* Detailed Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Users List */}
                <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Tappar motivationen?
                        </h3>
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">{riskUsers.length} st</span>
                    </div>
                    <p className="text-xs text-neutral mb-6">Konton skapade de senaste 7 dagarna visas inte här.</p>
                    <div className="space-y-3">
                        {riskUsers.length > 0 ? riskUsers.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                        {user.photoURL ? <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-gray-400" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{user.name}</p>
                                        <p className="text-xs text-neutral">Senast inloggad: {user.lastLogDate || 'Länge sen'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => openMessageModal(`Denna användare har inte loggat in på länge. Skriv ett kort, personligt och peppande meddelande för att få hen att komma tillbaka.`, [user])} 
                                    className="p-2 text-primary hover:bg-primary-50 rounded-lg transition-colors"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                </button>
                            </div>
                        )) : (
                            <p className="text-neutral text-sm text-center py-4">Inga användare i riskzonen just nu. Bra jobbat!</p>
                        )}
                    </div>
                </div>

                {/* Super Users List */}
                <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Star className="w-5 h-5 text-[#D96E4A]" />
                            Potentiella Ambassadörer
                        </h3>
                        <span className="bg-[#F6E2D9] text-[#D96E4A] text-xs font-bold px-2.5 py-1 rounded-full">{superUsers.length} st</span>
                    </div>
                    <div className="space-y-3">
                        {superUsers.length > 0 ? superUsers.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                        {user.photoURL ? <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-gray-400" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{user.name}</p>
                                        <p className="text-xs text-[#D96E4A] font-bold flex items-center gap-1">
                                            🔥 {user.currentStreak} dagars streak
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => openMessageModal(`Denna användare har en fantastisk streak på ${user.currentStreak} dagar. Beröm hen för insatsen och fråga om hen vill rekommendera appen till en vän.`, [user])} 
                                    className="p-2 text-[#D96E4A] hover:bg-[#F6E2D9] rounded-lg transition-colors" 
                                    title="Gör till ambassadör"
                                >
                                    <Award className="w-5 h-5" />
                                </button>
                            </div>
                        )) : (
                            <p className="text-neutral text-sm text-center py-4">Inga superanvändare identifierade än.</p>
                        )}
                    </div>
                </div>
            </div>

            <AIMessageModal 
                isOpen={isMessageModalOpen}
                onClose={() => setIsMessageModalOpen(false)}
                onSend={handleSendMessage}
                contextPrompt={messageContext}
                targetUsers={messageTargets}
            />

            <AIPostModal
                isOpen={isPostModalOpen}
                onClose={() => setIsPostModalOpen(false)}
                onSend={handleSendPost}
                contextPrompt={postContext}
            />
        </div>
    );
};

export default GrowthEngineView;
