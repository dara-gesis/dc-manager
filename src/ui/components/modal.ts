// Modal registry to centralize Bootstrap modal instances.
import { Modal } from 'bootstrap';

const modalRegistry = new Map<string, Modal>();

// Initialize all modal elements found in the DOM.
export const initModals = (): void => {
  document.querySelectorAll<HTMLElement>('.modal').forEach((element) => {
    // Static backdrop prevents accidental dismissal during edits.
    const modal = new Modal(element, { backdrop: 'static' });
    modalRegistry.set(element.id, modal);

    // Return focus to the triggering element for accessibility.
    element.addEventListener('hidden.bs.modal', () => {
      const trigger = document.querySelector<HTMLElement>(`[data-modal-trigger="${element.id}"]`);
      trigger?.focus();
    });
  });
};

// Programmatically open a modal by id.
export const openModal = (id: string): void => {
  modalRegistry.get(id)?.show();
};

// Programmatically close a modal by id.
export const closeModal = (id: string): void => {
  modalRegistry.get(id)?.hide();
};
