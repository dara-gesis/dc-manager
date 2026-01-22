// UI state container for view-only flags like loading states.
export type UiState = {
  loading: Record<string, boolean>;
};

type Listener = (state: UiState) => void;

const state: UiState = {
  loading: {}
};

const listeners = new Set<Listener>();

// Minimal state store to avoid tight coupling between components.
export const uiStore = {
  getState(): UiState {
    return { ...state, loading: { ...state.loading } };
  },
  // Track per-feature loading flags.
  setLoading(key: string, value: boolean): void {
    state.loading[key] = value;
    listeners.forEach((listener) => listener(uiStore.getState()));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
