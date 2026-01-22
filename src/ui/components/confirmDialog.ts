// Confirm dialog built on Bootstrap modals for destructive actions.
import { Modal } from 'bootstrap';

// Render a temporary modal and resolve a boolean based on user choice.
export const confirmDialog = (options: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}): Promise<boolean> => {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'modal fade';
    dialog.tabIndex = -1;
    dialog.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header ${options.variant === 'danger' ? 'bg-danger text-white' : ''}">
            <h5 class="modal-title">${options.title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>${options.message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              ${options.cancelLabel ?? 'Cancel'}
            </button>
            <button type="button" class="btn btn-${options.variant ?? 'primary'}" data-confirm="true">
              ${options.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    // Use a static backdrop to prevent accidental dismissals.
    const modal = new Modal(dialog, { backdrop: 'static' });
    let resolved = false;
    const cleanup = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      modal.hide();
      dialog.remove();
      resolve(result);
    };

    dialog.addEventListener('hidden.bs.modal', () => cleanup(false), { once: true });
    dialog.querySelector('[data-confirm]')?.addEventListener('click', () => cleanup(true));

    modal.show();
  });
};
