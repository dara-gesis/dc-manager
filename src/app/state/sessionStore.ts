// Session state remains in memory to avoid persisting credentials.
export type SessionState = {
  apiBaseUrl: string;
  repositoryId: string | null;
  password: string | null;
  clientName: string | null;
  prefixes: string[];
  authenticated: boolean;
};

type Listener = (state: SessionState) => void;

// Default API base can be overridden by environment configuration.
const defaultApiBase =
  import.meta.env.VITE_DEFAULT_API_BASE ?? 'https://api.test.datacite.org';

const state: SessionState = {
  apiBaseUrl: defaultApiBase,
  repositoryId: null,
  password: null,
  clientName: null,
  prefixes: [],
  authenticated: false
};

const listeners = new Set<Listener>();

// Lightweight store with a subscribe API for UI updates.
export const sessionStore = {
  getState(): SessionState {
    return { ...state, prefixes: [...state.prefixes] };
  },
  // Merge and notify subscribers on state changes.
  setState(partial: Partial<SessionState>): void {
    Object.assign(state, partial);
    listeners.forEach((listener) => listener(sessionStore.getState()));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  // Explicitly clear any sensitive values.
  clearCredentials(): void {
    state.repositoryId = null;
    state.password = null;
    state.clientName = null;
    state.prefixes = [];
    state.authenticated = false;
    listeners.forEach((listener) => listener(sessionStore.getState()));
  }
};
