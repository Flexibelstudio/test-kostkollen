import { Mutex } from 'async-mutex';

export type SoundKey = 'uiClick' | 'logSuccess' | 'levelUp' | 'cameraShutter' | 'calorieBank';

const soundFiles: Record<SoundKey, string> = {
  uiClick: 'sounds/ui_click.mp3',
  logSuccess: 'sounds/success_ding.mp3',
  levelUp: 'sounds/level_up.mp3',
  cameraShutter: 'sounds/camera-shutter.mp3',
  calorieBank: 'sounds/coin_drop.wav',
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

// Function to create a simple fallback beep
function createFallbackBeep(context: AudioContext): AudioBuffer {
  const duration = 0.05; // 50ms beep
  const sampleRate = context.sampleRate;
  const numFrames = duration * sampleRate;
  const buffer = context.createBuffer(1, numFrames, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < numFrames; i++) {
    data[i] = Math.sin((2 * Math.PI * 880 * i) / sampleRate) * 0.3;
    if (i < numFrames * 0.1 || i > numFrames * 0.9) {
        data[i] *= (i < numFrames * 0.1 ? i / (numFrames * 0.1) : (numFrames - i) / (numFrames * 0.1));
    }
  }
  return buffer;
}

async function loadSound(context: AudioContext, soundUrl: string, soundName: SoundKey): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(soundUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sound: ${response.status} ${response.statusText} for ${soundUrl}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await context.decodeAudioData(arrayBuffer);
    return decodedBuffer;
  } catch (error) {
    console.error(`Error loading sound '${soundName}' from ${soundUrl}:`, error);
    console.warn(`Attempting to use fallback beep for '${soundName}'. Please ensure '${soundUrl}' exists and is accessible.`);
    return createFallbackBeep(context);
  }
}

export async function initAudio(): Promise<boolean> {
  // Check if already initialized and running
  const localAudioCtxForCheck = getAudioContext();
  const allSoundsListedAsLoadedPreCheck = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
  if (isAudioInitialized && localAudioCtxForCheck && localAudioCtxForCheck.state === 'running' && allSoundsListedAsLoadedPreCheck) {
    return true;
  }

  // If another call is already in the process of loading (i.e., inside the mutex block below), wait for it.
  if (isLoadingSounds) {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (!isLoadingSounds) { // Wait for the active loading to complete
          clearInterval(interval);
          const currentCtx = getAudioContext();
          const soundsNowLoaded = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
          resolve(isAudioInitialized && currentCtx !== null && currentCtx.state === 'running' && soundsNowLoaded);
        }
      }, 100);
    });
  }

  return audioInitMutex.runExclusive(async () => {
    // Re-check after acquiring mutex, in case another call completed initialization 
    // while this one was waiting for the mutex.
    const localAudioCtxForMutexCheck = getAudioContext(); // Get potentially new or resumed context
    const allSoundsListedAsLoadedMutexCheck = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
    if (isAudioInitialized && localAudioCtxForMutexCheck && localAudioCtxForMutexCheck.state === 'running' && allSoundsListedAsLoadedMutexCheck) {
      return true;
    }
    
    // Set isLoadingSounds true only when this instance actually starts loading.
    isLoadingSounds = true;
    try {
      const localAudioCtx = getAudioContext(); // Ensure we use the context instance for this execution.
      if (!localAudioCtx) {
        console.error("AudioContext could not be created. Audio will not play.");
        isAudioInitialized = false;
        return false;
      }

      if (localAudioCtx.state === 'suspended') {
        try {
          await localAudioCtx.resume();
        } catch (e) {
          console.warn("Could not resume AudioContext on initial init. User interaction might be needed.", e);
          // Continue, as it might become 'running' later or state check will handle it.
        }
      }

      const soundLoadPromises: Promise<void>[] = [];
      for (const key in soundFiles) {
        const soundName = key as SoundKey;
        if (!audioBuffers[soundName]) { // Load only if not already loaded
          soundLoadPromises.push(
            loadSound(localAudioCtx, soundFiles[soundName], soundName).then(buffer => {
              if (buffer) {
                audioBuffers[soundName] = buffer;
              }
            })
          );
        }
      }
      await Promise.all(soundLoadPromises);

      const finalAllSoundsLoaded = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));
      // isAudioInitialized depends on both context running and sounds loaded.
      isAudioInitialized = localAudioCtx.state === 'running' && finalAllSoundsLoaded;
      return isAudioInitialized;

    } catch (error) { 
        console.error("Critical error during audio initialization inside mutex:", error);
        isAudioInitialized = false;
        return false; // Return false on critical error.
    } finally {
      isLoadingSounds = false; // CRITICAL: Ensure this is always reset.
    }
  });
}

export async function playAudio(soundName: SoundKey, volume: number = 1): Promise<void> {
  const localAudioCtx = getAudioContext();
  if (!localAudioCtx) {
    console.warn(`Cannot play sound '${soundName}': AudioContext is null.`);
    return;
  }

  const isSpecificBufferMissing = !audioBuffers[soundName];
  const allKnownBuffersLoaded = Object.keys(soundFiles).every(key => audioBuffers.hasOwnProperty(key as SoundKey));

  if (localAudioCtx.state !== 'running' || isSpecificBufferMissing || !allKnownBuffersLoaded || !isAudioInitialized) {
    const initSuccessful = await initAudio();
    if (!initSuccessful) {
      console.warn(`Audio system initialization failed or was incomplete. Cannot play '${soundName}'. Context state: ${localAudioCtx.state}`);
      return;
    }
    // After successful init, isAudioInitialized should be true and localAudioCtx.state should be 'running'.
    // Re-check buffer, as initAudio loads all sounds
    if (!audioBuffers[soundName]) {
        console.error(`Sound buffer for '${soundName}' is still missing even after successful initAudio. Playback aborted.`);
        return;
    }
  }

  if (localAudioCtx.state === 'running') {
    const buffer = audioBuffers[soundName];
    if (!buffer) {
       console.error(`Buffer for ${soundName} is unexpectedly missing at playback stage. Playback aborted.`);
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
    } catch (error) {
      console.error(`Error playing sound '${soundName}':`, error);
    }
  } else {
    console.warn(`AudioContext is not in a running state ('${localAudioCtx.state}'). Cannot play sound '${soundName}'.`);
  }
}

// Initial, silent attempt to load sounds and prepare AudioContext.
if (typeof window !== 'undefined') {
    initAudio().catch(e => console.error("Error during initial silent audio init:", e));
}
