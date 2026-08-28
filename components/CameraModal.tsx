import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CameraIcon, XMarkIcon, UploadIcon } from './icons.tsx'; 
import { startPhotoCapture, recordCaptureAndCompression } from '../utils/photoPipelineProfiler.ts'; 
import { prewarmConnections } from '../services/geminiService.ts';

interface CameraModalProps {
  show: boolean;
  onClose: () => void;
  onImageCapture: (imageDataUrl: string) => void;
  onCameraError: (errorMessage: string) => void;
  instructionText?: string;
  hideTip?: boolean;
}

const CameraModal: React.FC<CameraModalProps> = ({ show, onClose, onImageCapture, onCameraError, instructionText, hideTip }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  useEffect(() => {
    let isMountedAndEffectActive = true; 
    let currentStream: MediaStream | null = null; 

    const stopLocalStream = (streamToStop: MediaStream | null) => {
        if (streamToStop) {
            streamToStop.getTracks().forEach(track => track.stop());
        }
    };

    if (show) {
        // Värm upp anslutningar till Gemini-proxy och Firestore i bakgrunden så fort kameran öppnas
        prewarmConnections().catch(() => {});

        setIsCameraLoading(true);
        setCameraError(null); 
        setActiveStream(null);  

        if (videoRef.current && videoRef.current.srcObject) {
            if (videoRef.current.srcObject instanceof MediaStream) {
                 stopLocalStream(videoRef.current.srcObject as MediaStream);
            }
            videoRef.current.srcObject = null;
        }

        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                if (!isMountedAndEffectActive) {
                    stopLocalStream(stream); 
                    return Promise.reject(new Error("Camera effect instance no longer active."));
                }
                currentStream = stream; 

                if (!videoRef.current) {
                    return Promise.reject(new Error("Video element not available.")); 
                }

                if (!currentStream.active || currentStream.getTracks().length === 0) {
                    return Promise.reject(new Error("Kameraströmmen är ogiltig eller tom.")); 
                }
                
                videoRef.current.srcObject = currentStream;
                return videoRef.current.play();
            })
            .then(() => { 
                if (!isMountedAndEffectActive) {
                    setActiveStream(null); 
                    return; 
                }
                setActiveStream(currentStream);
            })
            .catch(err => {
                if (!isMountedAndEffectActive) {
                    if (!(err instanceof Error && err.message === "Camera effect instance no longer active.")) {
                        console.warn("Camera operation failed after effect instance became inactive:", err);
                    }
                    stopLocalStream(currentStream); 
                    return; 
                }

                console.error("Error during camera initialization or playback:", err);
                let userFriendlyError = "Kameran kunde inte nås eller startas.";
                if (err instanceof DOMException) {
                    switch (err.name) {
                        case "NotAllowedError": userFriendlyError = "Åtkomst till kameran nekades. Ge behörighet i webbläsarens inställningar och ladda om sidan."; break;
                        case "NotFoundError": case "DevicesNotFoundError": userFriendlyError = "Ingen kamera hittades. Kontrollera att en kamera är ansluten och fungerar."; break;
                        case "NotReadableError": case "TrackStartError": userFriendlyError = "Kameran används redan av en annan applikation eller så uppstod ett hårdvarufel med kameran."; break;
                        case "OverconstrainedError": userFriendlyError = "Kameran stöder inte de begärda inställningarna (t.ex. bakre kamera om sådan saknas, eller specifik upplösning)."; break;
                        case "AbortError": userFriendlyError = "Kameraåtkomsten avbröts. Detta kan hända om en annan enhet med högre prioritet behövde kameran."; break;
                        case "SecurityError": userFriendlyError = "Kameraåtkomst blockerades på grund av säkerhetsinställningar. Se till att sidan körs över en säker anslutning (HTTPS) eller att inga policys blockerar åtkomsten."; break;
                        default: userFriendlyError = `Ett oväntat kamerafel uppstod: ${err.message || err.name}. Kontrollera webbläsarbehörigheter.`;
                    }
                } else if (err instanceof Error && err.message) {
                    if (err.message === "Video element not available." || err.message === "Kameraströmmen är ogiltig eller tom.") {
                        userFriendlyError = err.message;
                    } else {
                        userFriendlyError = `Ett kamerafel uppstod: ${err.message}.`;
                    }
                }
                
                setCameraError(userFriendlyError);
                onCameraError(userFriendlyError);
                setActiveStream(null);
                stopLocalStream(currentStream);
            })
            .finally(() => {
                if (isMountedAndEffectActive) {
                    setIsCameraLoading(false);
                } else if (!show) { 
                    setIsCameraLoading(false);
                }
            });
    }

    return () => {
        isMountedAndEffectActive = false;
        stopLocalStream(currentStream); 
        currentStream = null;
        
        if (!show) {
           setIsCameraLoading(false);
           setCameraError(null);
           setActiveStream(null);
        }
    }; 
  }, [show, onCameraError]);

  /**
   * Bild ur telefonens album.
   *
   * Gar igenom exakt samma krympning och komprimering som kamerabilden: en
   * modern mobilbild ar 12 megapixel och flera megabyte, och skickas den rakt
   * in blir bade uppladdningen och analysen langsam.
   *
   * Bilder ur albumet bar dessutom ofta en EXIF-flagga for rotation. Darfor
   * createImageBitmap med imageOrientation 'from-image' - annars kan maten
   * komma in liggande, och da har modellen betydligt svarare att kanna igen
   * vad den ser.
   */
  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Nollstall direkt sa att samma bild kan valjas igen efter ett avbrott.
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const msg = 'Filen verkar inte vara en bild. Välj ett foto ur albumet.';
      setCameraError(msg);
      onCameraError(msg);
      return;
    }

    setIsProcessingFile(true);
    startPhotoCapture();

    try {
      let source: ImageBitmap | HTMLImageElement;
      let sourceWidth: number;
      let sourceHeight: number;

      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        source = bitmap;
        sourceWidth = bitmap.width;
        sourceHeight = bitmap.height;
      } else {
        // Aldre webblasare: las in via en img i stallet.
        const objectUrl = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Bilden kunde inte läsas.'));
          el.src = objectUrl;
        });
        URL.revokeObjectURL(objectUrl);
        source = img;
        sourceWidth = img.naturalWidth;
        sourceHeight = img.naturalHeight;
      }

      const tCaptureEnd = performance.now();

      const MAX_SIZE = 800;
      let width = sourceWidth;
      let height = sourceHeight;

      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round(height * (MAX_SIZE / width));
          width = MAX_SIZE;
        }
      } else if (height > MAX_SIZE) {
        width = Math.round(width * (MAX_SIZE / height));
        height = MAX_SIZE;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Kunde inte bearbeta bilden.');

      context.drawImage(source as CanvasImageSource, 0, 0, width, height);
      if ('close' in source && typeof (source as ImageBitmap).close === 'function') {
        (source as ImageBitmap).close();
      }

      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      const tCompressEnd = performance.now();
      const base64Data = imageDataUrl.split(',')[1] || '';

      recordCaptureAndCompression({
        tCaptureEnd,
        tCompressEnd,
        rawDimensions: { width: sourceWidth, height: sourceHeight },
        rawImageSizeBytes: file.size,
        compressedDimensions: { width, height },
        compressedImageSizeBytes: Math.round(base64Data.length * 0.75),
      });

      onImageCapture(base64Data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bilden kunde inte läsas in.';
      setCameraError(msg);
      onCameraError(msg);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleCapture = () => {
    // Starta mätning av Steg 1: Från att användaren trycker på kameraknappen till att bilden är tagen
    startPhotoCapture();
    const tCaptureStart = performance.now();

    if (videoRef.current && activeStream && activeStream.active && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA ) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const tCaptureEnd = performance.now();
        const rawImageSizeBytes = canvas.width * canvas.height * 4; // Rå oberoende bitmap-storlek (RGBA) i bytes
        
        // --- START OF NEW RESIZING LOGIC ---
        const MAX_SIZE = 800; // Max width/height
        let { width, height } = canvas;

        if (width > height) {
            if (width > MAX_SIZE) {
                height = Math.round(height * (MAX_SIZE / width));
                width = MAX_SIZE;
            }
        } else {
            if (height > MAX_SIZE) {
                width = Math.round(width * (MAX_SIZE / height));
                height = MAX_SIZE;
            }
        }

        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = width;
        resizeCanvas.height = height;
        const resizeContext = resizeCanvas.getContext('2d');

        if (resizeContext) {
            resizeContext.drawImage(canvas, 0, 0, width, height);
            const imageDataUrl = resizeCanvas.toDataURL('image/jpeg', 0.75); // 75% quality JPEG
            const tCompressEnd = performance.now();
            const base64Data = imageDataUrl.split(',')[1] || '';
            const compressedImageSizeBytes = Math.round(base64Data.length * 0.75);

            recordCaptureAndCompression({
              tCaptureEnd,
              tCompressEnd,
              rawDimensions: { width: canvas.width, height: canvas.height },
              rawImageSizeBytes,
              compressedDimensions: { width, height },
              compressedImageSizeBytes,
            });

            onImageCapture(base64Data);
        } else {
            // Fallback to original if resize context fails
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85); // A bit higher quality if not resizing
            const tCompressEnd = performance.now();
            const base64Data = imageDataUrl.split(',')[1] || '';
            const compressedImageSizeBytes = Math.round(base64Data.length * 0.75);

            recordCaptureAndCompression({
              tCaptureEnd,
              tCompressEnd,
              rawDimensions: { width: canvas.width, height: canvas.height },
              rawImageSizeBytes,
              compressedDimensions: { width: canvas.width, height: canvas.height },
              compressedImageSizeBytes,
            });

            onImageCapture(base64Data);
        }
        // --- END OF NEW RESIZING LOGIC ---
      } else {
        const errorMsg = "Kunde inte skapa bilddata från kameran (canvas context).";
        setCameraError(errorMsg);
        onCameraError(errorMsg);
      }
    } else {
        const errorMsg = "Kan inte ta bild, kameraströmmen är inte aktiv eller tillgänglig.";
        setCameraError(errorMsg);
        onCameraError(errorMsg);
    }
  };

  if (!show) {
    return null;
  }

  return createPortal(
    <div 
        className="fixed inset-0 bg-neutral-dark bg-opacity-75 flex items-center justify-center z-[120] p-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-modal-title"
    >
      <div className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-xl w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 id="camera-modal-title" className="text-2xl font-semibold text-neutral-dark flex items-center">
            <CameraIcon className="w-7 h-7 mr-2.5 text-primary" />
            Lägg till bild
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90"
            aria-label="Stäng kamerafönstret"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="relative w-full aspect-[3/4] sm:aspect-[9/16] max-h-[70vh] bg-neutral-darker rounded-lg shadow-md mb-4 overflow-hidden">
            <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${(isCameraLoading || !!cameraError) ? 'opacity-0' : 'opacity-100'}`}
                playsInline 
                muted 
                autoPlay 
                aria-label="Kameravy"
                aria-hidden={isCameraLoading || !!cameraError}
            />
             {!isCameraLoading && !cameraError && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-11/12 pointer-events-none flex flex-col gap-2">
                  <p className="text-white text-base font-semibold bg-black/50 px-3 py-1 rounded-md text-center">
                      {instructionText || 'Placera maten i rutan och ta en bild'}
                  </p>
                  {!hideTip && (
                    <p className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-md text-center">
                        💡 Tips: Ha gärna med bestick i bilden så AI:n lättare kan bedöma portionsstorleken.
                    </p>
                  )}
              </div>
            )}
            {isCameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mx-auto mb-3"></div>
                <p className="text-white text-lg bg-black bg-opacity-40 px-3 py-1 rounded">Startar kamera...</p>
              </div>
            )}
            {cameraError && !isCameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-red-800 bg-opacity-80 text-white rounded-md text-center z-10">
                <p className="font-medium text-lg mb-1">Kamerafel:</p>
                <p className="text-sm">{cameraError}</p>
              </div>
            )}
        </div>
        
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
            <button
                onClick={onClose}
                className="flex-1 px-5 py-3 text-base font-semibold text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral active:scale-95"
                aria-label="Avbryt och stäng kamera"
            >
                Avbryt
            </button>
            <button
                onClick={handleCapture}
                disabled={isCameraLoading || !!cameraError || !activeStream || !activeStream.active || isProcessingFile}
                className="flex-1 px-5 py-3 text-base font-semibold text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral"
                aria-label="Ta bild med kameran"
            >
                <CameraIcon className="w-5 h-5 inline mr-2" />
                Ta bild
            </button>
          </div>

          {/* Album-valet ar med flit INTE beroende av kameran. Nekas
              kamerabehorighet, eller sitter man vid en dator utan kamera, ar
              det har vagen vidare i stallet for en atervandsgrand. */}
          <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="w-full px-5 py-3 text-base font-semibold text-primary bg-white border-2 border-primary hover:bg-[#F6E2D9] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Välj en bild från albumet"
          >
              <UploadIcon className="w-5 h-5 inline mr-2" />
              {isProcessingFile ? 'Läser in bilden…' : 'Välj bild från album'}
          </button>

          <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileSelected}
              className="hidden"
              aria-hidden="true"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CameraModal;