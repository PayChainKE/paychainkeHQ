import React from 'react';

// Slim, consistent pagination used across every list in the console.
// Renders only when total > pageSize so single-page views stay clean.

const TablePagination = ({ page, pageSize, total, onPage }) => {
  if (total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  return (
    <div className="px-4 py-2.5 bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-outline-variant/10">
      <p className="text-2xs text-on-surface-variant/60 font-body tabular-nums">
        Showing <span className="font-bold text-on-surface">{start.toLocaleString()}–{end.toLocaleString()}</span> of <span className="font-bold text-on-surface">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </button>
        <span className="px-2.5 py-1 rounded-lg bg-primary text-white text-2xs font-bold tabular-nums">{page}</span>
        <span className="text-2xs text-on-surface-variant/40 font-bold mx-0.5">/ {totalPages}</span>
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
