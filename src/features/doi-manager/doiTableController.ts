// Controller for DOI listing, actions, and table rendering.
import { sessionStore } from '@/app/state/sessionStore';
import type { DoiResource } from '@/api/types';
import { toDoiRow } from '@/domain/doi/doiModel';
import { mapStatus } from '@/domain/doi/statusMapping';
import { getClient } from '@/features/auth/authController';
import { createDataTable, setDataTableRows } from '@/ui/adapters/datatablesAdapter';
import { closeModal, openModal } from '@/ui/components/modal';
import { showErrorToast, showToast } from '@/ui/components/toast';
import { appendLog } from '@/utils/logging';

import {
  deleteDoi,
  downloadDoisZip,
  fetchDoiAttributes,
  fetchDoiXml,
  updateDoiStatus
} from './doiActions';
import { openEditor } from './editorModalController';

// Keep table instance for updates without re-creating the widget.
let dataTable: DataTables.Api | null = null;
// Cache the current rows for ZIP export and action context.
let currentRows: { doi: string; status: string; title: string; publicationYear: string; prefix: string }[] = [];
let selectedDoiForStatus: string | null = null;
let selectedDoiForDelete: string | null = null;

// Populate prefix filters from the authenticated session.
const initPrefixes = (): void => {
  const prefixSelect = document.getElementById('filter_prefix_select') as HTMLSelectElement | null;
  const advPrefixSelect = document.getElementById('adv_batch_prefix_select') as HTMLSelectElement | null;
  if (!prefixSelect || !advPrefixSelect) return;

  const { prefixes } = sessionStore.getState();
  const options = ['-- All --', ...prefixes];
  prefixSelect.innerHTML = options.map((prefix) => `<option value="${prefix === '-- All --' ? '' : prefix}">${prefix}</option>`).join('');
  advPrefixSelect.innerHTML = prefixSelect.innerHTML;
};

// Render action buttons for each table row.
const renderActions = (doi: string): string => {
  return `
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-outline-primary" data-action="edit-json" data-doi="${doi}" data-modal-trigger="editorModal">JSON</button>
      <button class="btn btn-sm btn-outline-secondary" data-action="edit-xml" data-doi="${doi}" data-modal-trigger="editorModal">XML</button>
      <button class="btn btn-sm btn-outline-info" data-action="status" data-doi="${doi}" data-modal-trigger="statusModal">Status</button>
      <button class="btn btn-sm btn-outline-danger" data-action="delete" data-doi="${doi}" data-modal-trigger="deleteModal">Delete</button>
    </div>
  `;
};

// Create the DataTable instance if needed.
const ensureTable = (): DataTables.Api => {
  if (dataTable) return dataTable;
  const tableElement = document.getElementById('doisTable') as HTMLTableElement | null;
  if (!tableElement) {
    throw new Error('Table not found.');
  }

  dataTable = createDataTable(
    tableElement,
    [
      {
        title: 'DOI',
        data: (row) => `<span class="doi-link">${row.doi}</span>`
      },
      { title: 'Status', data: 'status', className: 'text-center' },
      { title: 'Title', data: 'title' },
      { title: 'Year', data: 'publicationYear', className: 'text-center' },
      { title: 'Actions', data: (row) => renderActions(row.doi) }
    ],
    []
  );
  return dataTable;
};

// Update the DataTable with new row data.
const updateTable = (rows: typeof currentRows): void => {
  currentRows = rows;
  const table = ensureTable();
  setDataTableRows(
    table,
    [
      { title: 'DOI', data: (row) => `<span class="doi-link">${row.doi}</span>` },
      { title: 'Status', data: 'status', className: 'text-center' },
      { title: 'Title', data: 'title' },
      { title: 'Year', data: 'publicationYear', className: 'text-center' },
      { title: 'Actions', data: (row) => renderActions(row.doi) }
    ],
    rows
  );
};

// Delegate row action clicks to avoid binding per-row handlers.
const handleActionClick = async (event: Event): Promise<void> => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;

  const doi = button.dataset.doi;
  const action = button.dataset.action;
  if (!doi || !action) return;

  if (action === 'edit-json') {
    // JSON editor uses attributes only to keep edits focused.
    const attributes = await fetchDoiAttributes(doi);
    openEditor({ doi, format: 'json', content: JSON.stringify(attributes, null, 2) });
    openModal('editorModal');
  }
  if (action === 'edit-xml') {
    const xml = await fetchDoiXml(doi);
    openEditor({ doi, format: 'xml', content: xml });
    openModal('editorModal');
  }
  if (action === 'status') {
    // Store selected DOI so the modal can apply the update.
    selectedDoiForStatus = doi;
    document.getElementById('statusModalDoi')!.textContent = doi;
    openModal('statusModal');
  }
  if (action === 'delete') {
    // Store selected DOI so the modal can confirm deletion.
    selectedDoiForDelete = doi;
    document.getElementById('deleteModalDoi')!.textContent = doi;
    openModal('deleteModal');
  }
};

