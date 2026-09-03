export interface BootcampRankDef {
  name: string;
  req: number;
  badgePath: string;
  theme: 'light' | 'sand' | 'dark';
  quote: string;
  achievementText: string;
}

export const BORJE_SIGNATURE_DARK = '/badges/borje_signature.png';
export const BORJE_SIGNATURE_LIGHT = '/badges/borje_signature_light.png';
export const BORJE_SIGNATURE_PATH = BORJE_SIGNATURE_DARK;

export const BOOTCAMP_RANKS: BootcampRankDef[] = [
  {
    name: 'Soldat',
    req: 0,
    badgePath: '/badges/rank_soldat.png',
    theme: 'light',
    quote: 'Så du anmälde dig. Bra. Det är fler som pratar än som mönstrar. Reglerna är enkla: du loggar allt du äter, varje dag, och du lämnar din kvällsrapport. Inget krångel, inga undantag, inga ursäkter. Jag bryr mig inte om var du börjar. Jag bryr mig om att du kommer tillbaka i morgon. Välkommen till truppen, soldat.',
    achievementText: 'Mönstrad i Generalens Bootcamp'
  },
  {
    name: 'Korpral',
    req: 7,
    badgePath: '/badges/rank_korpral.png',
    theme: 'light',
    quote: 'Sju dagar. Du har gjort vad de flesta inte gör – du kom tillbaka varje dag. Det är ingen slump längre. Det är en vana som börjar ta form. Härmed befordrad till korpral. Njut av det i tio sekunder, sedan loggar du kvällsmaten.',
    achievementText: '7 dagar i följd'
  },
  {
    name: 'Sergeant',
    req: 14,
    badgePath: '/badges/rank_sergeant.png',
    theme: 'light',
    quote: 'Två veckor. Nu börjar det bli intressant. Det är här folk brukar tappa greppet – helgen kommer, rutinen glider, och plötsligt är det tre dagar sedan senaste loggen. Du gjorde inte det. Sergeant. Du har förtjänat den.',
    achievementText: '14 dagar i följd'
  },
  {
    name: 'Fänrik',
    req: 25,
    badgePath: '/badges/rank_fanrik.png',
    theme: 'sand',
    quote: 'Tjugofem dagar. Du gör inte längre det här för min skull. Jag har sett många börja starkt och försvinna i vecka tre. Du är kvar, och du loggar med samma disciplin som första dagen. Fänrik. Nu är du någon jag räknar med.',
    achievementText: '25 dagar i följd'
  },
  {
    name: 'Löjtnant',
    req: 35,
    badgePath: '/badges/rank_lojtnant.png',
    theme: 'sand',
    quote: 'Fem veckor i följd. Det här är inte längre ett projekt, det är hur du lever. Du behöver inte fundera på om du ska logga. Du bara gör det. Det är precis vad jag var ute efter. Löjtnant. Du leder dig själv nu, och det är den svåraste truppen som finns.',
    achievementText: '35 dagar i följd'
  },
  {
    name: 'Kapten',
    req: 50,
    badgePath: '/badges/rank_kapten.png',
    theme: 'sand',
    quote: 'Femtio dagar. Femtio. Jag ska säga något jag inte säger ofta: du imponerar på mig. Inte för att du är perfekt, utan för att du är konsekvent. Konsekvens slår perfektion varje gång. Kapten. Bär den med rak rygg.',
    achievementText: '50 dagar i följd'
  },
  {
    name: 'Major',
    req: 65,
    badgePath: '/badges/rank_major.png',
    theme: 'dark',
    quote: 'Sextiofem dagar utan att vika. Kom ihåg vem du var den där första dagen, när du inte var säker på att du skulle klara en vecka. Titta på dig nu. Major. Det är inte många som kommer hit.',
    achievementText: '65 dagar i följd'
  },
  {
    name: 'General',
    req: 80,
    badgePath: '/badges/rank_general.png',
    theme: 'dark',
    quote: 'Åttio dagar. Du började som soldat och gjorde varje dag det du sagt att du skulle göra. Det finns ingen genväg hit, ingen tur, inget att bortförklara. Bara du och åttio beslut i rad. Härmed befordrad till general. Från och med nu tar du inte order av mig – du ger dem till dig själv. Väl genomfört.',
    achievementText: '80 dagar i följd'
  }
];

export const BORJE_EXTRA_TEXTS = {
  BROKEN_STREAK: 'Streaken är bruten. Det händer. Jag är inte intresserad av bortförklaringar och inte av självömkan heller. Jag är intresserad av vad du gör i dag. Logga frukosten. Nu. Då är vi igång igen.',
  FINALE: 'Tolv veckor. Bootcampen är slut. Du kom hit för att gå ner i vikt. Det du faktiskt tog med dig är vanor som håller när ingen står och tittar – och det är värt betydligt mer. Truppen skiljs, men reglerna gäller fortfarande: logga, ät ordentligt, vila. Du kan dem utan mig nu. Tack för att du fullföljde. Det gör inte alla.'
};

export const getBootcampRankInfo = (longestStreak: number, currentStreak: number, status: string) => {
    // Om man är i Fas 2 är man alltid minst Sergeant (14 dagar)
    const effectiveLongestStreak = status === 'fas2' ? Math.max(14, longestStreak) : longestStreak;

    let currentRankIndex = 0;
    for (let i = BOOTCAMP_RANKS.length - 1; i >= 0; i--) {
        if (effectiveLongestStreak >= BOOTCAMP_RANKS[i].req) {
            currentRankIndex = i;
            break;
        }
    }

    const currentRank = BOOTCAMP_RANKS[currentRankIndex];
    const nextRank = currentRankIndex < BOOTCAMP_RANKS.length - 1 ? BOOTCAMP_RANKS[currentRankIndex + 1] : null;

    let daysToNext = 0;
    let progress = 100;

    if (nextRank) {
        daysToNext = Math.max(0, nextRank.req - currentStreak);
        progress = (currentStreak / nextRank.req) * 100;
    }

    return {
        currentRank: currentRank.name,
        rankDef: currentRank,
        nextRank: nextRank?.name,
        nextRankDef: nextRank,
        daysToNext,
        progress: Math.min(100, Math.max(0, progress))
    };
};

export const getRankDefByName = (rankName: string): BootcampRankDef => {
  return BOOTCAMP_RANKS.find(r => r.name.toLowerCase() === rankName.toLowerCase()) || BOOTCAMP_RANKS[0];
};

export const getUnlockedRanks = (longestStreak: number, status?: string): BootcampRankDef[] => {
  const effective = status === 'fas2' ? Math.max(14, longestStreak) : longestStreak;
  return BOOTCAMP_RANKS.filter(r => effective >= r.req);
};

