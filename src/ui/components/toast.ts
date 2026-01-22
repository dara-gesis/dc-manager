// Toast utilities for user-visible feedback.
import { UserFacingError } from '@/api/errors';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

type ToastOptions = {
  variant?: ToastVariant;
  title?: string;
  message: string;
  details?: string;
};

// Container is set once during init to avoid repeated lookups.
let container: HTMLElement | null = null;

// Cache the toast container element.
export const initToasts = (): void => {
  container = document.getElementById('toast-container');
};

// Render a toast message and auto-dismiss it after a short delay.
export const showToast = ({ variant = 'info', title, message, details }: ToastOptions): void => {
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast align-items-start text-bg-${variant} border-0 mb-2`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${title ? `<strong class="d-block mb-1">${title}</strong>` : ''}
        <div>${message}</div>
        ${details ? `<details class="mt-2"><summary>Details</summary><pre class="text-white mb-0">${details}</pre></details>` : ''}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(toast);
  const closeButton = toast.querySelector('button');
  closeButton?.addEventListener('click', () => toast.remove());
  setTimeout(() => toast.remove(), 8000);
};

// Normalize errors into user-facing toasts.
export const showErrorToast = (error: unknown, fallbackMessage: string): void => {
  if (error instanceof UserFacingError) {
    showToast({ variant: 'danger', title: 'Error', message: error.message, details: error.details });
    return;
  }
  if (error instanceof Error) {
    showToast({ variant: 'danger', title: 'Error', message: fallbackMessage, details: error.message });
    return;
  }
  showToast({ variant: 'danger', title: 'Error', message: fallbackMessage });
};
