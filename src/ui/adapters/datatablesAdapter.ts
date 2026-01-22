// Adapter to isolate DataTables usage from feature controllers.
import $ from 'jquery';
import 'datatables.net-bs5';

// Table column definition used by the adapter.
export type TableColumn<T> = {
  title: string;
  data: keyof T | ((row: T) => string | number | HTMLElement);
  className?: string;
};

// Initialize a DataTable with normalized row/column data.
export const createDataTable = <T>(
  table: HTMLTableElement,
  columns: Array<TableColumn<T>>,
  rows: T[]
): DataTables.Api => {
  // DataTables expects array rows keyed by numeric column indexes.
  const data = rows.map((row) => {
    const result: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      const value =
        typeof column.data === 'function' ? column.data(row) : (row[column.data] as unknown);
      result[index] = value;
    });
    return result;
  });

  const tableColumns = columns.map((column, index) => ({
    title: column.title,
    data: index,
    className: column.className ?? ''
  }));

  return ($(table) as unknown as DataTables.Api).DataTable({
    data,
    columns: tableColumns,
    destroy: true,
    pageLength: 25,
    order: []
  });
};

// Update the rows in an existing DataTable instance.
export const setDataTableRows = <T>(table: DataTables.Api, columns: Array<TableColumn<T>>, rows: T[]): void => {
  const data = rows.map((row) => {
    const result: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      const value =
        typeof column.data === 'function' ? column.data(row) : (row[column.data] as unknown);
      result[index] = value;
    });
    return result;
  });

  table.clear();
  table.rows.add(data);
  table.draw();
};
