import { isTestingToolAllowed } from './testingToolHostnames';

export interface PhotoPipelineMetrics {
  id: string;
  timestamp: number;
  formattedTime: string;

  // 1. Från att användaren trycker på kameraknappen till att bilden är tagen
  captureTimeMs: number;

  // 2. Komprimering och förberedelse av bilden
  compressionTimeMs: number;
  rawImageSizeBytes: number;
  rawImageSizeKb: number;
  rawDimensions: { width: number; height: number };
  compressedImageSizeBytes: number;
  compressedImageSizeKb: number;
  compressedDimensions: { width: number; height: number };
  compressionRatioPercent: number;

  // 3. Uppladdning av bilden (payload-förberedelse / överföring)
  uploadTimeMs: number;

  // 4. Anropet till Gemini för bildanalys, från skickat till mottaget svar
  geminiCallTimeMs: number;

  // 5. Tolkning av svaret till näringsvärden
  parsingTimeMs: number;

  // 6. Rendering av resultatvyn där användaren bekräftar
  renderModalTimeMs: number;
  userConfirmationDwellTimeMs: number; // Tid i bekräftelsemodalen innan användaren klickar spara

  // 7. Skrivningen till Firestore
  firestoreSaveTimeMs: number;

  // 8. Total tid från kameraknapp till sparad måltid
  totalPipelineTimeMs: number; // Total väggklocka från kameratryck till klar sparning
  totalActiveProcessingTimeMs: number; // Maskinell bearbetningstid (exkl. användarens betänketid)

  // Extra identifierad data
  foodItemIdentified?: string;
  caloriesIdentified?: number;
}

export interface ActivePhotoSession {
  id: string;
  tCaptureStart: number;
  tCaptureEnd?: number;
  tCompressEnd?: number;
  rawDimensions?: { width: number; height: number };
  rawImageSizeBytes?: number;
  compressedDimensions?: { width: number; height: number };
  compressedImageSizeBytes?: number;

  tUploadStart?: number;
  tUploadEnd?: number;
  tGeminiStart?: number;
  tGeminiEnd?: number;
  tParseStart?: number;
  tParseEnd?: number;

  tModalRenderStart?: number;
  tModalRenderEnd?: number;
  tModalConfirm?: number;

  tSaveStart?: number;
  tSaveEnd?: number;

  foodItem?: string;
  calories?: number;
}

const STORAGE_KEY = 'kostloggen_photo_pipeline_metrics_history';
let activeSession: ActivePhotoSession | null = null;
const listeners = new Set<() => void>();

