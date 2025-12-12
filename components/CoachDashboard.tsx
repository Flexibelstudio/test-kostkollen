
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CoachViewMember, UserRole } from '../types';
import { UserGroupIcon, ArrowRightOnRectangleIcon, EyeIcon, InformationCircleIcon, XMarkIcon, SwitchHorizontalIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, SearchIcon, CourseIcon, TrophyIcon, XCircleIcon, ProteinIcon, PersonIcon, SparklesIcon } from './icons';
import { User, PieChart, TrendingDown } from 'lucide-react';
import { playAudio } from '../services/audioService';
import { 
    fetchCoachViewMembers, 
    approveMember,
    revokeApproval, 
    updateUserRole,
    bulkApproveMembers,
    bulkUpdateUserRole
} from '../services/firestoreService';
import LoadingSpinner from './LoadingSpinner';
import MemberDetailModal from './MemberDetailModal';

type SortableKeys = keyof CoachViewMember;

// --- UI COMPONENTS ---

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  colorClass: string;
  textClass: string;
}> = ({ icon, title, value, subtitle, colorClass, textClass }) => (
  <div className="bg-white p-5 rounded-2xl shadow-soft-lg border border-neutral-light flex items-start space-x-4 transition-transform hover:scale-[1.02] duration-300 cursor-default">
    <div className={`p-3.5 rounded-xl ${colorClass} flex items-center justify-center shadow-sm`}>
      {React.cloneElement(icon as React.ReactElement<any>, { className: `w-6 h-6 ${textClass}` })}
    </div>
    <div>
      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-0.5">{title}</p>
      <p className="text-2xl font-extrabold text-neutral-dark leading-tight">{value}</p>
      {subtitle && <p className="text-xs text-neutral font-medium mt-1">{subtitle}</p>}
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: 'pending' | 'approved' }> = ({ status }) => (
    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${
      status === 'pending' 
        ? 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse' 
        : 'bg-green-50 text-green-700 border-green-200'
    }`}>
        {status === 'pending' ? 'Väntar' : 'Godkänd'}
    </span>
);

const SortableHeader: React.FC<{ column: SortableKeys; label: string; tooltip?: string; sortBy: SortableKeys | null; sortOrder: 'asc' | 'desc'; onSort: (column: SortableKeys) => void; }> = ({ column, label, tooltip, sortBy, sortOrder, onSort }) => (
    <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider bg-gray-50/80 sticky top-0 backdrop-blur-md z-10 border-b border-gray-100">
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

const GroupInsights: React.FC<{ membersList: CoachViewMember[]; isExpanded: boolean; onToggle: () => void }> = ({ membersList, isExpanded, onToggle }) => {
    const groupInsights = useMemo(() => {
        const activeMembers = membersList.filter(m => m.status === 'approved' && m.role === 'member');
        const totalActiveCount = activeMembers.length;

        if (totalActiveCount === 0) return { totalActiveCount: 0, pendingCount: membersList.filter(m => m.status === 'pending').length, percentWithStreak: 0, averageStreak: 0, percentOnCourse: 0, averageCourseProgress: 0, averageWeeklyLoss: 0, recordWeeklyLoss: 0, averageAge: 0, maleCount: 0, femaleCount: 0, loseFatCount: 0, gainMuscleCount: 0, maintainCount: 0, proteinGoalMetPercentage7d: 0 };

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
        const proteinGoalMetPercentage7d = activeMembers.reduce((sum, m) => sum + (m.proteinGoalMetPercentage7d || 0), 0) / totalActiveCount;

        return { totalActiveCount, pendingCount: membersList.filter(m => m.status === 'pending').length, percentWithStreak, averageStreak, percentOnCourse, averageCourseProgress, averageWeeklyLoss, recordWeeklyLoss, averageAge, maleCount, femaleCount, loseFatCount, gainMuscleCount, maintainCount, proteinGoalMetPercentage7d };
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
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6 transition-all duration-500 ease-in-out ${isExpanded ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden mt-0'}`}
            >
                <StatCard icon={<UserGroupIcon />} title="Aktiva Medlemmar" value={groupInsights.totalActiveCount.toString()} colorClass="bg-blue-100" textClass="text-blue-600" />
                <StatCard icon={<CheckCircleIcon />} title="Väntar godkännande" value={groupInsights.pendingCount.toString()} colorClass="bg-yellow-100" textClass="text-yellow-600" />
                <StatCard icon={<PersonIcon />} title="Snittålder" value={groupInsights.averageAge.toFixed(0)} subtitle={`${groupInsights.maleCount} M | ${groupInsights.femaleCount} K`} colorClass="bg-teal-100" textClass="text-teal-600" />
                <StatCard icon={<TrendingDown />} title="Mål: Fettminskning" value={groupInsights.loseFatCount.toString()} subtitle={`${groupInsights.gainMuscleCount} Muskel↑, ${groupInsights.maintainCount} Bibehåll`} colorClass="bg-red-100" textClass="text-red-600" />
                <StatCard icon={<ProteinIcon />} title="Proteinmål (7d)" value={`${groupInsights.proteinGoalMetPercentage7d.toFixed(0)}%`} subtitle="Genomsnittlig uppfyllnad" colorClass="bg-indigo-100" textClass="text-indigo-600" />
                <StatCard icon={<TrophyIcon />} title="Streak-engagemang" value={`${groupInsights.percentWithStreak.toFixed(0)}%`} subtitle={`Snitt: ${groupInsights.averageStreak.toFixed(1)} dagar`} colorClass="bg-orange-100" textClass="text-orange-600" />
                <StatCard icon={<CourseIcon />} title="Kurs-engagemang" value={`${groupInsights.percentOnCourse.toFixed(0)}%`} subtitle={`Snitt-slutförande: ${groupInsights.averageCourseProgress.toFixed(0)}%`} colorClass="bg-purple-100" textClass="text-purple-600" />
                <StatCard icon={<User />} title="Snitt-viktnedgång (7d)" value={`${groupInsights.averageWeeklyLoss.toFixed(1)} kg`} subtitle="Av de med minskning" colorClass="bg-green-100" textClass="text-green-600" />
            </div>
        </section>
    );
};

