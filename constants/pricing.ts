/**
 * Centraliserade konstanter för prissättning och programlängd.
 */

// --- Introduktionspris -------------------------------------------------
// Bootcampen säljs till introduktionspris till och med 30 september 2026.
// Från 1 oktober gäller ordinarie pris. Datumet står på ETT ställe här och
// på motsvarande ställe i functions/index.js, som väljer Stripe-priset.
// Kampanjen avslutar sig alltså själv – ingen deploy behövs den 1 oktober.
export const BOOTCAMP_INTRO_PRICE_SEK = 695;
export const BOOTCAMP_ORDINARY_PRICE_SEK = 995;

// Sista sekunden på 30 september 2026, svensk sommartid (UTC+2).
export const BOOTCAMP_INTRO_ENDS_AT = new Date('2026-09-30T23:59:59+02:00');

export const isBootcampIntroActive = (now: Date = new Date()): boolean =>
  now <= BOOTCAMP_INTRO_ENDS_AT;

export const getBootcampPriceSek = (now: Date = new Date()): number =>
  isBootcampIntroActive(now) ? BOOTCAMP_INTRO_PRICE_SEK : BOOTCAMP_ORDINARY_PRICE_SEK;

// Bakåtkompatibla namn – används på flera ställen i gränssnittet.
// Värdet räknas ut när appen laddas.
export const BOOTCAMP_PRICE_SEK = getBootcampPriceSek();
export const BOOTCAMP_PRICE_LABEL = `${BOOTCAMP_PRICE_SEK} kr`;
export const BOOTCAMP_ORDINARY_PRICE_LABEL = `${BOOTCAMP_ORDINARY_PRICE_SEK} kr`;

export const BOOTCAMP_DURATION_WEEKS = 12;
export const BOOTCAMP_DURATION_DAYS = 84; // 12 veckor * 7 dagar
export const BOOTCAMP_ONBOARDING_MAX_DAYS = 3; // Grundutbildning i högst 3 dygn
