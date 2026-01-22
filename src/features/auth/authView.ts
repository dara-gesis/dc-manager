import { sessionStore } from '@/app/state/sessionStore';

export const showLoginView = (): void => {
  document.getElementById('login-view')?.classList.remove('d-none');
  document.getElementById('app-view')?.classList.add('d-none');
};

export const showAppView = (): void => {
  document.getElementById('login-view')?.classList.add('d-none');
  document.getElementById('app-view')?.classList.remove('d-none');
};

export const updateHeader = (): void => {
  const state = sessionStore.getState();
  const header = document.getElementById('user-info-header');
  const logoutBtn = document.getElementById('logoutBtn');
  if (!header || !logoutBtn) return;

  if (state.authenticated && state.repositoryId) {
    header.textContent = `Logged in as ${state.clientName ?? state.repositoryId}`;
    logoutBtn.classList.remove('d-none');
  } else {
    header.textContent = 'Not logged in.';
    logoutBtn.classList.add('d-none');
  }
};
