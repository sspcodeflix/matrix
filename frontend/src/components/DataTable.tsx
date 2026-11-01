import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from './Icon';
import styles from './DataTable.module.css';

/*
 * Every Matrix data table: keyword search, per-column filters, removable filter chips,
 * sortable headers and pagination (docs/SCREENS.md, "Data tables").
 *
 * Combination rules: view tab AND keyword AND every column filter. Keyword matches any
 * column value, case-insensitive. Selection spans pages and survives filter changes;
 * the footer says how many selected rows are outside the current results.
 * State lives in the URL (prefixed by `id`) so a filtered view can be shared.
 * TODO(backend): for large data, send the same query to the API and filter server-side.
 */

export type ColumnFilter<T = unknown> =
  | { type: 'text' }
  /** `match` overrides exact matching, e.g. a role contained in a list. */
  | { type: 'select'; options?: string[]; match?: (row: T, value: string) => boolean }
  | { type: 'none' };

export interface Column<T> {
  key: string;
  header: string;
  /** Plain value used for search, sort and filters. */
  value: (row: T) => string | number;
  /** Value used by the column filter when it differs from the sort value. */
  filterValue?: (row: T) => string;
  render?: (row: T) => ReactNode;
  /** Defaults to text. Select options default to the distinct values in the data. */
  filter?: ColumnFilter<T>;
  sortable?: boolean;
  mono?: boolean;
  align?: 'left' | 'right';
  width?: number | string;
}

export interface TableView<T> {
  key: string;
  label: string;
  match: (row: T) => boolean;
}

export interface DataTableProps<T> {
  id: string;
  title?: ReactNode;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Segmented views shown beside the title, e.g. Gaps / All. First is the default. */
  views?: TableView<T>[];
  searchLabel?: string;
  searchPlaceholder?: string;
  selectable?: boolean;
  /** Called with the selected keys whenever selection changes. */
  onSelectionChange?: (keys: string[]) => void;
  /** Receives the filtered rows so screens can keep counts and actions in step. */
  onFilteredChange?: (rows: T[]) => void;
  pageSizes?: number[];
  defaultPageSize?: number;
  /** Extra controls in the card header, e.g. Download report. */
  actions?: ReactNode;
  emptyMessage?: ReactNode;
  minWidth?: number;
  rowLabel?: (row: T) => string;
  /** Key of a row to highlight, e.g. the run whose detail is shown below. */
  activeRowKey?: string;
  /** Extra class per row, e.g. an attention highlight. */
  rowClassName?: (row: T) => string | undefined;
  noun?: { one: string; many: string };
}

