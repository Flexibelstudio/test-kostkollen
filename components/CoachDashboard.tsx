
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CreatePostWidget } from './CommunityView';
import { CreateGroupView, ChatWindow } from './ChatRoomsView';
import { CoachViewMember, UserRole, UserProfileData, Chat } from '../types';
import type { User } from '@firebase/auth';
import { UserGroupIcon, ArrowRightOnRectangleIcon, EyeIcon, InformationCircleIcon, XMarkIcon, SwitchHorizontalIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, SearchIcon, CourseIcon, TrophyIcon, XCircleIcon, ProteinIcon, PersonIcon, SparklesIcon, ArchiveBoxIcon, ArrowUturnLeftIcon } from './icons';
import { User as UserIconLucide, PieChart, TrendingDown, Users as UsersIcon, BookOpen as BookOpenIcon } from 'lucide-react';
import { subscribeToSystemGroups, subscribeToPublicRooms, subscribeToAllChats } from '../services/chatService';
import { 
    fetchCoachViewMembers, 
    approveMember,
    revokeApproval, 
    archiveMember,
    unarchiveMember,
    updateUserRole,
    bulkApproveMembers,
    bulkUpdateUserRole,
    createUserPost,
    updateUserDocument,
    cleanupOrphanedProfiles
} from '../services/firestoreService';
import LoadingSpinner from './LoadingSpinner';
import MemberDetailModal from './MemberDetailModal';
import GrowthEngineView from './GrowthEngineView';
import CoachStudioView from './CoachStudioView';
import { EditorialPostsAdminView } from './EditorialPostsAdminView';
import { BootcampLedningscentral } from './BootcampLedningscentral';
import { Avatar } from './UserProfileModal';
import { TrendingUp, FlaskConical } from 'lucide-react';
import DevelopmentTestingTool from './DevelopmentTestingTool';
import { isTestingToolAllowed, TESTING_TOOL_ALLOWED_HOSTNAMES } from '../utils/testingToolHostnames';

type SortableKeys = keyof CoachViewMember;

/**
 * Stadverktyg for raderade konton.
 * Nar en anvandare raderas i Firebase Auth/Firestore kan deras publicProfile
 * bli kvar som en "spokprofil" - den dyker upp i kompissok och i flodet.
 * Knappen nedan kor molnfunktionen cleanupOrphanedProfiles som tar bort
 * profilerna och anonymiserar deras inlagg och kommentarer.
 */
const OrphanCleanupCard: React.FC<{
    setToastNotification: (t: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}> = ({ setToastNotification }) => {
    const [isBusy, setIsBusy] = useState(false);
    const [foundCount, setFoundCount] = useState<number | null>(null);

    const handleScan = async () => {
        setIsBusy(true);
        try {
            const res = await cleanupOrphanedProfiles(true);
            setFoundCount(res.orphanCount);
            setToastNotification({
                message: res.orphanCount === 0
                    ? 'Inga kvarglömda profiler hittades.'
                    : `Hittade ${res.orphanCount} kvarglömd${res.orphanCount === 1 ? ' profil' : 'a profiler'}.`,
                type: 'info'
            });
        } catch (e: any) {
            setToastNotification({ message: e?.message || 'Kunde inte söka igenom profilerna.', type: 'error' });
        } finally {
            setIsBusy(false);
        }
    };

    const handleClean = async () => {
        setIsBusy(true);
        try {
            const res = await cleanupOrphanedProfiles(false);
            setFoundCount(0);
            setToastNotification({
                message: `Klart: ${res.orphanCount} profil(er) borttagna, ${res.posts ?? 0} inlägg och ${res.comments ?? 0} kommentarer anonymiserade.`,
                type: 'success'
            });
        } catch (e: any) {
            setToastNotification({ message: e?.message || 'Städningen misslyckades.', type: 'error' });
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="mt-8 bg-white p-5 rounded-3xl shadow-soft-xl border border-neutral-light">
            <h3 className="font-bold text-neutral-dark text-base mb-1">Städa bort raderade konton</h3>
            <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                Tar bort profiler vars konto är raderat, så att de inte längre går att söka upp eller bli kompis med. Deras inlägg och kommentarer görs anonyma. Sök igenom först – då ändras ingenting.
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={handleScan}
                    disabled={isBusy}
                    className="px-4 py-2 bg-white border border-neutral-light text-primary font-bold rounded-xl hover:bg-primary-50 transition-colors shadow-sm disabled:opacity-50"
                >
                    {isBusy ? 'Arbetar…' : 'Sök igenom'}
                </button>
                {foundCount !== null && foundCount > 0 && (
                    <button
                        type="button"
                        onClick={handleClean}
                        disabled={isBusy}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                    >
                        Rensa {foundCount} profil{foundCount === 1 ? '' : 'er'}
                    </button>
                )}
                {foundCount !== null && (
                    <span className="text-sm text-neutral-500">
                        {foundCount === 0 ? 'Inget att städa.' : `${foundCount} hittade.`}
                    </span>
                )}
            </div>
        </div>
    );
};

// --- UI COMPONENTS ---

const DropdownMenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    className?: string;
}> = ({ icon, label, onClick, className = "text-neutral-dark hover:bg-neutral-light/50" }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors rounded-md font-medium ${className}`}
    >
        <div className="w-5 h-5 flex items-center justify-center opacity-80">
            {icon}
        </div>
        {label}
    </button>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  colorClass: string;
  textClass: string;
  onClick?: () => void;
  tooltip?: string;
}> = ({ icon, title, value, subtitle, colorClass, textClass, onClick, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const content = (
    <>
      <div className={`p-2.5 sm:p-3.5 rounded-xl ${colorClass} flex items-center justify-center shadow-sm`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: `w-5 h-5 sm:w-6 sm:h-6 ${textClass}` })}
      </div>
      <div className="text-left relative">
        <div className="flex items-center gap-1 mb-0.5">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">{title}</p>
          {tooltip && (
            <div 
              className="relative flex items-center"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(!showTooltip);
              }}
            >
              <InformationCircleIcon className="w-3 h-3 text-neutral-400 cursor-help hover:text-primary transition-colors" />
              {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-dark text-white text-xs rounded-lg shadow-xl z-50 normal-case tracking-normal font-normal text-center pointer-events-none">
                  {tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-dark"></div>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-extrabold text-neutral-dark leading-tight">{value}</p>
        {subtitle && <p className="text-xs text-neutral font-medium mt-1">{subtitle}</p>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="bg-white p-3 sm:p-5 rounded-2xl shadow-soft-lg border border-neutral-light flex flex-col sm:flex-row items-start sm:space-x-4 space-y-2 sm:space-y-0 transition-all hover:scale-[1.02] hover:border-primary/30 duration-300 cursor-pointer w-full focus:outline-none relative group">
        {content}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
        </div>
        <div className="absolute bottom-2 right-3">
            <span className="text-xs text-primary/70 font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Klicka för detaljer</span>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-soft-lg border border-neutral-light flex flex-col sm:flex-row items-start sm:space-x-4 space-y-2 sm:space-y-0 transition-transform hover:scale-[1.02] duration-300 cursor-default">
      {content}
    </div>
  );
};

const SubscriptionBadge: React.FC<{ status?: 'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive'; stripeCustomerId?: string | null }> = ({ status, stripeCustomerId }) => {
    let classes = "";
    let label = "";
    
    switch(status) {
        case 'active':
            classes = 'bg-[#E8EFE9] text-[#2B3B2C] border-[#7BA05B]/40';
            label = 'Aktiv (Betalande)';
            break;
        case 'trialing':
            classes = 'bg-[#F6E2D9] text-[#D96E4A] border-[#D96E4A]/30';
            label = 'Testperiod';
            break;
        case 'canceling':
            classes = 'bg-[#F6E2D9] text-[#D96E4A] border-[#D96E4A]/30';
            label = 'Sägs upp';
            break;
        case 'canceled':
            classes = 'bg-[#F1EAE0] text-[#7A756E] border-[#F1EAE0]';
            label = 'Avslutad';
            break;
        case 'inactive':
        default:
            if (stripeCustomerId) {
                classes = 'bg-neutral-100 text-neutral-600 border-neutral-300';
                label = '⚫ Avslutad';
            } else {
                classes = 'bg-red-50 text-red-700 border-red-200';
                label = '🔴 Aldrig aktiverad';
            }
            break;
    }

    return (
        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${classes}`}>
            {label}
        </span>
    );
};

