import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CoachViewMember, UserRole } from '../types';
import { UserGroupIcon, ArrowRightOnRectangleIcon, EyeIcon, InformationCircleIcon, XMarkIcon as CloseIcon, SwitchHorizontalIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, SearchIcon, CourseIcon, TrophyIcon, XCircleIcon, ProteinIcon, PersonIcon } from './icons';
import { User, PieChart } from 'lucide-react'; // Import new Lucide icons
import { playAudio } from '../services/audioService';
import { auth } from '../firebase';
import { getFunctions, httpsCallable } from "@firebase/functions";
import { 
    fetchCoachViewMembers, 
    setCourseAccessForMember, 
    approveMember,
    revokeApproval, 
    updateUserRole,
    bulkApproveMembers,
    bulkSetCourseAccess,
    bulkUpdateUserRole
} from '../services/firestoreService';
import LoadingSpinner from './LoadingSpinner';
import MemberDetailModal from './MemberDetailModal';

type SortableKeys = keyof CoachViewMember;

// --- HELPER & UI COMPONENTS ---

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  colorClass: string;
}> = ({ icon, title, value, subtitle, colorClass }) => (
  <div className="bg-white p-4 rounded-xl shadow-lg border border-neutral-light flex items-start space-x-4 h-full">
    <div className={`p-3 rounded-lg ${colorClass}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-neutral">{title}</p>
      <p className="text-2xl font-bold text-neutral-dark">{value}</p>
      {subtitle && <p className="text-xs text-neutral">{subtitle}</p>}
    </div>
  </div>
);

const GoalAdherenceBadge: React.FC<{ adherence?: CoachViewMember['goalAdherence'] }> = ({ adherence }) => {
  if (!adherence) {
    return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-500">N/A</span>;
  }
  let bgColor = 'bg-gray-200', textColor = 'text-gray-700', text = 'Okänd';
  switch (adherence) {
    case 'good': bgColor = 'bg-primary-100'; textColor = 'text-primary-darker'; text = 'Bra'; break;
    case 'average': bgColor = 'bg-yellow-100'; textColor = 'text-yellow-700'; text = 'Medel'; break;
    case 'poor': bgColor = 'bg-red-100'; textColor = 'text-red-700'; text = 'Låg'; break;
    case 'inactive': bgColor = 'bg-neutral-light'; textColor = 'text-neutral'; text = 'Inaktiv'; break;
  }
  return <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColor} ${textColor}`}>{text}</span>;
};

const StatusBadge: React.FC<{ status: 'pending' | 'approved' }> = ({ status }) => (
    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
      status === 'pending' ? 'bg-yellow-100 text-yellow-800 animate-pulse' : 'bg-primary-100 text-primary-darker'
    }`}>{status === 'pending' ? 'Väntar' : 'Godkänd'}</span>
);

const SortableHeader: React.FC<{ column: SortableKeys; label: string; tooltip?: string; sortBy: SortableKeys | null; sortOrder: 'asc' | 'desc'; onSort: (column: SortableKeys) => void; }> = ({ column, label, tooltip, sortBy, sortOrder, onSort }) => (
    <th scope="col" className="px-4 py-3.5 text-left text-xs sm:text-sm font-medium text-neutral-dark uppercase tracking-wider">
        <button onClick={() => onSort(column)} className="flex items-center gap-1 group">
            {label}
            {tooltip && <span className="relative" title={tooltip}><InformationCircleIcon className="w-4 h-4 text-neutral hover:text-primary transition-colors cursor-help" /></span>}
            <span className={`transition-opacity duration-150 ${sortBy === column ? 'opacity-100' : 'opacity-20 group-hover:opacity-100'}`}>
                {sortOrder === 'asc' && sortBy === column ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </span>
        </button>
    </th>
);

const BulkActionButton: React.FC<{ onClick: () => void; children: React.ReactNode, className?: string; disabled: boolean; }> = ({ onClick, children, className, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 text-xs font-medium rounded interactive-transition disabled:opacity-50 ${className}`}>{children}</button>
);

