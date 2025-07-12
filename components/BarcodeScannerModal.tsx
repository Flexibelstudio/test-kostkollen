import React, { useState, useEffect, useRef } from 'react';
import { CameraIcon, XMarkIcon } from './icons';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

interface BarcodeScannerModalProps {
  show: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  onCameraError: (errorMessage: string) => void;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ show, onClose, onBarcodeScanned, onCameraError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    if (show) {
      const codeReader = new BrowserMultiFormatReader();

      const startScanner = async () => {
        setIsLoading(true);
        setError(null);
        try {
          if (!videoRef.current) {
            throw new Error("Video element is not available.");
          }

          const constraints: MediaStreamConstraints = {
            video: {
              facingMode: 'environment'
            }
          };
          
          controlsRef.current = await codeReader.decodeFromConstraints(constraints, videoRef.current, (result, err) => {
            if (result) {
              onBarcodeScanned(result.getText());
            }
            if (err && err.name !== 'NotFoundException' && !err.message?.includes('No MultiFormat Readers')) {
              console.error("Barcode scanning error:", err);
            }
          });
          setIsLoading(false);

        } catch (err: any) {
          console.error("Camera access error for barcode scanner:", err);
          let userFriendlyError = "Kunde inte komma åt kameran.";
          if (err instanceof DOMException) {
              switch (err.name) {
                  case "NotAllowedError": userFriendlyError = "Åtkomst till kameran nekades. Ge behörighet i webbläsarens inställningar."; break;
                  case "NotFoundError": case "DevicesNotFoundError": userFriendlyError = "Ingen kamera hittades."; break;
                  case "NotReadableError": case "TrackStartError": userFriendlyError = "Kameran används redan av en annan app."; break;
                  case "OverconstrainedError": userFriendlyError = "Den bakre kameran kunde inte hittas eller startas."; break;
                  case "AbortError": userFriendlyError = "Kameraåtkomsten avbröts."; break;
                  case "SecurityError": userFriendlyError = "Kameraåtkomst blockerades av säkerhetsskäl (använd HTTPS)."; break;
                  default: userFriendlyError = `Ett oväntat kamerafel uppstod: ${err.message || err.name}.`;
              }
          } else if (err.message) {
              userFriendlyError = err.message;
          }
          setError(userFriendlyError);
          onCameraError(userFriendlyError);
          setIsLoading(false);
        }
      };

      startScanner();
    }

    return () => {
      // Cleanup when the modal is closed
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [show, onBarcodeScanned, onCameraError]);


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
          <h2 id="barcode-scanner-modal-title" className="text-2xl font-semibold text-neutral-dark flex items-center">
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
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover"></video>
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mx-auto mb-3"></div>
                <p className="text-white text-lg bg-black bg-opacity-40 px-3 py-1 rounded">Startar kamera...</p>
              </div>
            )}
             {error && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-red-800 bg-opacity-80 text-white rounded-md text-center z-10">
                <p className="font-medium text-lg mb-1">Kamerafel:</p>
                <p className="text-sm">{error}</p>
              </div>
            )}
             <div className="absolute inset-0 border-4 border-white/30 rounded-lg" style={{ clipPath: 'polygon(0% 0%, 0% 100%, 25% 100%, 25% 25%, 75% 25%, 75% 75%, 25% 75%, 25% 100%, 100% 100%, 100% 0%)' }}></div>
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