import { DietaryPreference } from '../types';

/**
 * Kostval på ett ställe.
 *
 * Tidigare kunde coachen bara gissa utifrån loggarna om någon undvek kött, och
 * receptsökningen visste ingenting alls. Nu bär profilen valet, och samma text
 * matas in i både coachprompterna och receptprompterna så att app och coach
 * aldrig säger emot varandra.
 */

export interface DietaryPreferenceOption {
  value: DietaryPreference;
  label: string;
  description: string;
}

export const DIETARY_PREFERENCE_OPTIONS: DietaryPreferenceOption[] = [
  { value: 'omnivore', label: 'Allätare', description: 'Inga begränsningar.' },
  { value: 'pescetarian', label: 'Pescetarian', description: 'Fisk och skaldjur, men inte kött.' },
  { value: 'vegetarian', label: 'Vegetarian', description: 'Inget kött eller fisk. Ägg och mejeri går bra.' },
  { value: 'vegan', label: 'Vegan', description: 'Helt växtbaserat.' },
];

export const DEFAULT_DIETARY_PREFERENCE: DietaryPreference = 'omnivore';

export const normalizeDietaryPreference = (value?: DietaryPreference | null): DietaryPreference =>
  value && DIETARY_PREFERENCE_OPTIONS.some(o => o.value === value) ? value : DEFAULT_DIETARY_PREFERENCE;

export const dietaryPreferenceLabel = (value?: DietaryPreference | null): string =>
  DIETARY_PREFERENCE_OPTIONS.find(o => o.value === normalizeDietaryPreference(value))?.label || 'Allätare';

/** Vad som är uteslutet, i klartext till modellen. */
const EXCLUSIONS: Record<DietaryPreference, string> = {
  omnivore: '',
  pescetarian: 'Användaren äter INTE kött eller fågel. Fisk, skaldjur, ägg och mejeriprodukter går bra.',
  vegetarian: 'Användaren äter INTE kött, fågel, fisk eller skaldjur. Ägg och mejeriprodukter går bra.',
  vegan: 'Användaren äter INGA animaliska produkter alls - inget kött, fågel, fisk, skaldjur, ägg, mejeri, honung eller gelatin.',
};

/** Proteinkällor att föreslå i stället, per kostval. */
const PROTEIN_SOURCES: Record<DietaryPreference, string> = {
  omnivore: '',
  pescetarian: 'fisk, skaldjur, ägg, kvarg, keso, baljväxter, linser, tofu, tempeh, sojafärs och quorn',
  vegetarian: 'ägg, kvarg, keso, baljväxter, linser, kikärter, tofu, tempeh, sojafärs, quorn, nötter och frön',
  vegan: 'baljväxter, linser, kikärter, tofu, tempeh, sojafärs, sojaprotein, seitan, nötter, frön och växtbaserad proteinberikad yoghurt (quorn innehåller ägg och räknas inte)',
};

/**
 * Block till coachprompterna. Tomt för allätare - då ska ingenting styras.
 */
export function dietaryPromptBlock(preference?: DietaryPreference | null): string {
  const pref = normalizeDietaryPreference(preference);
  if (pref === 'omnivore') return '';

  return `
**ANVÄNDARENS KOSTVAL (ÖVERORDNAT NÄRINGS-LAGBOKEN):**
Användaren har angett ${dietaryPreferenceLabel(pref)} i sin profil. ${EXCLUSIONS[pref]}
- Föreslå ALDRIG livsmedel som bryter mot detta, inte ens som exempel i förbifarten.
- När du pratar om protein: utgå från ${PROTEIN_SOURCES[pref]}.
- Kommentera inte kostvalet och försök inte övertala användaren att äta annat.
- Har användaren loggat något som bryter mot sitt eget kostval: säg ingenting om det. Det är deras ensak.`;
}

/**
 * Block till receptprompterna. Sökningen väger tyngre än profilen - ber
 * användaren uttryckligen om en råvara ska de få den, kostvalet styr allt annat.
 */
export function dietaryRecipeBlock(preference?: DietaryPreference | null): string {
  const pref = normalizeDietaryPreference(preference);
  if (pref === 'omnivore') return '';

  return `
**KOSTVAL (VIKTIGT):**
Användaren är ${dietaryPreferenceLabel(pref)}. ${EXCLUSIONS[pref]}
- Receptet ska följa kostvalet fullt ut, både i ingredienser och i tillbehör.
- Bygg proteinet på ${PROTEIN_SOURCES[pref]}.
- UNDANTAG: har användaren uttryckligen sökt på en råvara som bryter mot kostvalet ska du ge receptet ändå - de har valt det medvetet. Byt inte ut råvaran i smyg. Nämn i chefTip att det går att byta till ett växtbaserat alternativ.`;
}
