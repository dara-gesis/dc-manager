// Centralized bootstrapping keeps feature initialization consistent and testable.
import { initAuth } from '@/features/auth/authController';
import { initDoiManager } from '@/features/doi-manager/doiTableController';
import { initEditorModal } from '@/features/doi-manager/editorModalController';
import { initBatchUpload } from '@/features/batch-upload/batchUploadController';
import { initAdvancedBatch } from '@/features/advanced-batch-update/advancedBatchController';
import { initToasts } from '@/ui/components/toast';
import { initModals } from '@/ui/components/modal';

export const bootstrapApp = (): void => {
  // Toasts and modals should be ready before any feature uses them.
  initToasts();
  initModals();
  // Feature controllers wire UI events to domain/API logic.
  initAuth();
  initDoiManager();
  initEditorModal();
  initBatchUpload();
  initAdvancedBatch();
};