const SortableHeader: React.FC<{ column: SortableKeys; label: string; tooltip?: string; sortBy: SortableKeys | null; sortOrder: 'asc' | 'desc'; onSort: (column: SortableKeys) => void; }> = ({ column, label, tooltip, sortBy, sortOrder, onSort }) => (
    <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider bg-gray-50/80 sticky top-0 backdrop-blur-md z-10 border-b border-gray-100">
        <button onClick={() => onSort(column)} className="flex items-center gap-1.5 group hover:text-primary transition-colors focus:outline-none">
            {label}
            {tooltip && <span className="relative" title={tooltip}><InformationCircleIcon className="w-3.5 h-3.5 text-neutral-400 hover:text-primary transition-colors cursor-help" /></span>}
            <span className={`transition-all duration-200 ${sortBy === column ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'}`}>
                {sortOrder === 'asc' && sortBy === column ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            </span>
        </button>
    </th>
);

const BulkActionButton: React.FC<{ onClick: () => void; children: React.ReactNode, className?: string; disabled: boolean; }> = ({ onClick, children, className, disabled }) => (
    <button 
        onClick={onClick} 
        disabled={disabled} 
        className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm active:scale-95 interactive-transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide ${className}`}
    >
        {children}
    </button>
);

const getTodayKey = () => {
    const z = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
    const year = z.getFullYear();
    const month = String(z.getMonth() + 1).padStart(2, '0');
    const day = String(z.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const GroupInsights: React.FC<{ membersList: CoachViewMember[]; isExpanded: boolean; onToggle: () => void; systemGroupsCount: number; publicRoomsCount: number; allChatsCount: number; }> = ({ membersList, isExpanded, onToggle, systemGroupsCount, publicRoomsCount, allChatsCount }) => {
    const groupInsights = useMemo(() => {
        const activeMembers = membersList.filter(m => 
            m.status === 'approved' && 
            m.role === 'member' && 
            (m.subscriptionStatus === 'active' || m.subscriptionStatus === 'trialing' || m.subscriptionStatus === 'canceling')
        );
        const totalActiveCount = activeMembers.length;
        const todayKey = getTodayKey();
        const activeTodayCount = activeMembers.filter(m => m.lastLogDate === todayKey).length;
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newMembers7d = activeMembers.filter(m => {
            if (!m.memberSince || m.memberSince === 'Aldrig') return false;
            const memberDate = new Date(m.memberSince);
            return memberDate >= sevenDaysAgo;
        }).length;

        if (totalActiveCount === 0) return { totalActiveCount: 0, archivedCount: membersList.filter(m => m.status === 'archived').length, percentWithStreak: 0, averageStreak: 0, percentOnCourse: 0, averageCourseProgress: 0, averageWeeklyLoss: 0, recordWeeklyLoss: 0, averageAge: 0, maleCount: 0, femaleCount: 0, loseFatCount: 0, gainMuscleCount: 0, maintainCount: 0, proteinGoalMetPercentage7d: 0, activeTodayCount: 0, newMembers7d: 0, loggedFoodCount7d: 0 };

        const membersWithStreak = activeMembers.filter(m => (m.currentStreak || 0) > 0);
        const percentWithStreak = (membersWithStreak.length / totalActiveCount) * 100;
        const averageStreak = activeMembers.reduce((sum, m) => sum + (m.currentStreak || 0), 0) / totalActiveCount;
        
        const membersOnCourse = activeMembers.filter(m => m.courseProgressSummary && m.courseProgressSummary.started);
        const percentOnCourse = (membersOnCourse.length / totalActiveCount) * 100;
        let averageCourseProgress = 0;
        if (membersOnCourse.length > 0) {
            const totalProgress = membersOnCourse.reduce((acc, member) => {
                const progress = member.courseProgressSummary;
                if (progress && progress.totalLessons > 0) return acc + (progress.completedLessons / progress.totalLessons);
                return acc;
            }, 0);
            averageCourseProgress = (totalProgress / membersOnCourse.length) * 100;
        }
        
        const membersWithWeightLoss = activeMembers.filter(m => m.weeklyWeightChange !== undefined && m.weeklyWeightChange < 0);
        const averageWeeklyLoss = membersWithWeightLoss.length > 0 ? Math.abs(membersWithWeightLoss.reduce((sum, m) => sum + m.weeklyWeightChange!, 0) / membersWithWeightLoss.length) : 0;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const recordWeeklyLoss = membersWithWeightLoss.length > 0 ? Math.abs(Math.min(...membersWithWeightLoss.map(m => m.weeklyWeightChange!))) : 0;
        const membersWithAge = activeMembers.filter(m => m.ageYears && m.ageYears > 0);
        const averageAge = membersWithAge.length > 0 ? membersWithAge.reduce((sum, m) => sum + m.ageYears!, 0) / membersWithAge.length : 0;
        const maleCount = activeMembers.filter(m => m.gender === 'male').length;
        const femaleCount = activeMembers.filter(m => m.gender === 'female').length;
        const loseFatCount = activeMembers.filter(m => m.goalSummary?.includes('fett')).length;
        const gainMuscleCount = activeMembers.filter(m => m.goalSummary?.includes('muskler')).length;
        const maintainCount = activeMembers.filter(m => m.goalSummary === 'Bibehålla').length;
        const membersWhoLoggedFood = activeMembers.filter(m => m.hasLoggedFood7d);
        const membersWhoMetProteinGoal = membersWhoLoggedFood.filter(m => m.metProteinGoal7d);
        const proteinGoalMetPercentage7d = membersWhoLoggedFood.length > 0 
            ? (membersWhoMetProteinGoal.length / membersWhoLoggedFood.length) * 100 
            : 0;

        return { totalActiveCount, archivedCount: membersList.filter(m => m.status === 'archived').length, percentWithStreak, averageStreak, percentOnCourse, averageCourseProgress, averageWeeklyLoss, recordWeeklyLoss, averageAge, maleCount, femaleCount, loseFatCount, gainMuscleCount, maintainCount, proteinGoalMetPercentage7d, activeTodayCount, newMembers7d, loggedFoodCount7d: membersWhoLoggedFood.length };
    }, [membersList]);

    return (
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-soft-xl border border-neutral-light mb-8">
            <button 
                onClick={onToggle} 
                className="w-full flex justify-between items-center text-left group focus:outline-none" 
                aria-expanded={isExpanded} 
                aria-controls="group-insights-panel"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-primary-100 p-2 rounded-xl text-primary-darker">
                        <PieChart className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-neutral-dark group-hover:text-primary transition-colors">Team Översikt</h2>
                </div>
                <div className={`p-2 rounded-full bg-neutral-light group-hover:bg-gray-200 transition-colors ${isExpanded ? 'bg-gray-200' : ''}`}>
                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-neutral-dark" /> : <ChevronDownIcon className="w-5 h-5 text-neutral-dark" />}
                </div>
            </button>
            
            <div 
                id="group-insights-panel" 
                className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6 transition-all duration-500 ease-in-out ${isExpanded ? 'opacity-100 max-h-[3000px]' : 'opacity-0 max-h-0 overflow-hidden mt-0'}`}
            >
                <StatCard icon={<UserGroupIcon />} title="Aktiva Medlemmar" value={groupInsights.totalActiveCount.toString()} subtitle={`+${groupInsights.newMembers7d} senaste 7 dagarna`} colorClass="bg-[#F6E2D9]" textClass="text-[#D96E4A]" />
                <StatCard icon={<SparklesIcon />} title="Inloggade Idag" value={groupInsights.activeTodayCount.toString()} subtitle={`${((groupInsights.activeTodayCount / (groupInsights.totalActiveCount || 1)) * 100).toFixed(0)}% av aktiva`} colorClass="bg-[#E8EFE9]" textClass="text-[#7BA05B]" />
                <StatCard icon={<UsersIcon />} title="Grupper i systemet" value={allChatsCount.toString()} subtitle={`${systemGroupsCount} Officiella, ${publicRoomsCount} Publika, ${allChatsCount - systemGroupsCount - publicRoomsCount} Privata`} colorClass="bg-[#F6E2D9]" textClass="text-[#D96E4A]" />
                <StatCard icon={<ArchiveBoxIcon />} title="Arkiverade" value={groupInsights.archivedCount.toString()} colorClass="bg-[#F1EAE0]" textClass="text-[#7A756E]" />
                <StatCard icon={<PersonIcon />} title="Snittålder" value={groupInsights.averageAge.toFixed(0)} subtitle={`${groupInsights.maleCount} M | ${groupInsights.femaleCount} K`} colorClass="bg-[#F1EAE0]" textClass="text-[#56524D]" />
                <StatCard icon={<TrendingDown />} title="Mål: Fettminskning" value={groupInsights.loseFatCount.toString()} subtitle={`${groupInsights.gainMuscleCount} Muskel↑, ${groupInsights.maintainCount} Bibehåll`} colorClass="bg-[#F6E2D9]" textClass="text-[#D96E4A]" />
                <StatCard 
                    icon={<ProteinIcon />} 
                    title="Proteinmål (7d)" 
                    value={`${groupInsights.proteinGoalMetPercentage7d.toFixed(0)}%`} 
                    subtitle={`Baserat på ${groupInsights.loggedFoodCount7d} medlemmar`} 
                    colorClass="bg-[#F6E2D9]" 
                    textClass="text-[#D96E4A]" 
                    tooltip="Av de medlemmar som har loggat mat de senaste 7 dagarna, hur stor andel har nått sitt proteinmål i snitt."
                />
                <StatCard icon={<TrophyIcon />} title="Streak-engagemang" value={`${groupInsights.percentWithStreak.toFixed(0)}%`} subtitle={`Snitt: ${groupInsights.averageStreak.toFixed(1)} dagar`} colorClass="bg-[#F6E2D9]" textClass="text-[#D96E4A]" />
                <StatCard icon={<CourseIcon />} title="Kurs-engagemang" value={`${groupInsights.percentOnCourse.toFixed(0)}%`} colorClass="bg-[#F6E2D9]" textClass="text-[#D96E4A]" />
            </div>
        </section>
    );
};

