// Editor modal controller for JSON/XML updates.
import { closeModal } from '@/ui/components/modal';
import { showErrorToast, showToast } from '@/ui/components/toast';

import { saveJsonAttributes, saveXmlAttributes } from './doiActions';

// Context is kept to know which DOI/format is being edited.
type EditorContext = {
  doi: string;
  format: 'json' | 'xml';
  content: string;
};

let currentContext: EditorContext | null = null;

export const openEditor = (context: EditorContext): void => {
  // Store current DOI/format and populate the modal fields.
  currentContext = context;
  const title = document.getElementById('editorModalLabel');
  const textarea = document.getElementById('editor-modal-content') as HTMLTextAreaElement | null;
  if (title) title.textContent = `Edit ${context.format.toUpperCase()} Metadata`;
  if (textarea) textarea.value = context.content;
};

export const initEditorModal = (): void => {
  const textarea = document.getElementById('editor-modal-content') as HTMLTextAreaElement | null;
  const copyButton = document.getElementById('editorCopyBtn') as HTMLButtonElement | null;
  const updateButton = document.getElementById('editorUpdateBtn') as HTMLButtonElement | null;

  if (!textarea || !copyButton || !updateButton) return;

  copyButton.addEventListener('click', async () => {
    // Clipboard copy provides quick sharing of metadata for debugging.
    await navigator.clipboard.writeText(textarea.value);
    showToast({ variant: 'info', message: 'Copied to clipboard.' });
  });

  updateButton.addEventListener('click', async () => {
    if (!currentContext) return;
    try {
      // Choose save method based on format.
      if (currentContext.format === 'json') {
        await saveJsonAttributes(currentContext.doi, textarea.value);
      } else {
        await saveXmlAttributes(currentContext.doi, textarea.value);
      }
      showToast({ variant: 'success', message: `Updated ${currentContext.doi}.` });
      closeModal('editorModal');
    } catch (error) {
      showErrorToast(error, 'Failed to update DOI.');
    }
  });
};
