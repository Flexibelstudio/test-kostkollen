export const TESTING_TOOL_ALLOWED_HOSTNAMES = [
  'staging-kostloggen.netlify.app',
  'localhost',
  '127.0.0.1',
];

/**
 * Kontrollerar om den aktuella miljön är en tillåten testmiljö eller utvecklingsmiljö.
 * I skarp produktion (t.ex. kostloggen.se / kostloggen.netlify.app) returneras false.
 */
export const isTestingToolAllowed = (): boolean => {
  if (typeof window === 'undefined') return false;
  return TESTING_TOOL_ALLOWED_HOSTNAMES.includes(window.location.hostname);
};