const MemberFilters: React.FC<{
    searchQuery: string; onSearchChange: (q: string) => void;
    filterStatus: 'all' | 'approved' | 'never_activated' | 'canceled' | 'archived'; onFilterStatusChange: (s: 'all' | 'approved' | 'never_activated' | 'canceled' | 'archived') => void;
    onRefresh: () => void; isRefreshDisabled: boolean;
}> = ({ searchQuery, onSearchChange, filterStatus, onFilterStatusChange, onRefresh, isRefreshDisabled }) => (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-3 gap-3">
        <h2 className="text-xl font-bold text-neutral-dark">Medlemslista</h2>
        
        <div className="flex flex-row items-center gap-2 w-full lg:w-auto">
            {/* Search Bar */}
            <div className="relative w-full sm:w-48 group">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <SearchIcon className="w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                </div>
                <input 
                    type="text" 
                    placeholder="Sök namn/e-post..." 
                    value={searchQuery} 
                    onChange={(e) => onSearchChange(e.target.value)} 
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-neutral-light/50 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" 
                    aria-label="Sök medlemmar" 
                />
            </div>
 
            {/* Filter Pills */}
            <div className="flex bg-neutral-light/30 p-0.5 rounded-lg overflow-x-auto max-w-full">
                {(['all', 'approved', 'never_activated', 'canceled', 'archived'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => onFilterStatusChange(status)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                            filterStatus === status 
                                ? 'bg-white shadow-sm text-primary' 
                                : 'text-neutral hover:text-neutral-dark hover:bg-neutral-light/50'
                        }`}
                    >
                        {status === 'all' && 'Alla'}
                        {status === 'approved' && 'Aktiva'}
                        {status === 'never_activated' && '🔴 Aldrig aktiverad'}
                        {status === 'canceled' && '⚫ Avslutad'}
                        {status === 'archived' && 'Arkiv'}
                    </button>
                ))}
            </div>

            {/* Refresh Button */}
            <button 
                onClick={onRefresh} 
                className="p-1.5 text-primary bg-white border border-neutral-light rounded-lg hover:bg-primary-50 hover:border-primary/30 active:scale-95 transition-all disabled:opacity-50" 
                disabled={isRefreshDisabled}
                title="Uppdatera lista"
            >
                <SwitchHorizontalIcon className={`w-4 h-4 ${isRefreshDisabled ? 'animate-spin' : ''}`} />
            </button>
        </div>
    </div>
);

const BulkActionsBar: React.FC<{
    selectedCount: number;
    onClearSelection: () => void;
    onBulkAction: (action: 'setRoleCoach' | 'setRoleMember') => void;
    isBulkUpdating: boolean;
}> = ({ selectedCount, onClearSelection, onBulkAction, isBulkUpdating }) => (
    <div className="bg-primary-darker text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-[80px] z-30 mb-6 animate-slide-up-fade-in shadow-xl">
        <div className="flex items-center gap-3">
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{selectedCount} valda</span>
            <button onClick={onClearSelection} className="text-sm text-white/80 hover:text-white hover:underline">Avbryt</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
            <BulkActionButton onClick={() => onBulkAction('setRoleCoach')} disabled={isBulkUpdating} className="bg-primary text-white hover:bg-primary-darker border border-primary">Till Coach</BulkActionButton>
            <BulkActionButton onClick={() => onBulkAction('setRoleMember')} disabled={isBulkUpdating} className="bg-transparent border border-white/40 text-white hover:bg-white/10">Till Medlem</BulkActionButton>
        </div>
    </div>
);

const ActionButton: React.FC<{ onClick: () => void; disabled: boolean; icon: React.ReactNode; label: string; className: string }> = ({ onClick, disabled, icon, label, className }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }} 
        disabled={disabled} 
        className={`flex items-center px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {icon}
        <span className="ml-1.5">{label}</span>
    </button>
);

const MemberListTable: React.FC<{
    members: CoachViewMember[];
    currentUserId: string;
    selectedMemberIds: Set<string>;
    sortBy: SortableKeys | null;
    sortOrder: 'asc' | 'desc';
    updatingMemberId: string | null;
    onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectMember: (id: string) => void;
    onSort: (column: SortableKeys) => void;
    onShowDetails: (member: CoachViewMember) => void;
    onArchive: (id: string) => void;
    onUnarchive: (id: string) => void;
    onUpdateRole: (id: string, newRole: UserRole) => void;
}> = (props) => (
    <div className="bg-white rounded-3xl shadow-soft-xl border border-neutral-light overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-100">
                <thead>
                    <tr>
                        <th scope="col" className="px-3 py-2.5 bg-gray-50/80 w-12 sticky top-0 z-10 border-b border-gray-100 backdrop-blur-sm">
                            <div className="flex items-center justify-center">
                                <input 
                                    type="checkbox" 
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all" 
                                    onChange={props.onSelectAll} 
                                    checked={props.members.length > 0 && props.selectedMemberIds.size === props.members.length} 
                                    aria-label="Välj alla medlemmar" 
                                />
                            </div>
                        </th>
                        <SortableHeader column="name" label="Medlem" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                        <SortableHeader column="lastLogDate" label="Senaste Aktivitet" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                        <SortableHeader column="currentStreak" label="Streak" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                        <SortableHeader column="goalSummary" label="Mål" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                        <SortableHeader column="subscriptionStatus" label="Prenumeration" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                        <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider bg-gray-50/80 sticky top-0 z-10 border-b border-gray-100 backdrop-blur-sm">Åtgärder</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                    {props.members.map((member) => (
                        <tr 
                            key={member.id} 
                            onClick={() => props.onShowDetails(member)}
                            className={`group transition-all cursor-pointer ${props.selectedMemberIds.has(member.id) ? 'bg-primary-50' : 'hover:bg-neutral-light/40'} ${member.status === 'archived' ? 'opacity-70 grayscale-[0.5]' : ''}`}
                        >
                            <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" 
                                        checked={props.selectedMemberIds.has(member.id)} 
                                        onChange={() => props.onSelectMember(member.id)} 
                                        aria-label={`Välj ${member.name}`} 
                                    />
                                </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 flex-shrink-0">
                                        {member.photoURL ? (
                                            <img className="h-10 w-10 rounded-full object-cover border border-neutral-light" src={member.photoURL} alt="" />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-neutral-light flex items-center justify-center text-neutral-400">
                                                <UserIconLucide className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-bold text-neutral-dark group-hover:text-primary transition-colors">{member.name}</div>
                                        <div className="text-xs text-neutral">{member.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral">
                                <span className={`${!member.lastLogDate ? 'text-neutral-400 italic' : 'text-neutral-dark font-medium'}`}>
                                    {member.lastLogDate || 'Ingen aktivitet'}
                                </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-lg">🔥</span>
                                    <span className="text-sm font-bold text-neutral-dark">{member.currentStreak}</span>
                                </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-neutral-dark">{member.goalSummary}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                                {member.status === 'archived' ? (
                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full border bg-gray-100 text-gray-600 border-gray-200">Arkiverad</span>
                                ) : (
                                    <SubscriptionBadge status={member.subscriptionStatus} stripeCustomerId={member.stripeCustomerId} />
                                )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    {member.status === 'archived' ? (
                                        <ActionButton 
                                            onClick={() => props.onUnarchive(member.id)} 
                                            disabled={props.updatingMemberId === member.id}
                                            icon={<ArrowUturnLeftIcon className="w-4 h-4" />}
                                            label="Återaktivera"
                                            className="bg-neutral-light text-neutral-dark hover:bg-neutral-light/80"
                                        />
                                    ) : (
                                        <ActionButton 
                                            onClick={() => props.onArchive(member.id)} 
                                            disabled={props.updatingMemberId === member.id}
                                            icon={<ArchiveBoxIcon className="w-4 h-4" />}
                                            label="Arkivera"
                                            className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        />
                                    )}
                                    
                                    {member.status !== 'archived' && member.id !== props.currentUserId && (
                                        <ActionButton 
                                            onClick={() => props.onUpdateRole(member.id, member.role === 'coach' ? 'member' : 'coach')} 
                                            disabled={props.updatingMemberId === member.id}
                                            icon={member.role === 'coach' ? <UserIconLucide className="w-4 h-4" /> : <TrophyIcon className="w-4 h-4" />}
                                            label={member.role === 'coach' ? '-> Medlem' : '-> Coach'}
                                            className="bg-neutral-light text-neutral-dark hover:bg-gray-200"
                                        />
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);


// --- CUSTOM HOOK for State and Logic ---

const useCoachDashboard = (initialSortBy: SortableKeys = 'memberSince', initialSortOrder: 'asc' | 'desc' = 'desc') => {
    const [membersList, setMembersList] = useState<CoachViewMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [errorMembers, setErrorMembers] = useState<string | null>(null);
    const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
    
    // New filter status state
    const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'never_activated' | 'canceled' | 'archived'>('approved');
    
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<SortableKeys | null>(initialSortBy);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(20);

    useEffect(() => {
        setVisibleCount(20);
    }, [searchQuery, filterStatus, sortBy, sortOrder]);

    const fetchMembers = useCallback(async () => {
        setIsLoadingMembers(true);
        setErrorMembers(null);
        try {
            const fetchedMembers = await fetchCoachViewMembers();
            setMembersList(fetchedMembers);
        } catch (error) {
            console.error("Failed to fetch members:", error);
            setErrorMembers("Kunde inte ladda medlemslistan. Försök igen senare.");
        } finally {
            setIsLoadingMembers(false);
        }
    }, []);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);
    
    const handleAction = useCallback(async (action: Promise<void>, memberId: string | null = null, successMessage?: string) => {
        if (memberId) setUpdatingMemberId(memberId);
        try {
            await action;
            if(successMessage) alert(successMessage);
        } catch (error) {
            console.error("Action failed:", error);
            alert("Åtgärden misslyckades. Försök igen.");
        } finally {
            if (memberId) setUpdatingMemberId(null);
        }
    }, []);

    const handleArchiveMember = useCallback((memberId: string) => {
        handleAction(archiveMember(memberId), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, status: 'archived' } : m));
        });
    }, [handleAction]);

    const handleUnarchiveMember = useCallback((memberId: string) => {
        handleAction(unarchiveMember(memberId), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, status: 'approved' } : m));
        });
    }, [handleAction]);

    const handleUpdateRole = useCallback((memberId: string, newRole: UserRole) => {
        handleAction(updateUserRole(memberId, newRole), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
        });
    }, [handleAction]);

    const handleUpdateSubscriptionStatus = useCallback((memberId: string, newStatus: 'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive') => {
        handleAction(updateUserDocument(memberId, { subscriptionStatus: newStatus }), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, subscriptionStatus: newStatus } : m));
        });
    }, [handleAction]);

    const handleBulkAction = useCallback(async (action: 'setRoleCoach' | 'setRoleMember') => {
        const idsToUpdate = Array.from(selectedMemberIds) as string[];
        if (idsToUpdate.length === 0) return;
        setIsBulkUpdating(true);
        try {
            const actions = {
                'setRoleCoach': bulkUpdateUserRole(idsToUpdate, 'coach'),
                'setRoleMember': bulkUpdateUserRole(idsToUpdate, 'member')
            };
            await actions[action];
            await fetchMembers();
            setSelectedMemberIds(new Set());
            alert(`${idsToUpdate.length} medlemmar har uppdaterats.`);
        } catch (error) {
            console.error(`Bulk action '${action}' failed:`, error);
            alert(`Kunde inte utföra massuppdatering. Försök igen.`);
        } finally {
            setIsBulkUpdating(false);
        }
    }, [selectedMemberIds, fetchMembers]);

    const filteredMembers = useMemo(() => membersList.filter(member => {
        const searchMatches = searchQuery.trim() === '' || member.name.toLowerCase().includes(searchQuery.toLowerCase()) || member.email.toLowerCase().includes(searchQuery.toLowerCase());
        if (!searchMatches) return false;
        
        if (member.status === 'archived') {
            return filterStatus === 'all' || filterStatus === 'archived';
        }
        if (filterStatus === 'archived') {
            return false;
        }
        if (filterStatus === 'all') {
            return true;
        }
        
        const sub = member.subscriptionStatus;
        const hasStripeId = !!member.stripeCustomerId;
        
        let determinedStatus: 'active' | 'never_activated' | 'canceled';
        if (sub === 'active' || sub === 'trialing' || sub === 'canceling') {
            determinedStatus = 'active';
        } else if (sub === 'canceled' || hasStripeId) {
            determinedStatus = 'canceled';
        } else {
            determinedStatus = 'never_activated';
        }
        
        if (filterStatus === 'approved') return determinedStatus === 'active';
        if (filterStatus === 'never_activated') return determinedStatus === 'never_activated';
        if (filterStatus === 'canceled') return determinedStatus === 'canceled';
        
        return false;
    }), [membersList, filterStatus, searchQuery]);

    const sortedAndFilteredMembers = useMemo(() => {
        const sortable = [...filteredMembers];
        if (sortBy) {
            sortable.sort((a, b) => {
                const valA = a[sortBy], valB = b[sortBy];
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;
                if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
                if (sortBy === 'lastLogDate' || sortBy === 'memberSince') {
                    const dateA = valA === 'Aldrig' ? 0 : new Date(valA as string).getTime();
                    const dateB = valB === 'Aldrig' ? 0 : new Date(valB as string).getTime();
                    return dateA - dateB;
                }
                return String(valA).localeCompare(String(valB));
            });
        }
        if (sortOrder === 'desc') sortable.reverse();
        return sortable;
    }, [filteredMembers, sortBy, sortOrder]);
    
    return {
        membersList, isLoadingMembers, errorMembers, updatingMemberId, filterStatus, setFilterStatus,
        selectedMemberIds, setSelectedMemberIds, sortBy, setSortBy, sortOrder, setSortOrder, isBulkUpdating,
        searchQuery, setSearchQuery, fetchMembers, handleArchiveMember, handleUnarchiveMember,
        handleUpdateRole, handleUpdateSubscriptionStatus, handleBulkAction, sortedAndFilteredMembers,
        visibleCount, setVisibleCount
    };
};