const MemberFilters: React.FC<{
    searchQuery: string; onSearchChange: (q: string) => void;
    showOnlyPending: boolean; onPendingChange: (v: boolean) => void; pendingCount: number;
    onRefresh: () => void; isRefreshDisabled: boolean;
}> = ({ searchQuery, onSearchChange, showOnlyPending, onPendingChange, pendingCount, onRefresh, isRefreshDisabled }) => (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-neutral-dark self-start md:self-center">Medlemslista</h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                </div>
                <input 
                    type="text" 
                    placeholder="Sök namn/e-post..." 
                    value={searchQuery} 
                    onChange={(e) => onSearchChange(e.target.value)} 
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-light/50 border border-neutral-light rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" 
                    aria-label="Sök medlemmar" 
                />
            </div>

            {/* Filter Toggle */}
            <button 
                onClick={() => onPendingChange(!showOnlyPending)}
                className={`flex items-center px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${showOnlyPending ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white border-neutral-light text-neutral-dark hover:bg-gray-50'}`}
            >
                {showOnlyPending ? <CheckCircleIcon className="w-5 h-5 mr-2" /> : <div className="w-5 h-5 mr-2 border-2 border-gray-300 rounded-full"></div>}
                Väntande ({pendingCount})
            </button>

            {/* Refresh Button */}
            <button 
                onClick={onRefresh} 
                className="p-2.5 text-primary bg-white border border-neutral-light rounded-xl hover:bg-primary-50 hover:border-primary/30 active:scale-95 transition-all disabled:opacity-50" 
                disabled={isRefreshDisabled}
                title="Uppdatera lista"
            >
                <SwitchHorizontalIcon className={`w-5 h-5 ${isRefreshDisabled ? 'animate-spin' : ''}`} />
            </button>
        </div>
    </div>
);

