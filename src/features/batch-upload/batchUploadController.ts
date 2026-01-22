// Batch upload controller for JSON/XML metadata.
import { getClient } from '@/features/auth/authController';
import { createDataTable } from '@/ui/adapters/datatablesAdapter';
import { showErrorToast, showToast } from '@/ui/components/toast';
import { appendLog } from '@/utils/logging';

import { parseUploadFiles } from './batchUploadParser';

// Keep a reference to the results table to allow rerenders.
let resultsTable: DataTables.Api | null = null;

export const initBatchUpload = (): void => {
  const fileInput = document.getElementById('upload_files_input') as HTMLInputElement | null;
  const eventSelect = document.getElementById('upload_event_select') as HTMLSelectElement | null;
  const startButton = document.getElementById('start_upload_btn') as HTMLButtonElement | null;
  const logArea = document.getElementById('upload_status_log') as HTMLElement | null;
  const resultsArea = document.getElementById('upload_results_area') as HTMLElement | null;
  const resultsTableElement = document.getElementById('upload_results_table') as HTMLTableElement | null;

  if (!fileInput || !eventSelect || !startButton || !logArea || !resultsArea || !resultsTableElement) return;

  fileInput.addEventListener('change', () => {
    // Enable the upload button only when files are selected.
    startButton.disabled = !fileInput.files?.length;
  });

  startButton.addEventListener('click', async () => {
    if (!fileInput.files?.length) return;
    logArea.textContent = '';
    resultsArea.style.display = 'none';
    startButton.disabled = true;

    try {
      const client = getClient();
      // Parse file contents before making API calls.
      const items = await parseUploadFiles(fileInput.files);
      appendLog(logArea, `Starting upload of ${items.length} file(s).\n`);

      const results: Array<{ doi: string; status: string }> = [];
      for (const item of items) {
        if (item.type === 'json') {
          const doi = item.attributes.doi ?? 'Unknown';
          appendLog(logArea, `Processing ${doi}...\n`);
          if (eventSelect.value) item.attributes.event = eventSelect.value;
          const action = await client.determineUpsertAction(item.attributes.doi);
          if (action === 'PUT') {
            await client.updateDoiAttributes(item.attributes.doi ?? doi, item.attributes);
            results.push({ doi, status: 'Updated' });
          } else {
            // Ensure prefix is present for creates.
            if (!item.attributes.prefix && item.attributes.doi) {
              item.attributes.prefix = item.attributes.doi.split('/')[0];
            }
            await client.addDoi(item.attributes);
            results.push({ doi, status: 'Created' });
          }
        } else {
          appendLog(logArea, `Processing ${item.doi}...\n`);
          const status = await client.uploadDoiFromXml(item.doi, item.xml, eventSelect.value || null);
          results.push({ doi: item.doi, status });
        }
      }

      appendLog(logArea, 'Upload complete.\n');
      resultsArea.style.display = 'block';
      resultsTable = createDataTable(
        resultsTableElement,
        [
          { title: 'DOI', data: 'doi' },
          { title: 'Status', data: 'status' }
        ],
        results
      );
      showToast({ variant: 'success', message: `Uploaded ${results.length} item(s).` });
    } catch (error) {
      showErrorToast(error, 'Upload failed.');
    } finally {
      startButton.disabled = false;
    }
  });
};
