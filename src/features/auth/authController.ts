// Auth controller wires the login UI to the API client and session store.
import { sessionStore } from '@/app/state/sessionStore';
import { DataCiteClient } from '@/api/dataciteClient';
import { UserFacingError } from '@/api/errors';
import { showErrorToast, showToast } from '@/ui/components/toast';
import { toggleSpinner } from '@/ui/components/spinner';

import { showAppView, showLoginView, updateHeader } from './authView';

// Single client instance keeps credentials in-memory for the session.
const client = new DataCiteClient({ apiBaseUrl: sessionStore.getState().apiBaseUrl });

export const getClient = (): DataCiteClient => client;

// Update session store and switch between login/app views.
const updateSession = (authenticated: boolean, overrides?: Partial<ReturnType<typeof sessionStore.getState>>) => {
  sessionStore.setState({ authenticated, ...overrides });
  updateHeader();
  if (authenticated) {
    showAppView();
  } else {
    showLoginView();
  }
};

export const initAuth = (): void => {
  const loginButton = document.getElementById('loginBtn') as HTMLButtonElement | null;
  const logoutButton = document.getElementById('logoutBtn') as HTMLButtonElement | null;
  const apiBaseSelect = document.getElementById('api_base') as HTMLSelectElement | null;
  const repositoryInput = document.getElementById('repositoryId') as HTMLInputElement | null;
  const passwordInput = document.getElementById('password') as HTMLInputElement | null;

  if (!loginButton || !logoutButton || !apiBaseSelect || !repositoryInput || !passwordInput) return;

  // Reflect the configured default API in the UI selector.
  apiBaseSelect.value = sessionStore.getState().apiBaseUrl;

  // Start in the login view until the user authenticates.
  updateSession(false);

  loginButton.addEventListener('click', async () => {
    // Pull credentials from the form; never store them outside memory.
    const apiBaseUrl = apiBaseSelect.value;
    const repositoryId = repositoryInput.value.trim();
    const password = passwordInput.value;

    if (!repositoryId || !password) {
      showToast({ variant: 'warning', message: 'Repository ID and password are required.' });
      return;
    }

    // Provide immediate visual feedback while authenticating.
    toggleSpinner(loginButton, true);

    try {
      client.setApiBaseUrl(apiBaseUrl);
      client.setCredentials(repositoryId, password);
      const response = await client.login(repositoryId);
      if (!response?.data?.attributes?.hasPassword) {
        throw new UserFacingError('Authentication failed.', 'Password missing or invalid.');
      }
      // Store prefixes so the filters can be pre-populated.
      const prefixes = response.data.relationships?.prefixes?.data?.map((item) => item.id) ?? [];
      sessionStore.setState({
        apiBaseUrl,
        repositoryId,
        password,
        clientName: response.data.attributes.name,
        prefixes,
        authenticated: true
      });
      updateSession(true);
      showToast({ variant: 'success', message: 'Login successful.' });
    } catch (error) {
      showErrorToast(error, 'Login failed.');
      // Clear credentials on any auth failure.
      sessionStore.clearCredentials();
      updateSession(false);
    } finally {
      toggleSpinner(loginButton, false);
    }
  });

  logoutButton.addEventListener('click', () => {
    // Explicit logout clears in-memory credentials.
    sessionStore.clearCredentials();
    client.setCredentials(null, null);
    updateSession(false);
    showToast({ variant: 'info', message: 'Logged out.' });
  });
};