function getStoredHistory(): PhotoPipelineMetrics[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(history: PhotoPipelineMetrics[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
  } catch (err) {
    console.warn('Kunde inte spara fotomätningshistorik i localStorage:', err);
  }
}

let sessionHistory: PhotoPipelineMetrics[] = typeof window !== 'undefined' ? getStoredHistory() : [];

export function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribeToPhotoMetrics(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getPhotoMetricsHistory(): PhotoPipelineMetrics[] {
  return [...sessionHistory];
}

export function getLatestPhotoMetrics(): PhotoPipelineMetrics | null {
  return sessionHistory.length > 0 ? sessionHistory[0] : null;
}

export function clearPhotoMetricsHistory(): void {
  sessionHistory = [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  notifyListeners();
}

/**
 * 1. Starta tidtagning när användaren trycker på kameraknappen
 */
export function startPhotoCapture(): ActivePhotoSession {
  const session: ActivePhotoSession = {
    id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tCaptureStart: performance.now(),
  };
  activeSession = session;
  return session;
}

/**
 * 2. Avsluta bildtagning och komprimering
 */
export function recordCaptureAndCompression(data: {
  tCaptureEnd: number;
  tCompressEnd: number;
  rawDimensions: { width: number; height: number };
  rawImageSizeBytes: number;
  compressedDimensions: { width: number; height: number };
  compressedImageSizeBytes: number;
}) {
  if (!activeSession) return;
  activeSession.tCaptureEnd = data.tCaptureEnd;
  activeSession.tCompressEnd = data.tCompressEnd;
  activeSession.rawDimensions = data.rawDimensions;
  activeSession.rawImageSizeBytes = data.rawImageSizeBytes;
  activeSession.compressedDimensions = data.compressedDimensions;
  activeSession.compressedImageSizeBytes = data.compressedImageSizeBytes;
}

/**
 * 3. Uppladdning / Payload-start
 */
export function recordUploadStart() {
  if (activeSession) {
    activeSession.tUploadStart = performance.now();
  }
}

export function recordUploadEnd() {
  if (activeSession) {
    activeSession.tUploadEnd = performance.now();
  }
}

/**
 * 4 & 5. Gemini API anrop & JSON parsing
 */
export function recordGeminiCallTiming(data: {
  tGeminiStart: number;
  tGeminiEnd: number;
  tParseStart: number;
  tParseEnd: number;
  foodItem?: string;
  calories?: number;
}) {
  if (!activeSession) return;
  activeSession.tGeminiStart = data.tGeminiStart;
  activeSession.tGeminiEnd = data.tGeminiEnd;
  activeSession.tParseStart = data.tParseStart;
  activeSession.tParseEnd = data.tParseEnd;
  activeSession.foodItem = data.foodItem;
  activeSession.calories = data.calories;
}

/**
 * 6. Modal rendering start, rendering slutförd & bekräftelse
 */
export function recordModalRenderStart() {
  if (activeSession) {
    activeSession.tModalRenderStart = performance.now();
  }
}

export function recordModalRenderEnd() {
  if (activeSession && !activeSession.tModalRenderEnd) {
    activeSession.tModalRenderEnd = performance.now();
  }
}

export function recordModalConfirm() {
  if (activeSession) {
    activeSession.tModalConfirm = performance.now();
  }
}

/**
 * 7 & 8. Firestore-sparning och sammanställning av hela kedjan
 */
export function recordFirestoreSaveStart() {
  if (activeSession) {
    activeSession.tSaveStart = performance.now();
  }
}

export function finishPhotoPipeline(): PhotoPipelineMetrics | null {
  if (!activeSession) return null;

  const tSaveEnd = performance.now();
  activeSession.tSaveEnd = tSaveEnd;

  const s = activeSession;
  const t0 = s.tCaptureStart;
  const t1 = s.tCaptureEnd || t0;
  const t2 = s.tCompressEnd || t1;
  const tUpStart = s.tUploadStart || t2;
  const tUpEnd = s.tUploadEnd || tUpStart;
  const tGemStart = s.tGeminiStart || tUpEnd;
  const tGemEnd = s.tGeminiEnd || tGemStart;
  const tParseStart = s.tParseStart || tGemEnd;
  const tParseEnd = s.tParseEnd || tParseStart;
  const tModalStart = s.tModalRenderStart || tParseEnd;
  const tModalEnd = s.tModalRenderEnd || tModalStart;
  const tModalConfirm = s.tModalConfirm || tModalEnd;
  const tSaveStart = s.tSaveStart || tModalConfirm;

  // 1. Från att användaren trycker på kameraknappen till att bilden är tagen
  const captureTimeMs = Math.max(0, t1 - t0);

  // 2. Komprimering och förberedelse av bilden
  const compressionTimeMs = Math.max(0, t2 - t1);
  const rawBytes = s.rawImageSizeBytes || 0;
  const compBytes = s.compressedImageSizeBytes || 0;
  const rawKb = rawBytes / 1024;
  const compKb = compBytes / 1024;
  const ratio = rawBytes > 0 ? ((rawBytes - compBytes) / rawBytes) * 100 : 0;

  // 3. Uppladdning av bilden / payload-förberedelse
  const uploadTimeMs = Math.max(0, tUpEnd - tUpStart);

  // 4. Anropet till Gemini för bildanalys
  const geminiCallTimeMs = Math.max(0, tGemEnd - tGemStart);

  // 5. Tolkning av svaret till näringsvärden
  const parsingTimeMs = Math.max(0, tParseEnd - tParseStart);

  // 6. Rendering av resultatvyn där användaren bekräftar
  const renderModalTimeMs = Math.max(0, tModalEnd - tModalStart);
  const userConfirmationDwellTimeMs = Math.max(0, tModalConfirm - tModalEnd);

  // 7. Skrivningen till Firestore
  const firestoreSaveTimeMs = Math.max(0, tSaveEnd - tSaveStart);

  // 8. Total tid
  const totalPipelineTimeMs = Math.max(0, tSaveEnd - t0);
  const totalActiveProcessingTimeMs =
    captureTimeMs +
    compressionTimeMs +
    uploadTimeMs +
    geminiCallTimeMs +
    parsingTimeMs +
    renderModalTimeMs +
    firestoreSaveTimeMs;

  const metrics: PhotoPipelineMetrics = {
    id: s.id,
    timestamp: Date.now(),
    formattedTime: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    captureTimeMs,
    compressionTimeMs,
    rawImageSizeBytes: rawBytes,
    rawImageSizeKb: rawKb,
    rawDimensions: s.rawDimensions || { width: 0, height: 0 },
    compressedImageSizeBytes: compBytes,
    compressedImageSizeKb: compKb,
    compressedDimensions: s.compressedDimensions || { width: 0, height: 0 },
    compressionRatioPercent: ratio,
    uploadTimeMs,
    geminiCallTimeMs,
    parsingTimeMs,
    renderModalTimeMs,
    userConfirmationDwellTimeMs,
    firestoreSaveTimeMs,
    totalPipelineTimeMs,
    totalActiveProcessingTimeMs,
    foodItemIdentified: s.foodItem,
    caloriesIdentified: s.calories,
  };

  sessionHistory = [metrics, ...sessionHistory].slice(0, 30);
  saveHistoryToStorage(sessionHistory);
  activeSession = null;

  logMetricsToConsole(metrics);
  notifyListeners();

  return metrics;
}

export function getActiveSession(): ActivePhotoSession | null {
  return activeSession;
}

/**
 * Strukturerad konsolloggning
 */
export function logMetricsToConsole(m: PhotoPipelineMetrics) {
  if (!isTestingToolAllowed()) return;

  const groupLabel = `⏱️ [FOTOMÄTNING] ${m.foodItemIdentified || 'Måltid'} | Aktiv systemtid: ${m.totalActiveProcessingTimeMs.toFixed(0)} ms | Total väggklocka: ${m.totalPipelineTimeMs.toFixed(0)} ms`;
  console.groupCollapsed(groupLabel);

  const tableData: Record<string, { 'Tid (ms)': string; 'Andel aktiv': string; 'Detaljer': string }> = {
    '1. Knapptryck -> Bild tagen': {
      'Tid (ms)': `${m.captureTimeMs.toFixed(1)} ms`,
      'Andel aktiv': `${((m.captureTimeMs / (m.totalActiveProcessingTimeMs || 1)) * 100).toFixed(1)}%`,
      'Detaljer': `Kameraström -> Raw Canvas (${m.rawDimensions.width}x${m.rawDimensions.height})`
    },
    '2. Komprimering & förberedelse': {
      'Tid (ms)': `${m.compressionTimeMs.toFixed(1)} ms`,
      'Andel aktiv': `${((m.compressionTimeMs / (m.totalActiveProcessingTimeMs || 1)) * 100).toFixed(1)}%`,
      'Detaljer': `${m.rawImageSizeKb.toFixed(1)} KB -> ${m.compressedImageSizeKb.toFixed(1)} KB (-${m.compressionRatioPercent.toFixed(1)}%) [${m.compressedDimensions.width}x${m.compressedDimensions.height}]`
    },
    '3. Uppladdning / Payload-prep': {
      'Tid (ms)': `${m.uploadTimeMs.toFixed(1)} ms`,
      'Andel aktiv': `${((m.uploadTimeMs / (m.totalActiveProcessingTimeMs || 1)) * 100).toFixed(1)}%`,
      'Detaljer': 'Base64 inlineData payload till Gemini'
    },
    '4. Gemini API bildanalys': {
      'Tid (ms)': `${m.geminiCallTimeMs.toFixed(1)} ms`,
      'Andel aktiv': `${((m.geminiCallTimeMs / (m.totalActiveProcessingTimeMs || 1)) * 100).toFixed(1)}%`,
      'Detaljer': 'Nätverksanrop & inferens hos Gemini 2.5 Flash'
    },
    '5. Tolkning till näringsvärden': {
      'Tid (ms)': `${m.parsingTimeMs.toFixed(1)} ms`,
      'Andel aktiv': `${((m.parsingTimeMs / (m.totalActiveProcessingTimeMs || 1)) * 100).toFixed(1)}%`,
      'Detaljer': `JSON-parsing & validering: "${m.foodItemIdentified || 'N/A'}" (${m.caloriesIdentified || 0} kcal)`
    },
    '6. Rendering av resultatvy': {
      'Tid (ms)': `${m.renderModalTimeMs.toFixed(1)} ms`,
      'Andel aktiv': `${((m.renderModalTimeMs / (m.totalActiveProcessingTimeMs || 1)) * 100).toFixed(1)}%`,
      'Detaljer': `Bekräfta måltid-modal DOM paint (Användaren stod i modalen: ${m.userConfirmationDwellTimeMs.toFixed(0)} ms)`
    },
    '7. Skrivning till Firestore': {
      'Tid (ms)': `${m.firestoreSaveTimeMs.toFixed(1)} ms`,
      'Andel aktiv': `${((m.firestoreSaveTimeMs / (m.totalActiveProcessingTimeMs || 1)) * 100).toFixed(1)}%`,
      'Detaljer': 'addMealLog Firestore-dokument sparat'
    },
    '8. TOTAL AKTIV SYSTEMTID': {
      'Tid (ms)': `${m.totalActiveProcessingTimeMs.toFixed(1)} ms`,
      'Andel aktiv': '100.0%',
      'Detaljer': 'Exkluderar användarens betänketid i bekräftelsemodalen'
    },
    '8. TOTAL VÄGGKLOCKA (E2E)': {
      'Tid (ms)': `${m.totalPipelineTimeMs.toFixed(1)} ms`,
      'Andel aktiv': '-',
      'Detaljer': 'Från första klick på kameraknappen till slutförd Firestore-sparning'
    }
  };

  console.table(tableData);
  console.log('📦 Komplett strukturerad mätdata:', m);
  console.groupEnd();
}