export const initDoiManager = (): void => {
  const fetchButton = document.getElementById('btnFetchDois') as HTMLButtonElement | null;
  const statusSelect = document.getElementById('statusModalSelect') as HTMLSelectElement | null;
  const statusApply = document.getElementById('statusModalUpdateBtn') as HTMLButtonElement | null;
  const deleteConfirm = document.getElementById('deleteModalConfirmBtn') as HTMLButtonElement | null;
  const downloadButton = document.getElementById('btnDownloadDisplayedDois') as HTMLButtonElement | null;
  const downloadSection = document.getElementById('downloadDisplayedSection');
  const downloadConfirm = document.getElementById('proceedDownloadBtn') as HTMLButtonElement | null;

  if (!fetchButton || !statusSelect || !statusApply || !deleteConfirm || !downloadButton || !downloadSection || !downloadConfirm) {
    return;
  }

  // Populate status options once; DataCite expects event values.
  statusSelect.innerHTML = [
    { value: 'publish', label: 'Publish (Findable)' },
    { value: 'register', label: 'Register' },
    { value: 'hide', label: 'Hide (Draft)' }
  ]
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join('');

  initPrefixes();
  sessionStore.subscribe(initPrefixes);

  ensureTable();
  const tableElement = document.getElementById('doisTable');
  tableElement?.addEventListener('click', handleActionClick);

  fetchButton.addEventListener('click', async () => {
    // Fetch DOIs based on prefix/query and update table.
    const prefix = (document.getElementById('filter_prefix_select') as HTMLSelectElement)?.value;
    const query = (document.getElementById('filter_query') as HTMLInputElement)?.value.trim();
    const statusEl = document.getElementById('fetchStatus') as HTMLElement;

    statusEl.textContent = '';
    fetchButton.disabled = true;
    appendLog(statusEl, 'Fetching DOIs...\n');

    try {
      const client = getClient();
      const rows: typeof currentRows = [];
      for await (const doi of client.listDois({ prefix, query })) {
        const row = toDoiRow(doi as DoiResource);
        row.status = mapStatus(row.status);
        rows.push(row);
        appendLog(statusEl, `Fetched ${row.doi}\n`);
      }
      updateTable(rows);
      downloadSection.style.display = rows.length ? 'block' : 'none';
      appendLog(statusEl, `\nCompleted. ${rows.length} DOI(s) loaded.`);
      showToast({ variant: 'success', message: `Loaded ${rows.length} DOI(s).` });
    } catch (error) {
      showErrorToast(error, 'Failed to fetch DOIs.');
    } finally {
      fetchButton.disabled = false;
    }
  });

  statusApply.addEventListener('click', async () => {
    if (!selectedDoiForStatus) return;
    try {
      await updateDoiStatus(selectedDoiForStatus, statusSelect.value);
      showToast({ variant: 'success', message: `Status updated for ${selectedDoiForStatus}.` });
      closeModal('statusModal');
    } catch (error) {
      showErrorToast(error, 'Failed to update status.');
    }
  });

  deleteConfirm.addEventListener('click', async () => {
    if (!selectedDoiForDelete) return;
    try {
      await deleteDoi(selectedDoiForDelete);
      showToast({ variant: 'success', message: `Deleted ${selectedDoiForDelete}.` });
      closeModal('deleteModal');
    } catch (error) {
      showErrorToast(error, 'Failed to delete DOI.');
    }
  });

  downloadButton.addEventListener('click', () => {
    // Use a confirmation modal to prevent accidental downloads.
    document.getElementById('downloadConfirmCount')!.textContent = String(currentRows.length);
    openModal('downloadConfirmModal');
  });

  downloadConfirm.addEventListener('click', async () => {
    try {
      const format = (document.getElementById('list_download_format') as HTMLSelectElement).value as
        | 'json_attributes'
        | 'xml'
        | 'both';
      await downloadDoisZip(currentRows.map((row) => row.doi), format);
      showToast({ variant: 'success', message: 'Download started.' });
      closeModal('downloadConfirmModal');
    } catch (error) {
      showErrorToast(error, 'Failed to download ZIP.');
    }
  });
};
