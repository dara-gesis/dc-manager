// Advanced batch update controller with dry-run and confirmation handling.
import { applyBatchOperations } from '@/domain/batch/updateEngine';
import { validateBatchOperations } from '@/domain/doi/validators';
import { getClient } from '@/features/auth/authController';
import { createDataTable } from '@/ui/adapters/datatablesAdapter';
import { confirmDialog } from '@/ui/components/confirmDialog';
import { showErrorToast, showToast } from '@/ui/components/toast';
import { appendLog } from '@/utils/logging';

import { readOperationsFromDom } from './rules';

// Store the results table instance for rerendering.
let resultsTable: DataTables.Api | null = null;

// Clone the operation block template and append it to the DOM.
const addOperationBlock = (container: HTMLElement): void => {
  const template = document.getElementById('operation-block-template');
  if (!template) return;
  const block = template.querySelector('.operation-block')?.cloneNode(true) as HTMLElement | null;
  if (!block) return;
  container.appendChild(block);
  updateOperationTitles(container);
};

// Keep operation titles in sync after adds/removals.
const updateOperationTitles = (container: HTMLElement): void => {
  Array.from(container.querySelectorAll<HTMLElement>('.operation-title')).forEach((title, index) => {
    title.textContent = `Operation ${index + 1}`;
  });
};

export const initAdvancedBatch = (): void => {
  const container = document.getElementById('adv_batch_operations_container');
  const addButton = document.getElementById('adv_batch_add_op_btn');
  const startButton = document.getElementById('adv_batch_start_btn');
  const statusArea = document.getElementById('adv_batch_status');
  const resultsArea = document.getElementById('adv_batch_results_area');
  const resultsTableElement = document.getElementById('adv_batch_results_table') as HTMLTableElement | null;
  const summary = document.getElementById('adv_batch_final_summary');

  if (!container || !addButton || !startButton || !statusArea || !resultsArea || !resultsTableElement || !summary) {
    return;
  }

  // Initialize with a single empty operation block.
  addOperationBlock(container);

  addButton.addEventListener('click', () => addOperationBlock(container));

  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.remove-op-btn')) {
      // Remove the operation block and update headings.
      target.closest('.operation-block')?.remove();
      updateOperationTitles(container);
    }
    if (target?.closest('.toggle-condition-btn')) {
      // Toggle condition fields visibility and button text.
      const conditionFields = target.closest('.operation-block')?.querySelector<HTMLElement>('.condition-fields');
      if (conditionFields) {
        const isHidden = conditionFields.style.display === 'none' || !conditionFields.style.display;
        conditionFields.style.display = isHidden ? 'block' : 'none';
        target.textContent = isHidden ? 'Remove Condition' : 'Add Condition';
      }
    }
  });

  startButton.addEventListener('click', async () => {
    // Reset UI state for a new run.
    statusArea.textContent = '';
    resultsArea.style.display = 'none';
    summary.textContent = '';
    startButton.disabled = true;

    const operations = readOperationsFromDom(container);
    try {
      validateBatchOperations(operations);
    } catch (error) {
      showErrorToast(error, 'Invalid operations.');
      startButton.disabled = false;
      return;
    }

    const dryRun = (document.getElementById('adv_batch_dry_run') as HTMLInputElement)?.checked ?? true;
    if (!dryRun) {
      // Confirm destructive operations before live updates.
      const confirmed = await confirmDialog({
        title: 'Confirm Live Update',
        message: 'You are about to perform a live update. This will permanently modify records.',
        variant: 'danger',
        confirmLabel: 'Proceed'
      });
      if (!confirmed) {
        startButton.disabled = false;
        return;
      }
    }

    try {
      const client = getClient();
      const prefix = (document.getElementById('adv_batch_prefix_select') as HTMLSelectElement)?.value;
      const query = (document.getElementById('adv_batch_query') as HTMLInputElement)?.value.trim();

      appendLog(statusArea, `Starting advanced batch update. Dry run: ${dryRun}\n`);

      const results = {
        checked: 0,
        changedInMemory: 0,
        updatedOnApi: [] as string[],
        failedOnApi: [] as string[],
        affectedDois: [] as string[]
      };

      for await (const doiItem of client.listDois({ prefix, query })) {
        results.checked += 1;
        const attributes = doiItem.attributes ?? {};
        // Deep clone to avoid mutating the original payload.
        const copy = JSON.parse(JSON.stringify(attributes)) as Record<string, unknown>;
        const { updated } = applyBatchOperations(copy, operations);

        if (!updated) {
          appendLog(statusArea, `No changes for ${doiItem.id}.\n`);
          continue;
        }

        results.changedInMemory += 1;
        if (dryRun) {
          results.affectedDois.push(doiItem.id ?? 'Unknown');
          appendLog(statusArea, `[Dry Run] Would update ${doiItem.id}.\n`);
        } else {
          try {
            await client.updateDoiAttributes(doiItem.id ?? '', copy);
            results.updatedOnApi.push(doiItem.id ?? 'Unknown');
            appendLog(statusArea, `Updated ${doiItem.id}.\n`);
          } catch {
            results.failedOnApi.push(doiItem.id ?? 'Unknown');
            appendLog(statusArea, `Failed to update ${doiItem.id}.\n`);
          }
        }
      }

      summary.textContent = [
        `DOIs checked: ${results.checked}`,
        `Changed in memory: ${results.changedInMemory}`,
        dryRun ? `Dry run - changes not applied.` : `Updated on API: ${results.updatedOnApi.length}`
      ].join('\n');

      resultsArea.style.display = 'block';
      resultsTable = createDataTable(
        resultsTableElement,
        [
          { title: 'DOI', data: 'doi' },
          { title: 'Status', data: 'status' }
        ],
        (dryRun ? results.affectedDois : results.updatedOnApi).map((doi) => ({
          doi,
          status: dryRun ? 'Dry Run' : 'Updated'
        }))
      );

      showToast({ variant: 'success', message: 'Batch update complete.' });
    } catch (error) {
      showErrorToast(error, 'Batch update failed.');
    } finally {
      startButton.disabled = false;
    }
  });
};
