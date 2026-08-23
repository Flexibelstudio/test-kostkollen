import React, { useState, useEffect } from 'react';
import { isTestingToolAllowed } from '../utils/testingToolHostnames';
import { 
  PhotoPipelineMetrics, 
  getPhotoMetricsHistory, 
  getLatestPhotoMetrics, 
  subscribeToPhotoMetrics, 
  clearPhotoMetricsHistory 
} from '../utils/photoPipelineProfiler';
import { Timer, Camera, Sparkles, Database, Check, Copy, Trash2, ChevronDown, ChevronUp, X, Activity, HardDrive } from 'lucide-react';

export const PhotoTimingPanel: React.FC = () => {
  const [allowed, setAllowed] = useState(false);
  const [history, setHistory] = useState<PhotoPipelineMetrics[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const isAllowed = isTestingToolAllowed();
    setAllowed(isAllowed);
    if (!isAllowed) return;

    setHistory(getPhotoMetricsHistory());

    const unsubscribe = subscribeToPhotoMetrics(() => {
      const updated = getPhotoMetricsHistory();
      setHistory(updated);
      if (updated.length > 0) {
        setSelectedSessionId(updated[0].id);
        setIsExpanded(true); // Öppna automatiskt när en ny mätning registreras
      }
    });

    return unsubscribe;
  }, []);

  if (!allowed) return null;

  const currentMetrics = history.find(h => h.id === selectedSessionId) || history[0] || null;

  const handleCopyReport = () => {
    if (!currentMetrics) return;
    const reportText = `=== KOSTLOGGEN FOTOMÄTNING (DEBUG/PERF) ===
Tidpunkt: ${currentMetrics.formattedTime}
Måltid: ${currentMetrics.foodItemIdentified || 'Måltid'} (${currentMetrics.caloriesIdentified || 0} kcal)

1. Kameraknapp till bild tagen: ${currentMetrics.captureTimeMs.toFixed(1)} ms
2. Komprimering & förberedelse: ${currentMetrics.compressionTimeMs.toFixed(1)} ms
   - Bildstorlek före: ${currentMetrics.rawImageSizeKb.toFixed(1)} KB (${currentMetrics.rawDimensions.width}x${currentMetrics.rawDimensions.height})
   - Bildstorlek efter: ${currentMetrics.compressedImageSizeKb.toFixed(1)} KB (${currentMetrics.compressedDimensions.width}x${currentMetrics.compressedDimensions.height})
   - Reduktion: -${currentMetrics.compressionRatioPercent.toFixed(1)}%
3. Uppladdning / Payload-prep: ${currentMetrics.uploadTimeMs.toFixed(1)} ms
4. Gemini bildanalys-anrop: ${currentMetrics.geminiCallTimeMs.toFixed(1)} ms
5. Tolkning till näringsvärden: ${currentMetrics.parsingTimeMs.toFixed(1)} ms
6. Rendering av bekräftelsemodal: ${currentMetrics.renderModalTimeMs.toFixed(1)} ms
   - Användarens betänketid: ${currentMetrics.userConfirmationDwellTimeMs.toFixed(0)} ms
7. Skrivning till Firestore: ${currentMetrics.firestoreSaveTimeMs.toFixed(1)} ms
----------------------------------------
8. TOTAL AKTIV SYSTEMTID: ${currentMetrics.totalActiveProcessingTimeMs.toFixed(1)} ms
8. TOTAL VÄGGKLOCKA (E2E): ${currentMetrics.totalPipelineTimeMs.toFixed(1)} ms
========================================`;

    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyJson = () => {
    if (!currentMetrics) return;
    navigator.clipboard.writeText(JSON.stringify(currentMetrics, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Minimerad flytande knapp
  if (!isExpanded) {
    return (
      <div className="fixed bottom-20 left-4 z-[90] animate-fade-in print:hidden">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-3 py-2 bg-neutral-900/90 hover:bg-neutral-900 text-white rounded-full shadow-lg border border-neutral-700/60 backdrop-blur-md text-xs font-mono transition-all hover:scale-105 active:scale-95"
          title="Visa tidsmätning för fotologgning (Endast synlig i testmiljö)"
        >
          <Timer className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-neutral-200">Fotomätning</span>
          <span className="px-1.5 py-0.5 bg-neutral-800 text-amber-300 rounded-full text-[10px] font-bold border border-neutral-700">
            {history.length}
          </span>
          {currentMetrics && (
            <span className="text-emerald-400 font-bold border-l border-neutral-700 pl-1.5">
              {currentMetrics.totalActiveProcessingTimeMs.toFixed(0)} ms
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[90] w-96 max-w-[calc(100vw-2rem)] max-h-[85vh] bg-neutral-900 text-neutral-100 rounded-2xl shadow-2xl border border-neutral-700/80 backdrop-blur-xl flex flex-col overflow-hidden animate-scale-in font-sans text-xs print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950/80 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="font-bold text-sm text-neutral-100 flex items-center gap-1.5">
              Fotomätning
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                PROFILER
              </span>
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            title="Minimera panel"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Sessionsväljare om flera mätningar finns */}
        {history.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
            <span className="text-[11px] text-neutral-400 shrink-0 mr-1">Körning:</span>
            {history.map((h, idx) => (
              <button
                key={h.id}
                onClick={() => setSelectedSessionId(h.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono shrink-0 transition-colors ${
                  (currentMetrics?.id === h.id)
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                #{history.length - idx} ({h.totalActiveProcessingTimeMs.toFixed(0)} ms)
              </button>
            ))}
          </div>
        )}

        {!currentMetrics ? (
          <div className="py-8 text-center text-neutral-400 space-y-2">
            <Camera className="w-8 h-8 mx-auto text-neutral-600 animate-pulse" />
            <p className="font-medium text-neutral-300">Ingen bild analyserad än</p>
            <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
              Ta ett foto på en måltid med kameraknappen så mäts alla 8 steg i kedjan i realtid.
            </p>
          </div>
        ) : (
          <>
            {/* Sammanfattningskort (Stora siffror) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  Aktiv Systemtid
                </span>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  {currentMetrics.totalActiveProcessingTimeMs.toFixed(0)} <span className="text-xs font-normal text-emerald-500">ms</span>
                </div>
                <p className="text-[10px] text-neutral-500">Exkl. användarbetänketid</p>
              </div>

              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  Total Väggklocka
                </span>
                <div className="text-xl font-black text-neutral-100 font-mono">
                  {currentMetrics.totalPipelineTimeMs.toFixed(0)} <span className="text-xs font-normal text-neutral-400">ms</span>
                </div>
                <p className="text-[10px] text-neutral-500">Kamera → Firestore</p>
              </div>
            </div>

            {/* Bildstorlekskort */}
            <div className="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between text-neutral-300">
                <span className="font-semibold flex items-center gap-1 text-[11px]">
                  <HardDrive className="w-3.5 h-3.5 text-amber-400" /> Bildkomprimering (KB)
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  -{currentMetrics.compressionRatioPercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-neutral-400 bg-neutral-900 p-2 rounded border border-neutral-800">
                <div>
                  <span className="text-neutral-500 block text-[9px] uppercase">Före</span>
                  <strong className="text-neutral-200">{currentMetrics.rawImageSizeKb.toFixed(1)} KB</strong>
                  <span className="text-[10px] text-neutral-500 block">({currentMetrics.rawDimensions.width}x{currentMetrics.rawDimensions.height})</span>
                </div>
                <span className="text-neutral-600 font-sans">→</span>
                <div>
                  <span className="text-neutral-500 block text-[9px] uppercase">Efter</span>
                  <strong className="text-emerald-400">{currentMetrics.compressedImageSizeKb.toFixed(1)} KB</strong>
                  <span className="text-[10px] text-neutral-500 block">({currentMetrics.compressedDimensions.width}x{currentMetrics.compressedDimensions.height})</span>
                </div>
              </div>
            </div>

            {/* Steg för steg fördelning */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                <span>Steg-för-steg mätning</span>
                <span>Tid (ms)</span>
              </div>

              <div className="space-y-1.5 font-mono">
                {/* 1. Bildtagning */}
                <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-neutral-200">1. Knapptryck → Bild tagen</div>
                    <div className="text-[10px] text-neutral-500">Kameraström till rå canvas</div>
                  </div>
                  <span className="font-bold text-neutral-200 bg-neutral-800 px-2 py-0.5 rounded">
                    {currentMetrics.captureTimeMs.toFixed(1)} ms
                  </span>
                </div>

                {/* 2. Komprimering */}
                <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-neutral-200">2. Komprimering & skalning</div>
                    <div className="text-[10px] text-neutral-500">Max 800px + 75% JPEG</div>
                  </div>
                  <span className="font-bold text-amber-300 bg-neutral-800 px-2 py-0.5 rounded">
                    {currentMetrics.compressionTimeMs.toFixed(1)} ms
                  </span>
                </div>

                {/* 3. Uppladdning / Payload */}
                <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-neutral-200">3. Bilduppladdning / Payload</div>
                    <div className="text-[10px] text-neutral-500">Base64 inlineData payload</div>
                  </div>
                  <span className="font-bold text-neutral-200 bg-neutral-800 px-2 py-0.5 rounded">
                    {currentMetrics.uploadTimeMs.toFixed(1)} ms
                  </span>
                </div>

                {/* 4. Gemini API Anrop */}
                <div className="p-2 bg-neutral-950/60 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      4. Gemini bildanalys-anrop
                    </div>
                    <div className="text-[10px] text-neutral-400">Nätverksanrop & AI-inferens</div>
                  </div>
                  <span className="font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
                    {currentMetrics.geminiCallTimeMs.toFixed(1)} ms
                  </span>
                </div>

                {/* 5. Tolkning */}
                <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-neutral-200">5. Tolkning till näringsvärden</div>
                    <div className="text-[10px] text-neutral-500">
                      JSON-parsing: "{currentMetrics.foodItemIdentified || 'Måltid'}"
                    </div>
                  </div>
                  <span className="font-bold text-neutral-200 bg-neutral-800 px-2 py-0.5 rounded">
                    {currentMetrics.parsingTimeMs.toFixed(1)} ms
                  </span>
                </div>

                {/* 6. Rendering av modal */}
                <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-neutral-200">6. Rendering av bekräftelsemodal</div>
                    <div className="text-[10px] text-neutral-500">
                      DOM-paint (Betänketid: {currentMetrics.userConfirmationDwellTimeMs.toFixed(0)} ms)
                    </div>
                  </div>
                  <span className="font-bold text-neutral-200 bg-neutral-800 px-2 py-0.5 rounded">
                    {currentMetrics.renderModalTimeMs.toFixed(1)} ms
                  </span>
                </div>

                {/* 7. Firestore */}
                <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-neutral-200 flex items-center gap-1">
                      <Database className="w-3 h-3 text-blue-400" />
                      7. Skrivning till Firestore
                    </div>
                    <div className="text-[10px] text-neutral-500">addMealLog batch commit</div>
                  </div>
                  <span className="font-bold text-blue-300 bg-neutral-800 px-2 py-0.5 rounded">
                    {currentMetrics.firestoreSaveTimeMs.toFixed(1)} ms
                  </span>
                </div>
              </div>
            </div>

            {/* Visuell fördelningsstapel */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                Tidsfördelning (% av aktiv tid)
              </span>
              <div className="h-3 w-full bg-neutral-800 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${(currentMetrics.captureTimeMs / (currentMetrics.totalActiveProcessingTimeMs || 1)) * 100}%` }} 
                  className="bg-purple-500 h-full" 
                  title={`Foto: ${currentMetrics.captureTimeMs.toFixed(0)} ms`}
                />
                <div 
                  style={{ width: `${(currentMetrics.compressionTimeMs / (currentMetrics.totalActiveProcessingTimeMs || 1)) * 100}%` }} 
                  className="bg-yellow-500 h-full" 
                  title={`Komprimering: ${currentMetrics.compressionTimeMs.toFixed(0)} ms`}
                />
                <div 
                  style={{ width: `${(currentMetrics.geminiCallTimeMs / (currentMetrics.totalActiveProcessingTimeMs || 1)) * 100}%` }} 
                  className="bg-amber-400 h-full" 
                  title={`Gemini: ${currentMetrics.geminiCallTimeMs.toFixed(0)} ms`}
                />
                <div 
                  style={{ width: `${(currentMetrics.renderModalTimeMs / (currentMetrics.totalActiveProcessingTimeMs || 1)) * 100}%` }} 
                  className="bg-cyan-500 h-full" 
                  title={`Render: ${currentMetrics.renderModalTimeMs.toFixed(0)} ms`}
                />
                <div 
                  style={{ width: `${(currentMetrics.firestoreSaveTimeMs / (currentMetrics.totalActiveProcessingTimeMs || 1)) * 100}%` }} 
                  className="bg-blue-500 h-full" 
                  title={`Firestore: ${currentMetrics.firestoreSaveTimeMs.toFixed(0)} ms`}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer med åtgärder */}
      {currentMetrics && (
        <div className="p-3 bg-neutral-950/90 border-t border-neutral-800 flex items-center justify-between shrink-0">
          <button
            onClick={clearPhotoMetricsHistory}
            className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
            title="Rensa mäthistorik"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="px-2.5 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-medium transition-colors"
            >
              JSON
            </button>
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1 px-3 py-1 text-[11px] bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Kopierat!' : 'Kopiera rapport'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoTimingPanel;
