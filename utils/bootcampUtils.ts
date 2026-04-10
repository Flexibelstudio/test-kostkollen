export const getBootcampRankInfo = (longestStreak: number, currentStreak: number, status: string) => {
    const ranks = [
        { name: 'Soldat', req: 0 },
        { name: 'Korpral', req: 7 },
        { name: 'Sergeant', req: 14 },
        { name: 'Fänrik', req: 25 },
        { name: 'Löjtnant', req: 35 },
        { name: 'Kapten', req: 50 },
        { name: 'Major', req: 65 },
        { name: 'General', req: 80 }
    ];

    // Om man är i Fas 2 är man alltid minst Sergeant
    const effectiveLongestStreak = status === 'fas2' ? Math.max(14, longestStreak) : longestStreak;

    let currentRankIndex = 0;
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (effectiveLongestStreak >= ranks[i].req) {
            currentRankIndex = i;
            break;
        }
    }

    const currentRank = ranks[currentRankIndex];
    const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null;

    let daysToNext = 0;
    let progress = 100;

    if (nextRank) {
        daysToNext = Math.max(0, nextRank.req - currentStreak);
        progress = (currentStreak / nextRank.req) * 100;
    }

    return {
        currentRank: currentRank.name,
        nextRank: nextRank?.name,
        daysToNext,
        progress: Math.min(100, Math.max(0, progress))
    };
};