const GroupInsights: React.FC<{ membersList: CoachViewMember[]; isExpanded: boolean; onToggle: () => void; onManualSummary: () => void; isSummarizing: boolean; }> = ({ membersList, isExpanded, onToggle, onManualSummary, isSummarizing }) => {
    const groupInsights = useMemo(() => {
        const activeMembers = membersList.filter(m => m.status === 'approved' && m.role === 'member');
        const totalActiveCount = activeMembers.length;

        if (totalActiveCount === 0) return { totalActiveCount: 0, pendingCount: membersList.filter(m => m.status === 'pending').length, percentWithStreak: 0, averageStreak: 0, percentOnCourse: 0, averageCourseProgress: 0, averageWeeklyLoss: 0, recordWeeklyLoss: 0, averageAge: 0, maleCount: 0, femaleCount: 0, loseFatCount: 0, gainMuscleCount: 0, maintainCount: 0, proteinGoalMetPercentage7d: 0 };

        const membersWithStreak = activeMembers.filter(m => (m.currentStreak || 0) > 0);
        const percentWithStreak = (membersWithStreak.length / totalActiveCount) * 100;
        const averageStreak = activeMembers.reduce((sum, m) => sum + (m.currentStreak || 0), 0) / totalActiveCount;
        const membersOnCourse = activeMembers.filter(m => m.isCourseActive);
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
        const recordWeeklyLoss = membersWithWeightLoss.length > 0 ? Math.abs(Math.min(...membersWithWeightLoss.map(m => m.weeklyWeightChange!))) : 0;
        const membersWithAge = activeMembers.filter(m => m.ageYears && m.ageYears > 0);
        const averageAge = membersWithAge.length > 0 ? membersWithAge.reduce((sum, m) => sum + m.ageYears!, 0) / membersWithAge.length : 0;
        const maleCount = activeMembers.filter(m => m.gender === 'male').length;
        const femaleCount = activeMembers.filter(m => m.gender === 'female').length;
        const loseFatCount = activeMembers.filter(m => m.goalSummary?.includes('fett')).length;
        const gainMuscleCount = activeMembers.filter(m => m.goalSummary?.includes('muskler')).length;
        const maintainCount = activeMembers.filter(m => m.goalSummary === 'Bibehålla').length;
        const proteinGoalMetPercentage7d = activeMembers.reduce((sum, m) => sum + (m.proteinGoalMetPercentage7d || 0), 0) / totalActiveCount;

        return { totalActiveCount, pendingCount: membersList.filter(m => m.status === 'pending').length, percentWithStreak, averageStreak, percentOnCourse, averageCourseProgress, averageWeeklyLoss, recordWeeklyLoss, averageAge, maleCount, femaleCount, loseFatCount, gainMuscleCount, maintainCount, proteinGoalMetPercentage7d };
    }, [membersList]);

    return (
        <section className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-4">
                 <button onClick={onToggle} className="flex-1 flex justify-between items-center text-left group" aria-expanded={isExpanded} aria-controls="group-insights-panel">
                    <h2 className="text-2xl font-semibold text-neutral-dark group-hover:text-primary transition-colors">Insikter på gruppnivå</h2>
                    {isExpanded ? <ChevronUpIcon className="w-6 h-6 text-neutral" /> : <ChevronDownIcon className="w-6 h-6 text-neutral" />}
                </button>
                 <button 
                    onClick={onManualSummary} 
                    disabled={isSummarizing}
                    className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-secondary hover:bg-secondary-darker rounded-lg shadow-md active:scale-95 transform transition-all disabled:opacity-60 disabled:cursor-wait"
                    title="Kör en manuell summering av gårdagen för alla användare. Används om den automatiska processen misslyckats."
                 >
                    {isSummarizing ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                            Summerar...
                        </>
                    ) : (
                        "⚡ Summera Gårdagen Manuellt"
                    )}
                 </button>
            </div>
            {isExpanded && (
                <div id="group-insights-panel" className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                    <StatCard icon={<UserGroupIcon className="w-6 h-6 text-blue-800" />} title="Aktiva Medlemmar" value={groupInsights.totalActiveCount.toString()} colorClass="bg-blue-100" />
                    <StatCard icon={<CheckCircleIcon className="w-6 h-6 text-yellow-800" />} title="Väntar på godkännande" value={groupInsights.pendingCount.toString()} colorClass="bg-yellow-100" />
                    <StatCard icon={<PersonIcon className="w-6 h-6 text-teal-800" />} title="Snittålder" value={groupInsights.averageAge.toFixed(0)} subtitle={`${groupInsights.maleCount} M | ${groupInsights.femaleCount} K`} colorClass="bg-teal-100" />
                    <StatCard icon={<PieChart className="w-6 h-6 text-yellow-800" />} title="Mål: Fettminskning" value={groupInsights.loseFatCount.toString()} subtitle={`${groupInsights.gainMuscleCount} Muskel↑, ${groupInsights.maintainCount} Bibehåll`} colorClass="bg-yellow-100" />
                    <StatCard icon={<ProteinIcon className="w-6 h-6 text-indigo-800" />} title="Proteinuppfyllelse (7d)" value={`${groupInsights.proteinGoalMetPercentage7d.toFixed(0)}%`} subtitle="Genomsnitt för gruppen" colorClass="bg-indigo-100" />
                    <StatCard icon={<TrophyIcon className="w-6 h-6 text-secondary-darker" />} title="Streak-engagemang" value={`${groupInsights.percentWithStreak.toFixed(0)}%`} subtitle={`Snitt: ${groupInsights.averageStreak.toFixed(1)} dagar`} colorClass="bg-secondary-100" />
                    <StatCard icon={<CourseIcon className="w-6 h-6 text-primary-darker" />} title="Kurs-engagemang" value={`${groupInsights.percentOnCourse.toFixed(0)}%`} subtitle={`Snitt-slutförande: ${groupInsights.averageCourseProgress.toFixed(0)}%`} colorClass="bg-primary-100" />
                    <StatCard icon={<User className="w-6 h-6 text-primary-darker" />} title="Snitt-viktnedgång (7d)" value={`${groupInsights.averageWeeklyLoss.toFixed(1)} kg`} subtitle="Av medlemmar med minskning" colorClass="bg-primary-100" />
                    <StatCard icon={<TrophyIcon className="w-6 h-6 text-purple-800" />} title="Rekord-minskning (7d)" value={`${groupInsights.recordWeeklyLoss.toFixed(1)} kg`} colorClass="bg-purple-100" />
                </div>
            )}
        </section>
    );
};

