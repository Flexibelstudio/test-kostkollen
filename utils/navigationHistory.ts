import { ViewMode } from '../types';

export interface AppHistoryState {
  view: ViewMode;
  tab?: string;
  journeyTab?: 'calendar' | 'profile' | 'achievements';
  communityTab?: 'flode' | 'hantera' | 'chatt';
  communitySubTab?: 'buddies' | 'search' | 'requests';
  courseId?: string | null;
  lessonId?: string | null;
  modal?: string | null;
  timestamp: number;
}

export type HistoryChangeListener = (state: AppHistoryState) => void;

const listeners = new Set<HistoryChangeListener>();
let isInitialized = false;

export function getCurrentHistoryState(): AppHistoryState | null {
  if (typeof window === 'undefined') return null;
  return (window.history.state && window.history.state.appState) || null;
}

function isStateEqual(a: AppHistoryState, b: Partial<AppHistoryState>): boolean {
  if (b.view && a.view !== b.view) return false;
  if (b.tab !== undefined && a.tab !== b.tab) return false;
  if (b.journeyTab !== undefined && a.journeyTab !== b.journeyTab) return false;
  if (b.communityTab !== undefined && a.communityTab !== b.communityTab) return false;
  if (b.communitySubTab !== undefined && a.communitySubTab !== b.communitySubTab) return false;
  if (b.courseId !== undefined && a.courseId !== b.courseId) return false;
  if (b.lessonId !== undefined && a.lessonId !== b.lessonId) return false;
  if (b.modal !== undefined && a.modal !== b.modal) return false;
  return true;
}

/**
 * Initializes the history stack at the start view / bottom of history.
 * Ensures the start view is the history bottom so pressing back exits appropriately.
 */
export function initAppHistory(initialState: Partial<AppHistoryState>): AppHistoryState {
  if (typeof window === 'undefined') {
    return {
      view: initialState.view || 'main',
      timestamp: Date.now(),
      ...initialState
    };
  }

  const existing = getCurrentHistoryState();
  const state: AppHistoryState = {
    view: existing?.view || initialState.view || 'main',
    tab: existing?.tab || initialState.tab,
    journeyTab: existing?.journeyTab || initialState.journeyTab,
    communityTab: existing?.communityTab || initialState.communityTab,
    communitySubTab: existing?.communitySubTab || initialState.communitySubTab,
    courseId: existing?.courseId ?? initialState.courseId ?? null,
    lessonId: existing?.lessonId ?? initialState.lessonId ?? null,
    modal: existing?.modal ?? initialState.modal ?? null,
    timestamp: existing?.timestamp || Date.now()
  };

  // Replace current history entry with this validated root state
  try {
    window.history.replaceState({ appState: state }, '', window.location.href);
  } catch (e) {
    console.warn('Could not replaceState on initAppHistory:', e);
  }

  if (!isInitialized) {
    window.addEventListener('popstate', handlePopStateEvent);
    isInitialized = true;
  }

  return state;
}

/**
 * Pushes a new view state to browser history.
 */
export function pushViewState(state: Partial<AppHistoryState>): void {
  if (typeof window === 'undefined') return;

  const current = getCurrentHistoryState() || {
    view: 'main',
    timestamp: Date.now()
  };

  const newState: AppHistoryState = {
    view: state.view || current.view || 'main',
    journeyTab: state.journeyTab !== undefined ? state.journeyTab : (state.view === 'journey' ? current.journeyTab : undefined),
    communityTab: state.communityTab !== undefined ? state.communityTab : (state.view === 'community' ? current.communityTab : undefined),
    communitySubTab: state.communitySubTab !== undefined ? state.communitySubTab : (state.view === 'community' ? current.communitySubTab : undefined),
    courseId: state.courseId !== undefined ? state.courseId : (state.view === 'courseOverview' || state.view === 'lessonDetail' ? current.courseId : null),
    lessonId: state.lessonId !== undefined ? state.lessonId : (state.view === 'lessonDetail' ? current.lessonId : null),
    modal: state.modal !== undefined ? state.modal : null,
    timestamp: Date.now()
  };

  if (isStateEqual(current, newState) && current.modal === newState.modal) {
    return;
  }

  try {
    window.history.pushState({ appState: newState }, '', window.location.href);
  } catch (e) {
    console.warn('Could not pushState:', e);
  }
}

/**
 * Replaces current state in browser history without adding a new stack entry.
 */
export function replaceViewState(state: Partial<AppHistoryState>): void {
  if (typeof window === 'undefined') return;

  const current = getCurrentHistoryState() || {
    view: 'main',
    timestamp: Date.now()
  };

  const newState: AppHistoryState = {
    ...current,
    ...state,
    timestamp: Date.now()
  };

  try {
    window.history.replaceState({ appState: newState }, '', window.location.href);
  } catch (e) {
    console.warn('Could not replaceState:', e);
  }
}

/**
 * Pushes a modal onto the history stack.
 */
export function pushModalState(modalName: string): void {
  if (typeof window === 'undefined') return;

  const current = getCurrentHistoryState() || {
    view: 'main',
    timestamp: Date.now()
  };

  if (current.modal === modalName) return;

  const newState: AppHistoryState = {
    ...current,
    modal: modalName,
    timestamp: Date.now()
  };

  try {
    window.history.pushState({ appState: newState }, '', window.location.href);
  } catch (e) {
    console.warn('Could not pushModalState:', e);
  }
}

/**
 * Replaces the current modal in the history stack (e.g. Camera -> ImageAnalysisResult).
 */
export function replaceModalState(modalName: string): void {
  if (typeof window === 'undefined') return;

  const current = getCurrentHistoryState() || {
    view: 'main',
    timestamp: Date.now()
  };

  const newState: AppHistoryState = {
    ...current,
    modal: modalName,
    timestamp: Date.now()
  };

  try {
    window.history.replaceState({ appState: newState }, '', window.location.href);
  } catch (e) {
    console.warn('Could not replaceModalState:', e);
  }
}

/**
 * Closes a modal: if it's currently on top of the history stack, navigates back in history.
 * Otherwise, triggers fallback local callback.
 */
export function closeModalState(modalName?: string | null, fallbackClose?: () => void): void {
  if (typeof window === 'undefined') {
    if (fallbackClose) fallbackClose();
    return;
  }

  const current = getCurrentHistoryState();
  if (modalName && current?.modal === modalName) {
    window.history.back();
  } else if (!modalName && current?.modal) {
    window.history.back();
  } else {
    if (fallbackClose) fallbackClose();
  }
}

function handlePopStateEvent(event: PopStateEvent): void {
  const state: AppHistoryState = event.state?.appState || {
    view: 'main',
    modal: null,
    timestamp: Date.now()
  };

  listeners.forEach(listener => {
    try {
      listener(state);
    } catch (e) {
      console.error('Error in history listener:', e);
    }
  });
}

export function subscribeToHistory(listener: HistoryChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
