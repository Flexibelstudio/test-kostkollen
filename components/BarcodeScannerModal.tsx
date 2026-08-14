import React, { useState, useEffect, useRef } from "react";
import { CameraIcon, XMarkIcon } from "./icons";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import {
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from "@zxing/library";
import { FileText, Camera } from "lucide-react";
import { extractBarcodeFromImage } from "../services/geminiService";

// --- Native BarcodeDetector Types (Experimental) ---
interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector: typeof BarcodeDetector;
  }
}
// ---------------------------------------------------

interface BarcodeScannerModalProps {
  show: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  onCameraError: (errorMessage: string) => void;
  onScanFallback: () => void;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  show,
  onClose,
  onBarcodeScanned,
  onCameraError,
  onScanFallback,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingNative, setUsingNative] = useState(false);

  // Refs for cleanup
  const controlsRef = useRef<IScannerControls | null>(null); // For ZXing
  const streamRef = useRef<MediaStream | null>(null); // For Native
  const rafIdRef = useRef<number | null>(null); // For Native loop
  const isScanningRef = useRef<boolean>(false); // Flag to stop native loop

  useEffect(() => {
    let mounted = true;

    // Cleanup function to stop all scanners and streams
    const stopScanners = () => {
      isScanningRef.current = false;

      // Stop Native Loop
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Stop ZXing
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }

      // Stop Native Stream (if manually created)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const handleCameraError = (err: any) => {
      if (!mounted) return;
      console.error("Camera/Scanner error:", err);
      let msg = "Kunde inte starta kameran.";
      if (err.name === "NotAllowedError")
        msg = "Åtkomst nekad. Kontrollera inställningar.";
      else if (err.name === "NotFoundError") msg = "Ingen kamera hittades.";
      else if (err.name === "NotReadableError")
        msg = "Kameran används av en annan app.";

      setError(msg);
      onCameraError(msg);
      setIsLoading(false);
    };

    const startNativeScanner = async () => {
      try {
        setUsingNative(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to load metadata to ensure dimensions are known
          await new Promise<void>((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => resolve();
            }
          });
          await videoRef.current.play();

          // Initialize Native Detector
          const formats = ["ean_13", "ean_8", "upc_a", "upc_e"];
          const barcodeDetector = new window.BarcodeDetector({ formats });

          const scanLoop = async () => {
            if (!isScanningRef.current || !videoRef.current) return;

            try {
              if (
                videoRef.current.readyState ===
                videoRef.current.HAVE_ENOUGH_DATA
              ) {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const code = barcodes[0].rawValue;
                  onBarcodeScanned(code);
                  return; // Stop scanning on success
                }
              }
            } catch (e) {
              console.error("Native detection frame error:", e);
            }

            if (isScanningRef.current) {
              rafIdRef.current = requestAnimationFrame(scanLoop);
            }
          };

          isScanningRef.current = true;
          scanLoop();
          setIsLoading(false);
        }
      } catch (err: any) {
        // If native fails (e.g. camera busy), try fallback or just error
        handleCameraError(err);
      }
    };

    const startZxingScanner = async () => {
      try {
        setUsingNative(false);
        const hints = new Map();
        const formats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(DecodeHintType.TRY_HARDER, true); // Slightly slower but better detection

        const codeReader = new BrowserMultiFormatReader(hints);

        if (!videoRef.current) return;

        const constraints = {
          video: { facingMode: "environment" },
        };

        controlsRef.current = await codeReader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, err) => {
            if (result) {
              onBarcodeScanned(result.getText());
            }
            // Ignore NotFoundException from ZXing log spam
          },
        );
        setIsLoading(false);
      } catch (err: any) {
        handleCameraError(err);
      }
    };

    if (show) {
      setIsLoading(true);
      setError(null);
      stopScanners(); // Ensure we start clean

      // Feature Detection for Native BarcodeDetector
      if ("BarcodeDetector" in window) {
        window.BarcodeDetector.getSupportedFormats()
          .then((supportedFormats) => {
            // Check if our needed formats are supported.
            // EAN_13 is usually 'ean_13' in BarcodeDetector.
            const needs = ["ean_13", "ean_8"];
            const hasSupport = needs.some((f) => supportedFormats.includes(f));

            if (hasSupport || supportedFormats.length === 0) {
              // Some implementations might return empty array but still work for basics, or we assume support if API exists.
              // We'll try native.
              startNativeScanner();
            } else {
              startZxingScanner();
            }
          })
          .catch((e) => {
            console.warn(
              "BarcodeDetector exists but getSupportedFormats failed:",
              e,
            );
            startZxingScanner();
          });
      } else {
        startZxingScanner();
      }
    }

    return () => {
      mounted = false;
      stopScanners();
    };
  }, [show, onBarcodeScanned, onCameraError]);

  const handleAICapture = async () => {
    if (!videoRef.current) return;

    setIsProcessingAI(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas");

      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

      const code = await extractBarcodeFromImage(base64);

      if (code) {
        onBarcodeScanned(code);
      } else {
        alert(
          "Kunde inte hitta någon streckkod i bilden. Försök igen eller skriv in manuellt.",
        );
      }
    } catch (e) {
      console.error("AI capture failed:", e);
      alert("Ett fel uppstod vid bildanalysen.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-75 flex items-center justify-center z-[75] p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-modal-title"
    >
      <div className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-xl w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="barcode-scanner-modal-title"
            className="text-2xl font-semibold text-neutral-dark flex items-center"
          >
            <CameraIcon className="w-7 h-7 mr-2.5 text-primary" />
            Skanna Streckkod
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90"
            aria-label="Stäng skanner"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="relative w-full aspect-[4/3] bg-neutral-darker rounded-lg shadow-md mb-4 overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          ></video>

          {/* Viewfinder and instruction */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-white text-base font-semibold bg-black/50 px-3 py-1 rounded-md mb-2">
              Placera streckkoden i rutan
            </p>
            <div className="w-10/12 h-1/3 border-4 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div
                className="absolute left-0 w-full h-0.5 bg-red-500 shadow-[0_0_10px_2px_rgba(255,0,0,0.7)]"
                style={{
                  animation: "scan-line 2s ease-in-out infinite alternate",
                }}
              ></div>
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 bg-black/20 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mx-auto mb-3"></div>
              <p className="text-white text-lg bg-black bg-opacity-40 px-3 py-1 rounded">
                Startar kamera...
              </p>
            </div>
          )}

          {isProcessingAI && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20 bg-black/60 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white mx-auto mb-3"></div>
              <p className="text-white text-lg font-semibold">
                AI läser av bilden...
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-red-800 bg-opacity-80 text-white rounded-md text-center z-10">
              <p className="font-medium text-lg mb-1">Kamerafel:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Debug info - only in dev if needed, or hidden */}
          {usingNative && !isLoading && !error && (
            <div className="absolute top-2 left-2 pointer-events-none opacity-50">
              <span className="text-[10px] text-white bg-[#2B3B2C]/50 px-1 rounded">
                Native API
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <button
            onClick={handleAICapture}
            disabled={isLoading || isProcessingAI || !!error}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#D96E4A] hover:bg-[#C05A38] text-white font-bold rounded-lg shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            <Camera className="w-5 h-5" />
            Kan inte skanna? Fota koden (AI)
          </button>

          <button
            onClick={onScanFallback}
            className="inline-flex justify-center items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-primary-darker hover:underline focus:outline-none"
          >
            <FileText className="w-4 h-4" />
            Sök på näringsinnehåll istället
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full px-5 py-3 text-base font-semibold text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-lg shadow-sm active:scale-95"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