// --- MAIN COMPONENT ---

interface CoachDashboardProps {
  onLogout: () => void;
  currentUserEmail: string;
  onToggleInterface: () => void;
  currentUserId: string;
  currentUser: User;
  userProfile: UserProfileData;
  userRole: UserRole;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const CoachDashboard: React.FC<CoachDashboardProps> = ({ onLogout, currentUserEmail, onToggleInterface, currentUserId, currentUser, userProfile, userRole, setToastNotification }) => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CoachViewMember | null>(null);
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'growth' | 'studio' | 'bootcamp' | 'editorial' | 'tests'>('members');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [myChats, setMyChats] = useState<Chat[]>([]);
  const [publicRooms, setPublicRooms] = useState<Chat[]>([]);
  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showAllGroupsModal, setShowAllGroupsModal] = useState(false);
  const [showCourseInsightsModal, setShowCourseInsightsModal] = useState(false);
  const [courseInsightsData, setCourseInsightsData] = useState<{
    isLoading: boolean;
    data: { courseId: string; courseName: string; participants: number; completions: number; averageProgress: number }[];
  }>({ isLoading: false, data: [] });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  const isTestingToolEnabled = isTestingToolAllowed();

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
              setShowProfileDropdown(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      const unsubscribeSystem = subscribeToSystemGroups((chats) => {
          setMyChats(chats);
      });
      const unsubscribePublic = subscribeToPublicRooms((chats) => {
          setPublicRooms(chats);
      });
      const unsubscribeAll = subscribeToAllChats((chats) => {
          setAllChats(chats);
      });
      return () => {
          unsubscribeSystem();
          unsubscribePublic();
          unsubscribeAll();
      };
  }, []);

  useEffect(() => {
      if (selectedChat) {
          const updatedChat = myChats.find(c => c.id === selectedChat.id);
          if (updatedChat && JSON.stringify(updatedChat) !== JSON.stringify(selectedChat)) {
              setSelectedChat(updatedChat);
          }
      }
  }, [myChats, selectedChat]);

  const {
      membersList, isLoadingMembers, errorMembers, updatingMemberId, filterStatus, setFilterStatus,
      selectedMemberIds, setSelectedMemberIds, sortBy, setSortBy, sortOrder, setSortOrder, isBulkUpdating,
      searchQuery, setSearchQuery, fetchMembers, handleArchiveMember, handleUnarchiveMember,
      handleUpdateRole, handleUpdateSubscriptionStatus, handleBulkAction, sortedAndFilteredMembers,
      visibleCount, setVisibleCount
  } = useCoachDashboard();
  
  const visibleMembers = sortedAndFilteredMembers.slice(0, visibleCount);
  
  const handleSort = (column: SortableKeys) => {
    if (sortBy === column) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(column); setSortOrder('asc'); }
  };

  const handleCourseInsightsClick = async () => {
    setShowCourseInsightsModal(true);
    setCourseInsightsData({ isLoading: true, data: [] });
    
    try {
        const { fetchCourseProgressForUser } = await import('../services/firestoreService');
        const { fetchAllBootcampParticipants } = await import('../services/bootcampService');
        const { ALL_COURSES } = await import('./CoursesView');
        const { courseLessons, menopauseCourseLessons } = await import('../courseData');
        
        const courseStats: Record<string, {
            courseId: string;
            courseName: string;
            participants: number;
            completions: number;
            totalProgress: number;
            totalLessons: number;
        }> = {};

        ALL_COURSES.forEach(c => {
            courseStats[c.id] = {
                courseId: c.id,
                courseName: c.title,
                participants: 0,
                completions: 0,
                totalProgress: 0,
                totalLessons: c.id === 'praktisk-viktkontroll' ? courseLessons.length : (c.id === 'maxa-klimakteriet' ? menopauseCourseLessons.length : 84) // 84 days for bootcamp
            };
        });
        
        const activeMembers = membersList.filter(m => 
            m.status === 'approved' && 
            m.role === 'member' && 
            (m.subscriptionStatus === 'active' || m.subscriptionStatus === 'trialing' || m.subscriptionStatus === 'canceling')
        );

        const dataPromises = activeMembers.map(async (member) => {
            const progress = await fetchCourseProgressForUser(member.id);
            
            // Check Praktisk Viktkontroll
            const pvLessons = Object.keys(progress).filter(k => k.startsWith('lektion'));
            if (pvLessons.length > 0) {
                const courseId = 'praktisk-viktkontroll';
                const completed = pvLessons.filter(k => progress[k].isCompleted).length;
                if (courseStats[courseId]) {
                    courseStats[courseId].participants++;
                    courseStats[courseId].totalProgress += (completed / courseStats[courseId].totalLessons);
                    if (completed === courseStats[courseId].totalLessons) {
                        courseStats[courseId].completions++;
                    }
                }
            }

            // Check Maxa Klimakteriet
            const mkLessons = Object.keys(progress).filter(k => k.startsWith('m-lektion'));
            if (mkLessons.length > 0) {
                const courseId = 'maxa-klimakteriet';
                const completed = mkLessons.filter(k => progress[k].isCompleted).length;
                if (courseStats[courseId]) {
                    courseStats[courseId].participants++;
                    courseStats[courseId].totalProgress += (completed / courseStats[courseId].totalLessons);
                    if (completed === courseStats[courseId].totalLessons) {
                        courseStats[courseId].completions++;
                    }
                }
            }
        });
        
        await Promise.all(dataPromises);

        // Fetch bootcamp participants
        const bootcampParticipants = await fetchAllBootcampParticipants();
        const bootcampCourseId = 'bootcamp';
        if (courseStats[bootcampCourseId]) {
            bootcampParticipants.forEach(p => {
                // Only count if they are in activeMembers
                if (activeMembers.some(m => m.id === p.userId)) {
                    courseStats[bootcampCourseId].participants++;
                    // Bootcamp progress could be based on currentStreak or just 0 for now
                    const progress = Math.min(p.currentStreak / courseStats[bootcampCourseId].totalLessons, 1);
                    courseStats[bootcampCourseId].totalProgress += progress;
                    if (p.status === 'completed' || p.currentStreak >= courseStats[bootcampCourseId].totalLessons) {
                        courseStats[bootcampCourseId].completions++;
                    }
                }
            });
        }
        
        const results = Object.values(courseStats)
            .map(c => ({
                courseId: c.courseId,
                courseName: c.courseName,
                participants: c.participants,
                completions: c.completions,
                averageProgress: c.participants > 0 ? (c.totalProgress / c.participants) * 100 : 0
            }));
        
        setCourseInsightsData({ isLoading: false, data: results });
    } catch (error) {
        console.error("Error fetching course insights:", error);
        setCourseInsightsData({ isLoading: false, data: [] });
        setToastNotification({ message: 'Kunde inte hämta kursdata', type: 'error' });
    }
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(memberId)) newSet.delete(memberId);
        else newSet.add(memberId);
        return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMemberIds(e.target.checked ? new Set(visibleMembers.map(m => m.id)) : new Set());
  };

  const handleShowMemberDetails = (member: CoachViewMember) => {
    setSelectedMember(member);
  };

  return (
    <>
    <div className="min-h-screen bg-neutral-light bg-fixed text-neutral-dark">
      <header className="w-full bg-white text-neutral-dark py-2 px-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('members')}>
                <img src="/favicon.png" alt="Kostloggen.se logo" className="h-14 w-14 object-contain" />
            </div>
            <div className="flex flex-wrap justify-end items-center gap-1">
                <div className="relative" ref={profileDropdownRef}>
                    <button
                        aria-label="Konto"
                        className={`nav-btn ${showProfileDropdown ? "active" : ""}`}
                        onClick={() => setShowProfileDropdown(prev => !prev)}
                    >
                         <div className="icon-wrap p-0 relative">
                            <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={40} />
                         </div>
                    </button>
                    {showProfileDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-neutral-light/70 p-2 z-50 animate-fade-slide-in">
                            <DropdownMenuItem
                                icon={<InformationCircleIcon />}
                                label="Information"
                                onClick={() => {
                                    setShowInfoModal(true);
                                    setShowProfileDropdown(false);
                                }}
                            />
                            
                            <div className="my-1 border-t border-neutral-light/70"></div>
                            
                            <DropdownMenuItem
                                icon={<SwitchHorizontalIcon />}
                                label="Medlemsvy"
                                onClick={onToggleInterface}
                                className="text-primary hover:bg-primary-light/40 font-medium"
                            />

                            <div className="my-1 border-t border-neutral-light/70"></div>
                            <DropdownMenuItem
                                icon={<ArrowRightOnRectangleIcon />}
                                label="Logga ut"
                                onClick={onLogout}
                                className="text-red-600 hover:bg-red-50"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {!selectedChat && !isCreatingGroup && (
            <div className="w-full mt-2">
                <div className="flex w-full border-b border-neutral-light">
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`flex-1 py-2 sm:py-3 px-1 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-base transition-colors ${activeTab === 'members' ? 'border-b-2 border-primary text-primary' : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-dark'}`}
                    >
                        <UsersIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Medlemsregister</span>
                        <span className="sm:hidden">Medlemmar</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('growth')}
                        className={`flex-1 py-2 sm:py-3 px-1 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-base transition-colors ${activeTab === 'growth' ? 'border-b-2 border-primary text-primary' : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-dark'}`}
                    >
                        <TrendingUp className="w-5 h-5" />
                        <span className="hidden sm:inline">Tillväxtmotor</span>
                        <span className="sm:hidden">Tillväxt</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('studio')}
                        className={`flex-1 py-2 sm:py-3 px-1 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-base transition-colors ${activeTab === 'studio' ? 'border-b-2 border-primary text-primary' : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-dark'}`}
                    >
                        <SparklesIcon className="w-5 h-5" />
                        <span>Studio</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('bootcamp')}
                        className={`flex-1 py-2 sm:py-3 px-1 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-base transition-colors ${activeTab === 'bootcamp' ? 'border-b-2 border-primary text-primary' : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-dark'}`}
                    >
                        <TrophyIcon className="w-5 h-5" />
                        <span>Bootcamp</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('editorial')}
                        className={`flex-1 py-2 sm:py-3 px-1 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-base transition-colors ${activeTab === 'editorial' ? 'border-b-2 border-primary text-primary' : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-dark'}`}
                    >
                        <SparklesIcon className="w-5 h-5" />
                        <span>Redaktionellt</span>
                    </button>
                    {isTestingToolEnabled && (
                        <button
                            onClick={() => setActiveTab('tests')}
                            className={`flex-1 py-2 sm:py-3 px-1 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-base transition-colors ${activeTab === 'tests' ? 'border-b-2 border-primary text-primary' : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-dark'}`}
                        >
                            <FlaskConical className="w-5 h-5 text-[#D96E4A]" />
                            <span>Testverktyg</span>
                        </button>
                    )}
                </div>
            </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {selectedChat ? (
            <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl shadow-soft-xl border border-neutral-light overflow-hidden h-[80vh]">
                <ChatWindow 
                    chat={selectedChat}
                    currentUser={currentUser}
                    userProfile={userProfile}
                    userRole={userRole}
                    onBack={() => setSelectedChat(null)}
                    setToastNotification={setToastNotification}
                    buddyDetails={membersList.map(m => ({ uid: m.id, name: m.name, photoURL: m.photoURL } as any))}
                />
            </div>
        ) : isCreatingGroup ? (
            <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl shadow-soft-xl border border-neutral-light overflow-hidden">
                <CreateGroupView 
                    currentUser={currentUser}
                    userProfile={userProfile}
                    onBack={() => setIsCreatingGroup(false)}
                    onGroupCreated={() => {
                        setIsCreatingGroup(false);
                        setToastNotification({ message: 'Grupp skapad!', type: 'success' });
                    }}
                    setToastNotification={setToastNotification}
                    buddyDetails={membersList.map(m => ({ uid: m.id, name: m.name, photoURL: m.photoURL } as any))}
                    defaultIsSystemGroup={true}
                    defaultIsPublic={true}
                    hideSystemGroupOption={true}
                />
            </div>
        ) : activeTab === 'growth' ? (
            <GrowthEngineView 
                membersList={membersList} 
                setToastNotification={setToastNotification} 
                currentUser={currentUser}
                userProfile={userProfile}
            />
        ) : activeTab === 'studio' ? (
            <CoachStudioView 
                currentUser={currentUser}
                setToastNotification={setToastNotification}
            />
        ) : activeTab === 'bootcamp' ? (
            <BootcampLedningscentral
                currentUser={currentUser}
                userProfile={userProfile}
                setToastNotification={setToastNotification}
                membersList={membersList}
                onMemberClick={(member) => setSelectedMember(member)}
            />
        ) : activeTab === 'editorial' ? (
            <EditorialPostsAdminView
                currentUser={currentUser}
                userRole={userRole}
                setToastNotification={setToastNotification}
            />
        ) : activeTab === 'tests' && isTestingToolEnabled ? (
            <div className="max-w-4xl mx-auto">
                <DevelopmentTestingTool 
                    userProfile={userProfile}
                />
            </div>
        ) : (
            <>
                <GroupInsights 
                    membersList={membersList} 
                    isExpanded={isInsightsExpanded} 
                    onToggle={() => setIsInsightsExpanded(prev => !prev)} 
                    systemGroupsCount={myChats.length} 
                    publicRoomsCount={publicRooms.length} 
                    allChatsCount={allChats.length}
                />
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button 
                        onClick={() => setShowAllGroupsModal(true)}
                        className="bg-white p-4 sm:p-6 rounded-3xl shadow-soft-xl border border-neutral-light flex flex-col items-center justify-center gap-3 hover:border-[#D96E4A] hover:bg-[#F6E2D9]/30 transition-all group focus:outline-none"
                    >
                        <div className="bg-[#F6E2D9] p-3 sm:p-4 rounded-full text-[#D96E4A] group-hover:scale-110 transition-transform duration-300">
                            <UsersIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        <span className="font-bold text-neutral-dark text-sm sm:text-base">Hantera Grupper</span>
                    </button>
                    <button 
                        onClick={handleCourseInsightsClick}
                        className="bg-white p-4 sm:p-6 rounded-3xl shadow-soft-xl border border-neutral-light flex flex-col items-center justify-center gap-3 hover:border-[#D96E4A] hover:bg-[#F6E2D9]/30 transition-all group focus:outline-none"
                    >
                        <div className="bg-[#F6E2D9] p-3 sm:p-4 rounded-full text-[#D96E4A] group-hover:scale-110 transition-transform duration-300">
                            <CourseIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        <span className="font-bold text-neutral-dark text-sm sm:text-base">Kursöversikt</span>
                    </button>
                </div>
                
                <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
                    <CreatePostWidget 
                        currentUser={currentUser} 
                        userProfile={userProfile} 
                        onPostCreated={() => {}} 
                        setToastNotification={setToastNotification} 
                        userRole={userRole}
                        isCoachDashboard={true}
                    />
                    <div className="bg-white p-4 rounded-3xl shadow-soft-xl border border-neutral-light">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-neutral-darker flex items-center gap-2">
                                <UsersIcon className="w-5 h-5 text-primary" />
                                Officiella Grupper
                            </h3>
                            <button 
                                onClick={() => setIsCreatingGroup(true)}
                                className="p-2 bg-primary-50 text-primary rounded-full hover:bg-primary-100 transition-colors"
                                title="Skapa ny grupp"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            </button>
                        </div>
                        {myChats.length > 0 ? (
                            <div className="space-y-3">
                                {myChats.map(chat => (
                                    <div 
                                        key={chat.id} 
                                        onClick={() => setSelectedChat(chat)}
                                        className="bg-gray-50 p-4 rounded-xl border border-neutral-light cursor-pointer hover:bg-primary-50 transition-colors flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-neutral-dark">{chat.name}</h4>
                                                {chat.pendingMembers && chat.pendingMembers.length > 0 && (
                                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                        {chat.pendingMembers.length} förfrågningar
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral mt-1.5 flex items-center gap-2 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <UsersIcon className="w-3.5 h-3.5" /> {chat.members.length} medlemmar
                                                </span>
                                            </p>
                                        </div>
                                        <ChevronUpIcon className="w-5 h-5 text-neutral transform rotate-90" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-gray-50 rounded-xl border border-neutral-light border-dashed">
                                <p className="text-neutral-500 text-sm mb-3">Inga officiella grupper skapade ännu.</p>
                                <button 
                                    onClick={() => setIsCreatingGroup(true)}
                                    className="text-primary font-medium text-sm hover:underline"
                                >
                                    Skapa din första grupp här
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-3xl shadow-soft-xl border border-neutral-light">
                    <MemberFilters 
                        searchQuery={searchQuery} 
                        onSearchChange={setSearchQuery} 
                        filterStatus={filterStatus}
                        onFilterStatusChange={setFilterStatus}
                        onRefresh={fetchMembers} 
                        isRefreshDisabled={isLoadingMembers || isBulkUpdating} 
                    />
                    
                    {selectedMemberIds.size > 0 && (
                        <BulkActionsBar 
                            selectedCount={selectedMemberIds.size} 
                            onClearSelection={() => setSelectedMemberIds(new Set())} 
                            onBulkAction={handleBulkAction} 
                            isBulkUpdating={isBulkUpdating} 
                        />
                    )}

                    {(isLoadingMembers || isBulkUpdating) && (
                        <div className="py-12">
                            <LoadingSpinner message={isBulkUpdating ? "Uppdaterar medlemmar..." : "Laddar medlemmar..."} color="primary" fullScreen={false} />
                        </div>
                    )}
                    
                    {errorMembers && !isLoadingMembers && (
                        <div className="text-center py-10 bg-red-50 rounded-2xl border border-red-100 my-4">
                            <p className="text-red-600 font-bold mb-2">Hoppsan!</p>
                            <p className="text-red-500 text-sm">{errorMembers}</p>
                            <button onClick={fetchMembers} className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm">Försök igen</button>
                        </div>
                    )}

                    {!isLoadingMembers && !isBulkUpdating && !errorMembers && (
                        sortedAndFilteredMembers.length > 0 ? (
                            <>
                                <MemberListTable 
                                    members={visibleMembers} 
                                    currentUserId={currentUserId} 
                                    selectedMemberIds={selectedMemberIds} 
                                    sortBy={sortBy} 
                                    sortOrder={sortOrder} 
                                    updatingMemberId={updatingMemberId} 
                                    onSelectAll={handleSelectAll} 
                                    onSelectMember={handleSelectMember} 
                                    onSort={handleSort} 
                                    onShowDetails={handleShowMemberDetails} 
                                    onArchive={handleArchiveMember}
                                    onUnarchive={handleUnarchiveMember}
                                    onUpdateRole={handleUpdateRole} 
                                />
                                {visibleCount < sortedAndFilteredMembers.length && (
                                    <div className="mt-6 flex justify-center">
                                        <button
                                            onClick={() => setVisibleCount(prev => prev + 20)}
                                            className="px-6 py-2.5 bg-white border border-neutral-light text-primary font-bold rounded-xl hover:bg-primary-50 transition-colors shadow-sm flex items-center gap-2"
                                        >
                                            Visa fler ({sortedAndFilteredMembers.length - visibleCount} kvar)
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-16 bg-neutral-light/30 rounded-2xl border border-dashed border-neutral-light">
                                <UserGroupIcon className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                                <p className="text-neutral-500 font-medium">Inga medlemmar matchade din sökning.</p>
                                {filterStatus !== 'all' && <button onClick={() => setFilterStatus('all')} className="mt-2 text-primary font-bold hover:underline text-sm">Visa alla medlemmar</button>}
                            </div>
                        )
                    )}
                </div>

                {(userRole === 'coach' || userRole === 'admin') && (
                    <OrphanCleanupCard setToastNotification={setToastNotification} />
                )}
            </>
        )}
      </main>

      {showInfoModal && (
        <div className="fixed inset-0 bg-neutral-dark/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowInfoModal(false)}>
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-50 p-2.5 rounded-full">
                            <InformationCircleIcon className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold text-neutral-dark">Om Dashboarden</h3>
                    </div>
                    <button onClick={() => setShowInfoModal(false)} className="p-2 text-neutral-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                        <XMarkIcon className="w-6 h-6" /> 
                    </button>
                </div>
                
                <div className="space-y-4 text-neutral-600 leading-relaxed">
                    <p>Välkommen till Admin Dashboard! Här har du full kontroll över ditt community.</p>
                    
                    <div className="bg-neutral-50 p-4 rounded-xl space-y-2 border border-neutral-100">
                        <div className="flex gap-3">
                            <ArchiveBoxIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-neutral-dark text-sm">Hantera medlemmar</p>
                                <p className="text-xs">Arkivera inaktiva medlemmar för att dölja dem från listan.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <ArchiveBoxIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-neutral-dark text-sm">Arkivera</p>
                                <p className="text-xs">Pausa medlemmars tillgång men behåll deras data.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <UserGroupIcon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-neutral-dark text-sm">Hantera roller</p>
                                <p className="text-xs">Befordra medlemmar till coacher eller tvärtom direkt i listan.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <SparklesIcon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-neutral-dark text-sm">Insikter</p>
                                <p className="text-xs">Se hur gruppen presterar med aggregerad data högst upp.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <button onClick={() => setShowInfoModal(false)} className="mt-8 w-full py-3.5 bg-neutral-dark text-white font-bold rounded-xl hover:bg-black transition-colors shadow-lg active:scale-95">
                    Fattar!
                </button>
            </div>
        </div>
      )}

      {showAllGroupsModal && (
        <div className="fixed inset-0 bg-neutral-dark/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowAllGroupsModal(false)}>
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#F6E2D9] p-2.5 rounded-full">
                            <UsersIcon className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold text-neutral-dark">Alla Grupper</h3>
                    </div>
                    <button onClick={() => setShowAllGroupsModal(false)} className="p-2 text-neutral-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                        <XMarkIcon className="w-6 h-6" /> 
                    </button>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                    <div className="divide-y divide-neutral-light/50">
                        {allChats.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0)).map(chat => (
                            <div key={chat.id} className="py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-neutral-dark text-lg">{chat.name}</h4>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${chat.isSystemGroup ? 'bg-primary-light text-primary-darker' : chat.type === 'public_room' ? 'bg-neutral-light text-neutral-dark' : 'bg-[#F6E2D9] text-[#D96E4A]'}`}>
                                            {chat.isSystemGroup ? 'Officiell' : chat.type === 'public_room' ? 'Publik' : 'Privat'}
                                        </span>
                                        {!chat.isSystemGroup && chat.requiresApproval && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F6E2D9] text-[#D96E4A]">
                                                Kräver godkännande
                                            </span>
                                        )}
                                        {!chat.isSystemGroup && !chat.requiresApproval && chat.type === 'public_room' && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-light text-neutral-dark">
                                                Öppen
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-neutral flex items-center gap-3 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <UsersIcon className="w-4 h-4" /> {chat.members?.length || 0} medlemmar
                                        </span>
                                        {!chat.isSystemGroup && (
                                            <span className="flex items-center gap-1">
                                                <span className="text-xs">👑</span> 
                                                Admin: {chat.admins?.map(adminId => membersList.find(m => m.id === adminId)?.name || 'Okänd').join(', ') || 'Ingen admin'}
                                            </span>
                                        )}
                                    </p>
                                    {chat.description && (
                                        <p className="text-sm text-neutral-500 mt-2 italic">"{chat.description}"</p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {allChats.length === 0 && (
                            <p className="text-center text-neutral-500 py-8">Inga grupper finns i systemet ännu.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {showCourseInsightsModal && (
        <div className="fixed inset-0 bg-neutral-dark/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowCourseInsightsModal(false)}>
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#F6E2D9] p-2.5 rounded-full">
                            <CourseIcon className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold text-neutral-dark">Kurs-engagemang</h3>
                    </div>
                    <button onClick={() => setShowCourseInsightsModal(false)} className="p-2 text-neutral-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                        <XMarkIcon className="w-6 h-6" /> 
                    </button>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                    {courseInsightsData.isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : courseInsightsData.data.length > 0 ? (
                        <div className="divide-y divide-neutral-light/50">
                            {courseInsightsData.data.map((course) => (
                                <div key={course.courseId} className="py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-neutral-dark text-lg mb-2">{course.courseName}</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Deltagare</p>
                                                <p className="font-semibold text-neutral-dark flex items-center gap-1">
                                                    <UsersIcon className="w-4 h-4 text-primary" />
                                                    {course.participants}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Slutfört</p>
                                                <p className="font-semibold text-neutral-dark flex items-center gap-1">
                                                    <CheckCircleIcon className="w-4 h-4 text-[#84A98C]" />
                                                    {course.completions}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Snitt-progress</p>
                                                <p className="font-semibold text-neutral-dark flex items-center gap-1">
                                                    <TrendingUp className="w-4 h-4 text-primary" />
                                                    {course.averageProgress.toFixed(0)}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-neutral-500 py-8">Inga medlemmar har startat en kurs ännu.</p>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
    <MemberDetailModal 
        member={selectedMember} 
        onClose={() => setSelectedMember(null)} 
        onUpdateSubscriptionStatus={handleUpdateSubscriptionStatus}
    />
    </>
  );
};

export default CoachDashboard;