const MemberFilters: React.FC<{
    searchQuery: string; onSearchChange: (q: string) => void;
    showOnlyPending: boolean; onPendingChange: (v: boolean) => void; pendingCount: number;
    showOnlyInterest: boolean; onInterestChange: (v: boolean) => void; interestCount: number;
    onRefresh: () => void; isRefreshDisabled: boolean;
}> = ({ searchQuery, onSearchChange, showOnlyPending, onPendingChange, pendingCount, showOnlyInterest, onInterestChange, interestCount, onRefresh, isRefreshDisabled }) => (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-neutral-dark mb-3 sm:mb-0">Medlemsöversikt</h2>
        <div className="flex items-center flex-wrap gap-4">
            <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="w-5 h-5 text-gray-400" /></div><input type="text" placeholder="Sök på namn/e-post..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} className="w-full sm:w-auto pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary transition" aria-label="Sök medlemmar" /></div>
            <label htmlFor="pendingFilter" className="flex items-center cursor-pointer"><input type="checkbox" id="pendingFilter" checked={showOnlyPending} onChange={() => onPendingChange(!showOnlyPending)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /><span className="ml-2 text-sm font-medium text-neutral-dark">Visa bara väntande ({pendingCount})</span></label>
            <label htmlFor="interestFilter" className="flex items-center cursor-pointer"><input type="checkbox" id="interestFilter" checked={showOnlyInterest} onChange={() => onInterestChange(!showOnlyInterest)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /><span className="ml-2 text-sm font-medium text-neutral-dark">Visa intresse ({interestCount})</span></label>
            <button onClick={onRefresh} className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary-100/50 active:scale-95 transition-colors" disabled={isRefreshDisabled}>{isRefreshDisabled ? 'Laddar...' : 'Uppdatera'}</button>
        </div>
    </div>
);

const BulkActionsBar: React.FC<{
    selectedCount: number;
    onClearSelection: () => void;
    onBulkAction: (action: 'approve' | 'activateCourse' | 'deactivateCourse' | 'setRoleCoach' | 'setRoleMember') => void;
    isBulkUpdating: boolean;
}> = ({ selectedCount, onClearSelection, onBulkAction, isBulkUpdating }) => (
    <div className="bg-primary-100 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-[88px] z-30 mb-4 animate-fade-in shadow-md">
        <span className="font-semibold text-primary-darker">{selectedCount} medlemmar valda</span>
        <div className="flex items-center gap-2 flex-wrap justify-center">
            <BulkActionButton onClick={() => onBulkAction('approve')} disabled={isBulkUpdating} className="bg-primary-200 text-primary-darker hover:bg-primary-lighter">Godkänn</BulkActionButton>
            <BulkActionButton onClick={() => onBulkAction('activateCourse')} disabled={isBulkUpdating} className="bg-blue-200 text-blue-800 hover:bg-blue-300">Aktivera Kurs</BulkActionButton>
            <BulkActionButton onClick={() => onBulkAction('deactivateCourse')} disabled={isBulkUpdating} className="bg-red-200 text-red-800 hover:bg-red-300">Avaktivera Kurs</BulkActionButton>
            <BulkActionButton onClick={() => onBulkAction('setRoleCoach')} disabled={isBulkUpdating} className="bg-purple-200 text-purple-800 hover:bg-purple-300">Gör till Coach</BulkActionButton>
            <BulkActionButton onClick={() => onBulkAction('setRoleMember')} disabled={isBulkUpdating} className="bg-yellow-200 text-yellow-800 hover:bg-yellow-300">Gör till Medlem</BulkActionButton>
        </div>
        <button onClick={onClearSelection} className="text-sm text-neutral hover:underline">Rensa val</button>
    </div>
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
    onApprove: (id: string) => void;
    onRevoke: (id: string) => void;
    onToggleCourse: (id: string, currentStatus: boolean) => void;
    onUpdateRole: (id: string, newRole: UserRole) => void;
}> = (props) => (
    <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-neutral-light/70">
                <tr>
                    <th scope="col" className="px-4 py-3.5"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" onChange={props.onSelectAll} checked={props.members.length > 0 && props.selectedMemberIds.size === props.members.length} aria-label="Välj alla medlemmar" /></th>
                    <SortableHeader column="name" label="Medlem" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                    <SortableHeader column="lastLogDate" label="Senaste Logg" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                    <SortableHeader column="currentStreak" label="Streak" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                    <SortableHeader column="goalSummary" label="Mål" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                    <SortableHeader column="numberOfBuddies" label="Kompisar" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                    <SortableHeader column="status" label="Status" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                    <SortableHeader column="isCourseActive" label="Kurs" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                    <th scope="col" className="px-4 py-3.5 text-left text-xs sm:text-sm font-medium text-neutral-dark uppercase tracking-wider">Åtgärder</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {props.members.map((member) => (
                    <tr key={member.id} className={`transition-colors ${props.selectedMemberIds.has(member.id) ? 'bg-primary-100/50' : 'hover:bg-neutral-light/50'}`}>
                        <td className="px-4 py-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" checked={props.selectedMemberIds.has(member.id)} onChange={() => props.onSelectMember(member.id)} aria-label={`Välj ${member.name}`} /></td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-neutral-dark"><div>{member.name}</div><div className="text-xs text-neutral">{member.email}</div></td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral">{member.lastLogDate || 'Aldrig'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral text-center">{member.currentStreak}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral">{member.goalSummary}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral text-center">{member.numberOfBuddies ?? 0}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral"><StatusBadge status={member.status} /></td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">{member.isCourseActive ? <CheckCircleIcon className="w-5 h-5 text-primary mx-auto" title="Kursen är aktiv" /> : <span className="text-neutral">-</span>}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center flex-wrap gap-2">
                                <button onClick={() => props.onShowDetails(member)} className="text-primary hover:text-primary-darker hover:underline flex items-center" aria-label={`Visa detaljer för ${member.name}`}><EyeIcon className="w-4 h-4 mr-1" /> Visa</button>
                                {member.status === 'pending' ? (<button onClick={() => props.onApprove(member.id)} disabled={props.updatingMemberId === member.id} className="px-2 py-1 text-xs font-medium rounded interactive-transition disabled:opacity-50 bg-primary-100 text-primary-darker hover:bg-primary-200 flex items-center"><CheckCircleIcon className="w-4 h-4 mr-1"/> Godkänn</button>) : (<button onClick={() => props.onRevoke(member.id)} disabled={props.updatingMemberId === member.id} className="px-2 py-1 text-xs font-medium rounded interactive-transition disabled:opacity-50 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 flex items-center"><XCircleIcon className="w-4 h-4 mr-1"/> Dra tillbaka</button>)}
                                {member.courseInterest && !member.isCourseActive && <span title="Medlemmen vill aktivera kursen" className="text-yellow-500 animate-pulse text-lg font-bold">💲</span>}
                                <button onClick={() => props.onToggleCourse(member.id, member.isCourseActive || false)} disabled={props.updatingMemberId === member.id} className={`px-2 py-1 text-xs font-medium rounded interactive-transition disabled:opacity-50 ${member.isCourseActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'} ${member.courseInterest && !member.isCourseActive ? 'ring-2 ring-yellow-400 font-bold' : ''}`}>{props.updatingMemberId === member.id ? 'Sparar...' : (member.isCourseActive ? 'Avaktivera Kurs' : 'Aktivera Kurs')}</button>
                                {member.status === 'approved' && member.id !== props.currentUserId && (<button onClick={() => props.onUpdateRole(member.id, member.role === 'coach' ? 'member' : 'coach')} disabled={props.updatingMemberId === member.id} className={`px-2 py-1 text-xs font-medium rounded interactive-transition disabled:opacity-50 ${member.role === 'coach' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}`}>{props.updatingMemberId === member.id ? 'Sparar...' : (member.role === 'coach' ? 'Degradera' : 'Befordra')}</button>)}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);


// --- CUSTOM HOOK for State and Logic ---

const useCoachDashboard = (initialSortBy: SortableKeys = 'memberSince', initialSortOrder: 'asc' | 'desc' = 'desc') => {
    const [membersList, setMembersList] = useState<CoachViewMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [errorMembers, setErrorMembers] = useState<string | null>(null);
    const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
    const [showOnlyPending, setShowOnlyPending] = useState(false);
    const [showOnlyInterest, setShowOnlyInterest] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<SortableKeys | null>(initialSortBy);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);


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

    const handleToggleCourseAccess = useCallback((memberId: string, currentStatus: boolean) => {
        handleAction(setCourseAccessForMember(memberId, !currentStatus), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, isCourseActive: !currentStatus, courseInterest: false } : m));
        });
    }, [handleAction]);

    const handleApproveMember = useCallback((memberId: string) => {
        handleAction(approveMember(memberId), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, status: 'approved' } : m));
        });
    }, [handleAction]);

    const handleRevokeApproval = useCallback((memberId: string) => {
        handleAction(revokeApproval(memberId), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, status: 'pending' } : m));
        });
    }, [handleAction]);

    const handleUpdateRole = useCallback((memberId: string, newRole: UserRole) => {
        handleAction(updateUserRole(memberId, newRole), memberId).then(() => {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
        });
    }, [handleAction]);

    const handleBulkAction = useCallback(async (action: 'approve' | 'activateCourse' | 'deactivateCourse' | 'setRoleCoach' | 'setRoleMember') => {
        const idsToUpdate = Array.from(selectedMemberIds);
        if (idsToUpdate.length === 0) return;
        setIsBulkUpdating(true);
        try {
            const actions = {
                'approve': bulkApproveMembers(idsToUpdate),
                'activateCourse': bulkSetCourseAccess(idsToUpdate, true),
                'deactivateCourse': bulkSetCourseAccess(idsToUpdate, false),
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
    
    const handleManualSummary = async () => {
        playAudio('uiClick');
        if (!window.confirm("Är du säker på att du vill köra en manuell summering av gårdagen för ALLA användare? Detta kan inte ångras och kan ta en stund.")) {
            return;
        }
        setIsSummarizing(true);
        try {
            const functions = getFunctions();
            const manualSummarize = httpsCallable(functions, 'manualSummarizeYesterday');
            const result = await manualSummarize({});
            const data = result.data as { success: boolean; message: string };
            alert(data.message || "Summering slutförd!");
        } catch (error) {
            console.error("Manual summary failed:", error);
            const err = error as any;
            let errorMessage = "Ett okänt fel uppstod vid anrop.";
            if (err.code === 'internal') {
                errorMessage = "Summeringen misslyckades på servern (internal error). Detta kan bero på hög belastning eller ett timeout-fel. Försök igen om en stund.";
            } else if (err.message) {
                errorMessage = err.message;
            }
            alert(`Ett fel uppstod: ${errorMessage}`);
        } finally {
            setIsSummarizing(false);
        }
    };


    const filteredMembers = useMemo(() => membersList.filter(member => {
        const searchMatches = searchQuery.trim() === '' || member.name.toLowerCase().includes(searchQuery.toLowerCase()) || member.email.toLowerCase().includes(searchQuery.toLowerCase());
        if (!searchMatches) return false;
        if (!showOnlyPending && !showOnlyInterest) return true;
        const isPending = showOnlyPending && member.status === 'pending';
        const hasInterest = showOnlyInterest && member.courseInterest && !member.isCourseActive;
        return isPending || hasInterest;
    }), [membersList, showOnlyPending, showOnlyInterest, searchQuery]);

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
    
    const pendingCount = useMemo(() => membersList.filter(m => m.status === 'pending').length, [membersList]);
    const interestCount = useMemo(() => membersList.filter(m => m.courseInterest && !m.isCourseActive).length, [membersList]);

    return {
        membersList, isLoadingMembers, errorMembers, updatingMemberId, showOnlyPending, setShowOnlyPending, showOnlyInterest, setShowOnlyInterest, selectedMemberIds, setSelectedMemberIds, sortBy, setSortBy, sortOrder, setSortOrder, isBulkUpdating, searchQuery, setSearchQuery, fetchMembers, handleToggleCourseAccess, handleApproveMember, handleRevokeApproval, handleUpdateRole, handleBulkAction, handleManualSummary, isSummarizing, sortedAndFilteredMembers, pendingCount, interestCount
    };
};


// --- MAIN COMPONENT ---

interface CoachDashboardProps {
  onLogout: () => void;
  currentUserEmail: string;
  onToggleInterface: () => void;
  currentUserId: string;
}

const CoachDashboard: React.FC<CoachDashboardProps> = ({ onLogout, currentUserEmail, onToggleInterface, currentUserId }) => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CoachViewMember | null>(null);
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(true);

  const {
      membersList, isLoadingMembers, errorMembers, updatingMemberId, showOnlyPending, setShowOnlyPending, showOnlyInterest,
      setShowOnlyInterest, selectedMemberIds, setSelectedMemberIds, sortBy, setSortBy, sortOrder, setSortOrder, isBulkUpdating,
      searchQuery, setSearchQuery, fetchMembers, handleToggleCourseAccess, handleApproveMember, handleRevokeApproval,
      handleUpdateRole, handleBulkAction, handleManualSummary, isSummarizing, sortedAndFilteredMembers, pendingCount, interestCount
  } = useCoachDashboard();
  
  const handleSort = (column: SortableKeys) => {
    playAudio('uiClick', 0.6);
    if (sortBy === column) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(column); setSortOrder('asc'); }
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
    setSelectedMemberIds(e.target.checked ? new Set(sortedAndFilteredMembers.map(m => m.id)) : new Set());
  };

  const handleShowMemberDetails = (member: CoachViewMember) => {
    playAudio('uiClick');
    setSelectedMember(member);
  };

  return (
    <>
    <div className="min-h-screen bg-neutral-light text-neutral-dark">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
          <div className="flex items-center"><UserGroupIcon className="w-10 h-10 text-primary mr-3" /><h1 className="text-4xl sm:text-5xl font-bold text-neutral-dark">Admin Dashboard</h1></div>
          <nav className="flex items-center space-x-3">
            <button onClick={() => setShowInfoModal(true)} className="flex items-center text-sm xs:text-base sm:text-lg px-4 py-3 sm:px-5 sm:py-3 bg-neutral-light hover:bg-gray-200 text-neutral-dark font-medium rounded-lg shadow-sm active:scale-95 transform transition-all" aria-label="Information om Admin Dashboard"><InformationCircleIcon className="w-5 h-5 mr-1 sm:mr-1.5" /> Info</button>
            <button onClick={onToggleInterface} className="flex items-center text-sm xs:text-base sm:text-lg px-4 py-3 sm:px-5 sm:py-3 bg-neutral-light hover:bg-gray-200 text-neutral-dark font-medium rounded-lg shadow-sm active:scale-95 transform transition-all" aria-label="Växla till Medlemsvy" title="Växla till Medlemsvy"><SwitchHorizontalIcon className="w-5 h-5 mr-1 sm:mr-1.5" /> Till Medlemsvy</button>
            <button onClick={onLogout} className="flex items-center text-sm xs:text-base sm:text-lg px-4 py-3 sm:px-5 sm:py-3 bg-secondary hover:bg-secondary-darker text-white font-medium rounded-lg shadow-sm active:scale-95 transform transition-all" aria-label="Logga ut"><ArrowRightOnRectangleIcon className="w-5 h-5 mr-1 sm:mr-1.5" /> Logga ut ({currentUserEmail.split('@')[0]})</button>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <GroupInsights membersList={membersList} isExpanded={isInsightsExpanded} onToggle={() => setIsInsightsExpanded(prev => !prev)} onManualSummary={handleManualSummary} isSummarizing={isSummarizing} />
        <section className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
          <MemberFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} showOnlyPending={showOnlyPending} onPendingChange={setShowOnlyPending} pendingCount={pendingCount} showOnlyInterest={showOnlyInterest} onInterestChange={setShowOnlyInterest} interestCount={interestCount} onRefresh={fetchMembers} isRefreshDisabled={isLoadingMembers || isBulkUpdating} />
          {selectedMemberIds.size > 0 && <BulkActionsBar selectedCount={selectedMemberIds.size} onClearSelection={() => setSelectedMemberIds(new Set())} onBulkAction={handleBulkAction} isBulkUpdating={isBulkUpdating} />}
          {(isLoadingMembers || isBulkUpdating) && <LoadingSpinner message={isBulkUpdating ? "Uppdaterar medlemmar..." : "Laddar medlemmar..."} />}
          {errorMembers && !isLoadingMembers && <div className="text-center py-6"><p className="text-red-600 font-medium">{errorMembers}</p></div>}
          {!isLoadingMembers && !isBulkUpdating && !errorMembers && (
            sortedAndFilteredMembers.length > 0 ? (
                <MemberListTable members={sortedAndFilteredMembers} currentUserId={currentUserId} selectedMemberIds={selectedMemberIds} sortBy={sortBy} sortOrder={sortOrder} updatingMemberId={updatingMemberId} onSelectAll={handleSelectAll} onSelectMember={handleSelectMember} onSort={handleSort} onShowDetails={handleShowMemberDetails} onApprove={handleApproveMember} onRevoke={handleRevokeApproval} onToggleCourse={handleToggleCourseAccess} onUpdateRole={handleUpdateRole} />
            ) : (<p className="text-center text-neutral py-6">Inga medlemmar att visa baserat på ditt filter.</p>)
          )}
        </section>
      </main>
      <footer className="text-center py-8 text-neutral-dark"><p>@ 2025 Flexibel Hälsostudio. Alla rättigheter förbehållna.</p></footer>
      {showInfoModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowInfoModal(false)} role="dialog" aria-modal="true" aria-labelledby="coach-info-modal-title"><div className="bg-white p-6 rounded-lg shadow-soft-xl w-full max-w-lg animate-scale-in max-h-[80vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 id="coach-info-modal-title" className="text-xl font-semibold text-neutral-dark flex items-center"><InformationCircleIcon className="w-6 h-6 mr-2 text-primary" /> Om Admin Dashboard</h3><button onClick={() => setShowInfoModal(false)} className="p-1.5 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90" aria-label="Stäng information"><CloseIcon className="w-5 h-5" /> </button></div><p className="text-neutral-dark mb-3">Välkommen till Admin Dashboard! Detta är din centrala plats för att få en översikt över dina medlemmars framsteg och engagemang.</p><ul className="list-disc list-inside space-y-1.5 text-neutral-dark text-sm mb-4"><li><strong>Godkänn medlemmar:</strong> Nya användare markeras som 'Väntar'. Använd 'Godkänn'-knappen för att ge dem full tillgång.</li><li><strong>Medlemsöversikt:</strong> Se en lista över alla dina medlemmar med nyckelinformation som status, senaste aktivitet och kursframsteg.</li><li><strong>Aktivera kurs:</strong> Ge eller ta bort tillgång till kursen "Praktisk Viktkontroll" för enskilda medlemmar.</li><li><strong>AI-Insikter (Kommande):</strong> Inom kort kommer du här att kunna få automatiska, AI-drivna insikter och sammanfattningar.</li></ul><p className="text-neutral-dark text-sm">Syftet med denna dashboard är att ge dig de verktyg du behöver för att effektivt kunna coacha dina medlemmar mot deras hälsomål.</p><button onClick={() => setShowInfoModal(false)} className="mt-5 w-full px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary">Jag förstår</button></div></div>}
    </div>
    <MemberDetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />
    </>
  );
};

export default CoachDashboard;