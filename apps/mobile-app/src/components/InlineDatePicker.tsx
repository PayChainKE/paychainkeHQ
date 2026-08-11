import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Self-contained month-grid calendar — deliberately not built on a native
// date-picker library (none is installed, and adding one mid-project means
// a native rebuild) so it works identically in Expo Go and a dev build.

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseIso = (s?: string | null): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function formatIsoDateDisplay(iso?: string | null): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

interface Props {
  label: string;
  value: string; // ISO 'YYYY-MM-DD' or ''
  onChange: (iso: string) => void;
  placeholder?: string;
  minDate?: string; // ISO — dates before this are disabled
  clearable?: boolean;
}

export function InlineDatePicker({ label, value, onChange, placeholder = 'Select date', minDate, clearable }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const min = minDate ? parseIso(minDate) : null;
  const [cursor, setCursor] = useState<Date>(() => selected || new Date());

  const openPicker = () => {
    setCursor(selected || new Date());
    setOpen(true);
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());

  const cells: Array<{ day: number; date: Date } | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, month, d) });

  const goMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <View>
      <Text className="text-[9px] font-jakarta-bold uppercase tracking-widest text-[#707971] mb-1.5 ml-1">{label}</Text>
      <TouchableOpacity
        onPress={openPicker}
        className="bg-[#f7faf7] border border-[#eff4ef] rounded-2xl px-4 py-3 flex-row items-center justify-between"
      >
        <Text className={`text-[13px] font-jakarta-bold ${selected ? 'text-[#0c2010]' : 'text-[#a1a1aa]'}`}>
          {selected ? formatIsoDateDisplay(value) : placeholder}
        </Text>
        <Feather name="calendar" size={14} color="#707971" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity className="flex-1 bg-black/40 items-center justify-center px-6" activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} className="w-full max-w-sm bg-white rounded-[28px] p-5" onPress={() => {}}>
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity onPress={() => goMonth(-1)} className="w-9 h-9 rounded-full bg-[#f7faf7] items-center justify-center">
                <Feather name="chevron-left" size={16} color="#0c2010" />
              </TouchableOpacity>
              <Text className="text-[14px] font-jakarta-extrabold text-[#0c2010]">{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={() => goMonth(1)} className="w-9 h-9 rounded-full bg-[#f7faf7] items-center justify-center">
                <Feather name="chevron-right" size={16} color="#0c2010" />
              </TouchableOpacity>
            </View>

            <View className="flex-row mb-2">
              {WEEKDAYS.map((w, i) => (
                <View key={i} style={{ width: '14.28%' }} className="items-center">
                  <Text className="text-[9px] font-jakarta-extrabold uppercase text-[#a1a1aa]">{w}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap">
              {cells.map((cell, i) => {
                if (!cell) return <View key={i} style={{ width: '14.28%', height: 40 }} />;
                const isSelected = selected && sameDay(cell.date, selected);
                const isToday = sameDay(cell.date, today);
                const disabled = !!min && startOfDay(cell.date) < startOfDay(min);
                return (
                  <View key={i} style={{ width: '14.28%', height: 40 }} className="items-center justify-center">
                    <TouchableOpacity
                      disabled={disabled}
                      onPress={() => { onChange(toIso(cell.date)); setOpen(false); }}
                      className={`w-8 h-8 rounded-full items-center justify-center ${isSelected ? 'bg-[#00351d]' : isToday ? 'border border-[#00351d]' : ''}`}
                      style={{ opacity: disabled ? 0.25 : 1 }}
                    >
                      <Text className={`text-[12px] font-jakarta-bold ${isSelected ? 'text-white' : 'text-[#0c2010]'}`}>{cell.day}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View className="flex-row gap-2 mt-4">
              <TouchableOpacity
                onPress={() => { onChange(toIso(new Date())); setOpen(false); }}
                className="flex-1 py-2.5 rounded-xl border border-[#e7ece7] items-center"
              >
                <Text className="text-[11px] font-jakarta-bold text-[#00351d]">Today</Text>
              </TouchableOpacity>
              {clearable && (
                <TouchableOpacity
                  onPress={() => { onChange(''); setOpen(false); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#e7ece7] items-center"
                >
                  <Text className="text-[11px] font-jakarta-bold text-[#707971]">Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
