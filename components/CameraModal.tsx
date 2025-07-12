
import React, { useState, useEffect, useRef } from 'react';
import { CameraIcon, XMarkIcon } from './icons.tsx'; 
import { playAudio } from '../services/audioService.ts'; // Import the new audio service

interface CameraModalProps {
  show: boolean;
  onClose: () => void;
  onImageCapture: (imageDataUrl: string) => void;
  onCameraError: (errorMessage: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ show, onClose, onImageCapture, onCameraError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null); 

  useEffect(() => {
    let isMountedAndEffectActive = true; 
    let currentStream: MediaStream | null = null; 

    const stopLocalStream = (streamToStop: MediaStream | null) => {
        if (streamToStop) {
            streamToStop.getTracks().forEach(track => track.stop());
        }
    };

    if (show) {
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

  const handleCapture = () => {
    if (videoRef.current && activeStream && activeStream.active && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA ) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        playAudio('cameraShutter'); // Play shutter sound using new service
        onImageCapture(imageDataUrl.split(',')[1]);
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

  return (
    <div 
        className="fixed inset-0 bg-neutral-dark bg-opacity-75 flex items-center justify-center z-[75] p-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-modal-title"
    >
      <div className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-xl w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 id="camera-modal-title" className="text-2xl font-semibold text-neutral-dark flex items-center">
            <CameraIcon className="w-7 h-7 mr-2.5 text-primary" />
            Använd kamera
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90"
            aria-label="Stäng kamerafönstret"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] bg-neutral-darker rounded-lg shadow-md mb-4 overflow-hidden">
            <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${(isCameraLoading || !!cameraError) ? 'opacity-0' : 'opacity-100'}`}
                playsInline 
                muted 
                autoPlay 
                aria-label="Kameravy"
                aria-hidden={isCameraLoading || !!cameraError}
            />
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
                disabled={isCameraLoading || !!cameraError || !activeStream || !activeStream.active}
                className="flex-1 px-5 py-3 text-base font-semibold text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral"
                aria-label="Ta bild med kameran"
            >
                <CameraIcon className="w-5 h-5 inline mr-2" />
                Ta bild
            </button>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
