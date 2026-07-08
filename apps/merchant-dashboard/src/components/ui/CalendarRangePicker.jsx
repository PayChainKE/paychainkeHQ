import React, { useState, useEffect } from 'react'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const startOfDay = (d) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c }
const fmtLong = (d) => d.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// A single-month calendar that picks exactly one date. Used twice — once
// for the start date, once for the end date — rather than one calendar
// doing double duty with a two-click range gesture, which tested as
// confusing ("which click am I on?"). Each one is self-contained: its own
// month navigation, its own min/max bounds.
function MonthCalendar({ selected, onSelect, minDate, maxDate, accent = 'primary' }) {
  const [viewDate, setViewDate] = useState(startOfDay(selected || maxDate || new Date()))

  // If the selected date jumps to a different month from elsewhere (e.g.
  // the other calendar's choice pushes this one's bound), follow it.
  useEffect(() => {
    if (selected) setViewDate(startOfDay(selected))
  }, [selected && selected.getTime()])

  const min = minDate ? startOfDay(minDate) : null
  const max = maxDate ? startOfDay(maxDate) : null
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const goMonth = (delta) => setViewDate(new Date(year, month + delta, 1))

  const accentBg = accent === 'primary' ? 'bg-primary' : 'bg-[#0A2540]'

  return (
    <div className="bg-white border border-outline-variant/15 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          disabled={min && new Date(year, month, 0) < min}
          className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low hover:text-primary disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant/60 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </button>
        <p className="text-sm font-bold text-primary">{MONTH_NAMES[month]} {year}</p>
        <button
          type="button"
          onClick={() => goMonth(1)}
          disabled={max && new Date(year, month + 1, 1) > max}
          className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low hover:text-primary disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant/60 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-on-surface-variant/40 uppercase py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const disabled = (max && day > max) || (min && day < min)
          const isSelected = sameDay(day, selected)
          const isToday = sameDay(day, new Date())

          return (
            <button
              type="button"
              key={i}
              disabled={disabled}
              onClick={() => onSelect(day)}
              className={`h-8 text-xs font-semibold rounded-full transition-colors flex items-center justify-center mx-auto w-8 ${
                isSelected
                  ? `${accentBg} text-white shadow-sm`
                  : disabled
                    ? 'text-on-surface-variant/20 cursor-not-allowed'
                    : isToday
                      ? 'text-primary ring-1 ring-primary/30 hover:bg-surface-container-low'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Two independent single-date calendars — Start Date and End Date — laid
// out side by side. Picking a start after the current end (or an end
// before the current start) resets the other side rather than producing
// an inverted range.
export default function CalendarRangePicker({ from, to, onChange, maxDate }) {
  const today = maxDate || new Date()

  const handlePickFrom = (day) => {
    onChange({ from: day, to: to && day > to ? null : to })
  }
  const handlePickTo = (day) => {
    onChange({ from: from && day < from ? null : from, to: day })
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Start Date
          </p>
          <MonthCalendar selected={from} onSelect={handlePickFrom} maxDate={to || today} accent="primary" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0A2540]"></span>
            End Date
          </p>
          <MonthCalendar selected={to} onSelect={handlePickTo} minDate={from} maxDate={today} accent="navy" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline-variant/10 text-xs">
        <div>
          <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-0.5">From</p>
          <p className="font-semibold text-primary">{from ? fmtLong(from) : 'Not selected yet'}</p>
        </div>
        <span className="material-symbols-outlined text-base text-on-surface-variant/30">trending_flat</span>
        <div className="text-right">
          <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-0.5">To</p>
          <p className="font-semibold text-primary">{to ? fmtLong(to) : 'Not selected yet'}</p>
        </div>
      </div>
    </div>
  )
}