type SortDir = 'asc' | 'desc';

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    id, title, rows, columns, rowKey, views, selectable, onSelectionChange, onFilteredChange,
    pageSizes = [10, 25, 50], defaultPageSize = pageSizes[0], actions, emptyMessage,
    minWidth = 760, rowLabel, activeRowKey, rowClassName, noun = { one: 'row', many: 'rows' },
    searchLabel = 'Search table', searchPlaceholder = 'Search by keyword',
  } = props;

  const [params, setParams] = useSearchParams();
  const p = (k: string) => `${id}.${k}`;
  const keyword = params.get(p('q')) ?? '';
  const view = views?.find((v) => v.key === params.get(p('view'))) ?? views?.[0];
  const sortKey = params.get(p('sort'));
  const sortDir: SortDir = params.get(p('dir')) === 'desc' ? 'desc' : 'asc';
  const pageSize = Number(params.get(p('size'))) || defaultPageSize;
  const filterable = columns.filter((c) => c.filter?.type !== 'none');
  const filters = Object.fromEntries(
    filterable.map((c) => [c.key, params.get(p(`f.${c.key}`)) ?? '']).filter(([, v]) => v),
  ) as Record<string, string>;
  const activeFilterCount = Object.keys(filters).length;

  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const update = (changes: Record<string, string | null>, resetPage = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === '') next.delete(p(k));
          else next.set(p(k), v);
        }
        if (resetPage) next.delete(p('page'));
        return next;
      },
      { replace: true },
    );
  };

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let out = rows.filter((r) => (view ? view.match(r) : true));
    if (kw) out = out.filter((r) => columns.some((c) => String(c.value(r)).toLowerCase().includes(kw)));
    for (const [key, val] of Object.entries(filters)) {
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      const v = val.toLowerCase();
      const custom = col.filter?.type === 'select' ? col.filter.match : undefined;
      if (custom) {
        out = out.filter((r) => custom(r, val));
        continue;
      }
      out = out.filter((r) => {
        const cell = String((col.filterValue ?? col.value)(r)).toLowerCase();
        return col.filter?.type === 'select' ? cell === v : cell.includes(v);
      });
    }
    const col = columns.find((c) => c.key === sortKey);
    if (col) {
      out = [...out].sort((a, b) => {
        const x = col.value(a);
        const y = col.value(b);
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, keyword, view?.key, JSON.stringify(filters), sortKey, sortDir]);

  // Notify only when the filtered set changes, so inline columns or callbacks cannot loop.
  const onFilteredRef = useRef(onFilteredChange);
  onFilteredRef.current = onFilteredChange;
  const filteredSignature = filtered.map(rowKey).join('\u0000');
  useEffect(() => onFilteredRef.current?.(filtered), [filteredSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestedPage = Number(params.get(p('page'))) || 1;
  // Reset invalid page positions after a filter change.
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const setSelection = (next: Set<string>) => {
    setSelected(next);
    onSelectionChange?.([...next]);
  };
  const filteredKeys = new Set(filtered.map(rowKey));
  const selectedOutside = [...selected].filter((k) => !filteredKeys.has(k)).length;
  const pageKeys = pageRows.map(rowKey);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));
  const somePageSelected = pageKeys.some((k) => selected.has(k));

  const toggleSort = (key: string) => {
    if (sortKey !== key) update({ sort: key, dir: 'asc' }, false);
    else if (sortDir === 'asc') update({ dir: 'desc' }, false);
    else update({ sort: null, dir: null }, false);
  };

  const optionsFor = (c: Column<T>) => {
    if (c.filter?.type === 'select' && c.filter.options) return c.filter.options;
    return [...new Set(rows.map((r) => String((c.filterValue ?? c.value)(r))))].sort();
  };

  const countLabel = (n: number) => `${n} ${n === 1 ? noun.one : noun.many}`;

  return (
    <section className={`card ${styles.table}`}>
      {(title || views || actions) && (
        <div className={styles.head}>
          <div className="row" style={{ gap: 4 }}>
            {title && <div className={styles.title}>{title}</div>}
            {views && (
              <div className={styles.views} role="group" aria-label="Table view">
                {views.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className={styles.view}
                    aria-pressed={v.key === view?.key}
                    onClick={() => update({ view: v.key === views[0].key ? null : v.key })}
                  >
                    {v.label} · {rows.filter(v.match).length}
                  </button>
                ))}
              </div>
            )}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={16} strokeWidth={2} />
          <span className="sr-only">{searchLabel}</span>
          <input
            type="search"
            value={keyword}
            placeholder={searchPlaceholder}
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn"
          aria-expanded={showFilters}
          aria-controls={`${id}-filter-row`}
          onClick={() => setShowFilters((s) => !s)}
        >
          <Icon name="filter" size={14} strokeWidth={2} />
          Filters
          {activeFilterCount > 0 && <span className="chip tone-accent">{activeFilterCount}</span>}
        </button>
        {Object.entries(filters).map(([key, val]) => {
          const col = columns.find((c) => c.key === key)!;
          return (
            <span key={key} className={styles.filterChip}>
              {col.header}: {val}
              <button type="button" aria-label={`Remove filter ${col.header}: ${val}`} onClick={() => update({ [`f.${key}`]: null })}>
                <Icon name="close" size={12} strokeWidth={2.4} />
              </button>
            </span>
          );
        })}
        {(activeFilterCount > 0 || keyword) && (
          <button
            type="button"
            className="link-btn"
            onClick={() => update({ q: null, ...Object.fromEntries(Object.keys(filters).map((k) => [`f.${k}`, null])) })}
          >
            Clear all
          </button>
        )}
      </div>

      <div className={styles.scroll}>
        <table style={{ minWidth }}>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className={styles.check}>
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allPageSelected && somePageSelected;
                    }}
                    onChange={() => {
                      const next = new Set(selected);
                      pageKeys.forEach((k) => (allPageSelected ? next.delete(k) : next.add(k)));
                      setSelection(next);
                    }}
                  />
                </th>
              )}
              {columns.map((c) => {
                const sortable = c.sortable !== false;
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={{ width: c.width, textAlign: c.align }}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {sortable ? (
                      <button type="button" className={styles.sort} onClick={() => toggleSort(c.key)}>
                        {c.header}
                        <Icon name={active ? (sortDir === 'asc' ? 'sortAsc' : 'sortDesc') : 'sort'} size={12} strokeWidth={2.4} />
                        <span className="sr-only">
                          {active ? `, sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}` : ', sortable'}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
            {showFilters && (
              <tr id={`${id}-filter-row`} className={styles.filterRow}>
                {selectable && <td />}
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.filter?.type === 'none' ? null : c.filter?.type === 'select' ? (
                      <select
                        className="select compact"
                        aria-label={`Filter by ${c.header}`}
                        value={filters[c.key] ?? ''}
                        onChange={(e) => update({ [`f.${c.key}`]: e.target.value })}
                      >
                        <option value="">All</option>
                        {optionsFor(c).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input compact"
                        aria-label={`Filter by ${c.header}`}
                        placeholder="Filter"
                        value={filters[c.key] ?? ''}
                        onChange={(e) => update({ [`f.${c.key}`]: e.target.value })}
                      />
                    )}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const k = rowKey(r);
              return (
                <tr
                  key={k}
                  aria-selected={selectable ? selected.has(k) : undefined}
                  aria-current={k === activeRowKey ? 'true' : undefined}
                  className={[k === activeRowKey ? styles.active : '', rowClassName?.(r) ?? ''].join(' ').trim() || undefined}
                >
                  {selectable && (
                    <td className={styles.check}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${rowLabel ? rowLabel(r) : k}`}
                        checked={selected.has(k)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(k)) next.delete(k);
                          else next.add(k);
                          setSelection(next);
                        }}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={c.mono ? 'mono' : undefined} style={{ textAlign: c.align }}>
                      {c.render ? c.render(r) : c.value(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className={styles.empty}>
                  {emptyMessage ?? `No ${noun.many} match the current search and filters.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.foot}>
        <span className="secondary" role="status">
          {filtered.length === 0 ? (
            `Showing 0 of 0 ${noun.many}`
          ) : (
            <>Showing <strong>{start + 1}–{start + pageRows.length}</strong> of {countLabel(filtered.length)}</>
          )}
          {selectable && selected.size > 0 && (
            <>
              {' · '}
              {selected.size} selected
              {selectedOutside > 0 && ` (${selectedOutside} outside these results)`}{' '}
              <button type="button" className="link-btn" style={{ minHeight: 0 }} onClick={() => setSelection(new Set())}>
                Clear selection
              </button>
            </>
          )}
        </span>
        <div className="row" style={{ gap: 12 }}>
          <label className="row secondary" style={{ gap: 8 }}>
            Rows per page
            <select className="select compact" value={pageSize} onChange={(e) => update({ size: e.target.value })}>
              {pageSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <nav className="row" style={{ gap: 4 }} aria-label="Pagination">
            <button type="button" className="btn icon" aria-label="Previous page" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, false)}>
              <Icon name="chevronLeft" size={16} />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`btn icon ${n === page ? 'dark' : ''}`}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`Page ${n}`}
                onClick={() => update({ page: String(n) }, false)}
              >
                {n}
              </button>
            ))}
            <button type="button" className="btn icon" aria-label="Next page" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1) }, false)}>
              <Icon name="chevronRight" size={16} />
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
