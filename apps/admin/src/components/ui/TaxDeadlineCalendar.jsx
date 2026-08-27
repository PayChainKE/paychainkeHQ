import React, { useState } from 'react';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const TYPE_DOT = {
  VAT: '#f59e0b',
  PAYE: '#3b82f6',
  'Corporate Income Tax': '#8b5cf6',
  'Withholding Tax': '#10b981',
  Other: '#6b7280',
};

// Display-only single-month calendar marking each deadline's next
// occurrence — structurally the same MonthCalendar grid as
// apps/merchant-dashboard/src/components/ui/CalendarRangePicker.jsx (ported,
// not imported — separate Vite apps), simplified since there's no
// selection gesture here, just marking dates that already have a computed
// nextDueDate.
export default function TaxDeadlineCalendar({ deadlines = [] }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const goMonth = (delta) => setViewDate(new Date(year, month + delta, 1));

  const deadlinesFor = (day) => deadlines.filter((d) => d.nextDueDate && sameDay(new Date(d.nextDueDate), day));
  const thisMonthDeadlines = deadlines
    .filter((d) => d.nextDueDate && new Date(d.nextDueDate).getFullYear() === year && new Date(d.nextDueDate).getMonth() === month)
    .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 shadow-editorial">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => goMonth(-1)} className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </button>
        <p className="text-sm font-bold text-on-surface font-headline">{MONTH_NAMES[month]} {year}</p>
        <button type="button" onClick={() => goMonth(1)} className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-on-surface-variant/40 uppercase py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = sameDay(day, new Date());
          const hits = deadlinesFor(day);
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={`h-8 w-8 text-xs font-semibold rounded-full flex items-center justify-center ${
                  isToday ? 'text-primary ring-1 ring-primary/30' : 'text-on-surface-variant'
                }`}
                title={hits.map((h) => h.label).join(', ')}
              >
                {day.getDate()}
              </div>
              {hits.length > 0 && (
                <div className="flex gap-0.5">
                  {hits.slice(0, 3).map((h, j) => (
                    <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_DOT[h.taxType] || TYPE_DOT.Other }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-outline-variant/10 space-y-1.5">
        {thisMonthDeadlines.length === 0 ? (
          <p className="text-2xs text-on-surface-variant/40">No deadlines this month.</p>
        ) : (
          thisMonthDeadlines.map((d) => (
            <div key={d._id} className="flex items-center gap-2 text-2xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_DOT[d.taxType] || TYPE_DOT.Other }} />
              <span className="font-bold text-on-surface-variant/70 flex-1 truncate">{d.label}</span>
              <span className="text-on-surface-variant/50 tabular-nums">{new Date(d.nextDueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
