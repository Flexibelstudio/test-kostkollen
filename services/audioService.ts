import { Mutex } from 'async-mutex';

export type SoundKey = 'logSuccess' | 'levelUp';

const soundFiles: Record<SoundKey, string> = {
  logSuccess: 'sounds/success_ding.mp3',
  levelUp: 'sounds/level_up.mp3',
};

const audioBuffers: Partial<Record<SoundKey, AudioBuffer>> = {};
let audioCtx: AudioContext | null = null;
const audioInitMutex = new Mutex();
let isAudioInitialized = false; // Tracks if initAudio has run and context became running with sounds loaded
let isLoadingSounds = false;

function getAudioContext(): AudioContext | null {
  if (audioCtx) {
    return audioCtx;
  }
  if (typeof window !== 'undefined') {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      return audioCtx;
    } catch (e) {
      console.error("Web Audio API is not supported in this browser.", e);
      return null;
    }
  }
  return null;
}

async function loadSound(context: AudioContext, soundUrl: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(soundUrl);
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await context.decodeAudioData(arrayBuffer);
    return decodedBuffer;
  } catch (_error) {
    // Fail silently when sound files are missing or unparseable
    return null;
  }
}

export async function initAudio(): Promise<boolean> {
  // Check if already initialized
  const localAudioCtxForCheck = getAudioContext();
  const allSoundsListedAsLoadedPreCheck = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
  if (isAudioInitialized && localAudioCtxForCheck && localAudioCtxForCheck.state === 'running' && allSoundsListedAsLoadedPreCheck) {
    return true;
  }

  // If another call is already in the process of loading, wait for it
  if (isLoadingSounds) {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (!isLoadingSounds) {
          clearInterval(interval);
          const currentCtx = getAudioContext();
          const soundsNowLoaded = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
          resolve(isAudioInitialized && currentCtx !== null && currentCtx.state === 'running' && soundsNowLoaded);
        }
      }, 100);
    });
  }

  return audioInitMutex.runExclusive(async () => {
    const localAudioCtxForMutexCheck = getAudioContext();
    const allSoundsListedAsLoadedMutexCheck = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
    if (isAudioInitialized && localAudioCtxForMutexCheck && localAudioCtxForMutexCheck.state === 'running' && allSoundsListedAsLoadedMutexCheck) {
      return true;
    }
    
    isLoadingSounds = true;
    try {
      const localAudioCtx = getAudioContext();
      if (!localAudioCtx) {
        isAudioInitialized = false;
        return false;
      }

      if (localAudioCtx.state === 'suspended') {
        try {
          await localAudioCtx.resume();
        } catch (_e) {
          // Ignore failure if user interaction is needed
        }
      }

      const soundLoadPromises: Promise<void>[] = [];
      for (const key in soundFiles) {
        const soundName = key as SoundKey;
        if (!audioBuffers.hasOwnProperty(soundName)) {
          soundLoadPromises.push(
            loadSound(localAudioCtx, soundFiles[soundName]).then(buffer => {
              // Store buffer or null (sentinel indicating attempt was made)
              audioBuffers[soundName] = buffer ?? undefined;
              // Ensure key exists in object
              if (buffer === null) {
                (audioBuffers as any)[soundName] = null;
              }
            })
          );
        }
      }
      await Promise.all(soundLoadPromises);

      const finalAllSoundsLoaded = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
      isAudioInitialized = localAudioCtx.state === 'running' && finalAllSoundsLoaded;
      return isAudioInitialized;

    } catch (_error) { 
        isAudioInitialized = false;
        return false;
    } finally {
      isLoadingSounds = false;
    }
  });
}

export async function playAudio(soundName: SoundKey, volume: number = 1): Promise<void> {
  try {
    if (localStorage.getItem('isSoundMuted') === 'true') {
      return;
    }
  } catch (_e) {
    // Ignore localStorage errors
  }

  const localAudioCtx = getAudioContext();
  if (!localAudioCtx) {
    return;
  }

  if (localAudioCtx.state !== 'running' || !audioBuffers.hasOwnProperty(soundName) || !isAudioInitialized) {
    await initAudio();
  }

  if (localAudioCtx.state === 'running') {
    const buffer = audioBuffers[soundName];
    if (!buffer) {
       // Missing sound buffer - stay completely silent
       return;
    }

    try {
      const source = localAudioCtx.createBufferSource();
      source.buffer = buffer;
      const gainNode = localAudioCtx.createGain();
      gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), localAudioCtx.currentTime);
      source.connect(gainNode);
      gainNode.connect(localAudioCtx.destination);
      source.start(0);
    } catch (_error) {
      // Fail silently
    }
  }
}

// Initial, silent attempt to load sounds and prepare AudioContext.
if (typeof window !== 'undefined') {
    initAudio().catch(e => console.error("Error during initial silent audio init:", e));
}