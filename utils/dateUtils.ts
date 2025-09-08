// utils/dateUtils.ts
export const getWeekInfo = (date: Date): { weekId: string; startDate: string; endDate: string } => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // Normalize to the start of the local day

    const day = d.getDay(); // 0 for Sunday, 1 for Monday
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diffToMonday));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // ISO 8601 week number calculation
    const target = new Date(monday.valueOf());
    const dayNr = (monday.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000

    return {
        weekId: `${target.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`,
        startDate: monday.toISOString().split('T')[0],
        endDate: sunday.toISOString().split('T')[0],
    };
};
