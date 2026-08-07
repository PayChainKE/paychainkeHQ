import React from 'react';

// Top overlay control panel — search + status filter. "Trade Zone" and
// "Field Pods vs Merchants" toggles from the original spec are left out for
// v1: there's no zone taxonomy defined anywhere in PayChain yet, and there's
// no separate "field agent" entity in the data model — inventing either
// here would just be guessed placeholder data.
export default function MapFilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, resultCount, totalCount }) {
  return (
    <div className="absolute top-3 left-3 right-3 sm:right-auto z-[1000] flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="relative flex-1 sm:w-72 sm:flex-none">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-[18px]">search</span>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search business, phone, or area..."
          className="w-full pl-9 pr-8 py-2 bg-white border border-outline-variant/20 shadow-md rounded-lg text-[13px] focus:border-secondary focus:ring-0 transition-all font-body text-on-surface"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined text-[15px]">close</span>
          </button>
        )}
      </div>

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="bg-white border border-outline-variant/20 shadow-md rounded-lg px-3 py-2 text-[13px] font-medium text-on-surface focus:border-secondary focus:ring-0 transition-all"
      >
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="pending">Pending Verification</option>
        <option value="locked">Locked</option>
      </select>

      <div className="bg-white border border-outline-variant/20 shadow-md rounded-lg px-3 py-2 text-[12px] font-semibold text-on-surface-variant/70 whitespace-nowrap">
        {resultCount} of {totalCount} pinned
      </div>
    </div>
  );
}