const BulkActionsBar: React.FC<{
    selectedCount: number;
    onClearSelection: () => void;
    onBulkAction: (action: 'approve' | 'setRoleCoach' | 'setRoleMember') => void;
    isBulkUpdating: boolean;
}> = ({ selectedCount, onClearSelection, onBulkAction, isBulkUpdating }) => (
    <div className="bg-primary-darker text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-[80px] z-30 mb-6 animate-slide-up-fade-in shadow-xl">
        <div className="flex items-center gap-3">
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{selectedCount} valda</span>
            <button onClick={onClearSelection} className="text-sm text-white/80 hover:text-white hover:underline">Avbryt</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
            <BulkActionButton onClick={() => onBulkAction('approve')} disabled={isBulkUpdating} className="bg-white text-primary-darker hover:bg-gray-100">Godkänn</BulkActionButton>
            <BulkActionButton onClick={() => onBulkAction('setRoleCoach')} disabled={isBulkUpdating} className="bg-purple-600 text-white hover:bg-purple-700 border border-purple-500">Till Coach</BulkActionButton>
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
    onApprove: (id: string) => void;
    onRevoke: (id: string) => void;
    onUpdateRole: (id: string, newRole: UserRole) => void;
}> = (props) => (
    <div className="bg-white rounded-3xl shadow-soft-xl border border-neutral-light overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-100">
                <thead>
                    <tr>
                        <th scope="col" className="px-4 py-4 bg-gray-50/80 w-12 sticky top-0 z-10 border-b border-gray-100 backdrop-blur-sm">
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
                        <SortableHeader column="status" label="Status" sortBy={props.sortBy} sortOrder={props.sortOrder} onSort={props.onSort} />
                        <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider bg-gray-50/80 sticky top-0 z-10 border-b border-gray-100 backdrop-blur-sm">Åtgärder</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                    {props.members.map((member) => (
                        <tr 
                            key={member.id} 
                            onClick={() => props.onShowDetails(member)}
                            className={`group transition-all cursor-pointer ${props.selectedMemberIds.has(member.id) ? 'bg-primary-50' : 'hover:bg-neutral-light/40'}`}
                        >
                            <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                            <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 flex-shrink-0">
                                        {member.photoURL ? (
                                            <img className="h-10 w-10 rounded-full object-cover border border-neutral-light" src={member.photoURL} alt="" />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-neutral-light flex items-center justify-center text-neutral-400">
                                                <User className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-bold text-neutral-dark group-hover:text-primary transition-colors">{member.name}</div>
                                        <div className="text-xs text-neutral">{member.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral">
                                <span className={`${!member.lastLogDate ? 'text-neutral-400 italic' : 'text-neutral-dark font-medium'}`}>
                                    {member.lastLogDate || 'Ingen aktivitet'}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-lg">🔥</span>
                                    <span className="text-sm font-bold text-neutral-dark">{member.currentStreak}</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-dark">{member.goalSummary}</td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <StatusBadge status={member.status} />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    {member.status === 'pending' ? (
                                        <ActionButton 
                                            onClick={() => props.onApprove(member.id)} 
                                            disabled={props.updatingMemberId === member.id}
                                            icon={<CheckCircleIcon className="w-4 h-4" />}
                                            label="Godkänn"
                                            className="bg-green-100 text-green-700 hover:bg-green-200"
                                        />
                                    ) : (
                                        <ActionButton 
                                            onClick={() => props.onRevoke(member.id)} 
                                            disabled={props.updatingMemberId === member.id}
                                            icon={<XCircleIcon className="w-4 h-4" />}
                                            label="Neka"
                                            className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                        />
                                    )}
                                    
                                    {member.status === 'approved' && member.id !== props.currentUserId && (
                                        <ActionButton 
                                            onClick={() => props.onUpdateRole(member.id, member.role === 'coach' ? 'member' : 'coach')} 
                                            disabled={props.updatingMemberId === member.id}
                                            icon={member.role === 'coach' ? <User className="w-4 h-4" /> : <TrophyIcon className="w-4 h-4" />}
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
    const [showOnlyPending, setShowOnlyPending] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<SortableKeys | null>(initialSortBy);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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

    const handleBulkAction = useCallback(async (action: 'approve' | 'setRoleCoach' | 'setRoleMember') => {
        const idsToUpdate = Array.from(selectedMemberIds);
        if (idsToUpdate.length === 0) return;
        setIsBulkUpdating(true);
        try {
            const actions = {
                'approve': bulkApproveMembers(idsToUpdate),
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
        if (!showOnlyPending) return true;
        const isPending = showOnlyPending && member.status === 'pending';
        return isPending;
    }), [membersList, showOnlyPending, searchQuery]);

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


    return {
        membersList, isLoadingMembers, errorMembers, updatingMemberId, showOnlyPending, setShowOnlyPending,
        selectedMemberIds, setSelectedMemberIds, sortBy, setSortBy, sortOrder, setSortOrder, isBulkUpdating,
        searchQuery, setSearchQuery, fetchMembers, handleApproveMember, handleRevokeApproval,
        handleUpdateRole, handleBulkAction, sortedAndFilteredMembers, pendingCount
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
      membersList, isLoadingMembers, errorMembers, updatingMemberId, showOnlyPending, setShowOnlyPending,
      selectedMemberIds, setSelectedMemberIds, sortBy, setSortBy, sortOrder, setSortOrder, isBulkUpdating,
      searchQuery, setSearchQuery, fetchMembers, handleApproveMember, handleRevokeApproval,
      handleUpdateRole, handleBulkAction, sortedAndFilteredMembers, pendingCount
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
    <div className="min-h-screen bg-neutral-light bg-dotted-pattern bg-dotted-size bg-fixed text-neutral-dark">
      <header className="bg-white/85 backdrop-blur-lg shadow-sm sticky top-0 z-40 border-b border-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center">
              <div className="bg-primary-100 p-2 rounded-xl mr-3">
                <UserGroupIcon className="w-8 h-8 text-primary-darker" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-neutral-dark leading-none">Admin Dashboard</h1>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mt-1">Kostloggen Studio</p>
              </div>
          </div>
          <nav className="flex items-center gap-3">
            <button onClick={() => setShowInfoModal(true)} className="p-2.5 text-neutral-500 hover:text-primary hover:bg-primary-50 rounded-xl transition-all" aria-label="Information">
                <InformationCircleIcon className="w-6 h-6" />
            </button>
            <button onClick={onToggleInterface} className="flex items-center px-4 py-2.5 bg-white border border-neutral-light hover:border-primary/30 hover:shadow-md text-neutral-dark font-semibold rounded-xl active:scale-95 transform transition-all group">
                <SwitchHorizontalIcon className="w-5 h-5 mr-2 text-neutral-400 group-hover:text-primary transition-colors" /> 
                <span className="text-sm">Medlemsvy</span>
            </button>
            <button onClick={onLogout} className="flex items-center px-4 py-2.5 bg-neutral-dark hover:bg-black text-white font-semibold rounded-xl shadow-lg shadow-neutral-dark/20 active:scale-95 transform transition-all">
                <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" /> 
                <span className="text-sm">Logga ut</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        <GroupInsights membersList={membersList} isExpanded={isInsightsExpanded} onToggle={() => setIsInsightsExpanded(prev => !prev)} />
        
        <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
            <MemberFilters 
                searchQuery={searchQuery} 
                onSearchChange={setSearchQuery} 
                showOnlyPending={showOnlyPending} 
                onPendingChange={setShowOnlyPending} 
                pendingCount={pendingCount} 
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
                    <LoadingSpinner message={isBulkUpdating ? "Uppdaterar medlemmar..." : "Laddar medlemmar..."} color="primary" />
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
                    <MemberListTable 
                        members={sortedAndFilteredMembers} 
                        currentUserId={currentUserId} 
                        selectedMemberIds={selectedMemberIds} 
                        sortBy={sortBy} 
                        sortOrder={sortOrder} 
                        updatingMemberId={updatingMemberId} 
                        onSelectAll={handleSelectAll} 
                        onSelectMember={handleSelectMember} 
                        onSort={handleSort} 
                        onShowDetails={handleShowMemberDetails} 
                        onApprove={handleApproveMember} 
                        onRevoke={handleRevokeApproval} 
                        onUpdateRole={handleUpdateRole} 
                    />
                ) : (
                    <div className="text-center py-16 bg-neutral-light/30 rounded-2xl border border-dashed border-neutral-light">
                        <UserGroupIcon className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                        <p className="text-neutral-500 font-medium">Inga medlemmar matchade din sökning.</p>
                        {showOnlyPending && <button onClick={() => setShowOnlyPending(false)} className="mt-2 text-primary font-bold hover:underline text-sm">Visa alla medlemmar</button>}
                    </div>
                )
            )}
        </div>
      </main>

      <footer className="text-center py-8 text-neutral-400 text-sm font-medium">
        <p>© 2025 Flexibel Hälsostudio.</p>
      </footer>

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
                            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-neutral-dark text-sm">Godkänn medlemmar</p>
                                <p className="text-xs">Nya konton markeras som 'Väntar'. Godkänn dem för att ge access.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <UserGroupIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-neutral-dark text-sm">Hantera roller</p>
                                <p className="text-xs">Befordra medlemmar till coacher eller tvärtom direkt i listan.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <SparklesIcon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
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
    </div>
    <MemberDetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />
    </>
  );
};

export default CoachDashboard;
