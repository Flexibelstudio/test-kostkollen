export const INVITE_TEXT = "Jag har börjat använda Kostloggen för att få bättre koll på mina vanor, och det är roligare tillsammans. Häng med så peppar vi varandra. Du får 7 dagar gratis: https://app.kostloggen.se";

export async function shareAppInvite(): Promise<{ shared: boolean; copied: boolean; cancelled?: boolean }> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        text: INVITE_TEXT,
      });
      return { shared: true, copied: false };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { shared: false, copied: false, cancelled: true };
      }
      // If native share fails for any reason, fallback to clipboard
    }
  }

  // Fallback to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(INVITE_TEXT);
      return { shared: false, copied: true };
    }
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }

  return { shared: false, copied: false };
}
