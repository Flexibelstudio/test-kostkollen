// utils/dateUtils.ts
import { MealType } from '../types';

export const getDateUID = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

export const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNumber;
};

/**
 * Returnerar föreslagen måltidstyp baserat på aktuell tid.
 * 05:00 - 10:30: Frukost
 * 10:30 - 14:00: Lunch
 * 14:00 - 17:30: Mellanmål
 * 17:30 - 21:00: Middag
 * 21:00 - 05:00: Mellanmål
 */
export const getSuggestedMealType = (date: Date = new Date()): MealType => {
    const hour = date.getHours();
    const minute = date.getMinutes();
    const time = hour + minute / 60;

    if (time >= 5 && time < 10.5) return 'breakfast';
    if (time >= 10.5 && time < 14) return 'lunch';
    if (time >= 14 && time < 17.5) return 'snack';
    if (time >= 17.5 && time < 21) return 'dinner';
    return 'snack';
};
