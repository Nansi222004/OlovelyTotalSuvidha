import { useEffect, useMemo, useState } from "react";

interface DateOfBirthSelectProps {
  /** ISO date YYYY-MM-DD or "" */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  /** Minimum age in years (default 18) */
  minAge?: number;
  /** Maximum age in years (default 70) */
  maxAge?: number;
  selectClassName?: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const daysInMonth = (year: number, month: number) =>
  new Date(year || 2000, month, 0).getDate(); // month is 1-based here

/**
 * Date of birth picker built from three dropdowns (Day / Month / Year).
 * Avoids the native "rolling wheel" date picker shown in Android WebViews.
 */
export default function DateOfBirthSelect({
  value,
  onChange,
  disabled = false,
  minAge = 18,
  maxAge = 70,
  selectClassName = "",
}: DateOfBirthSelectProps) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  // Sync from outside value
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      setYear(y);
      setMonth(String(parseInt(m, 10)));
      setDay(String(parseInt(d, 10)));
    } else if (!value) {
      setDay("");
      setMonth("");
      setYear("");
    }
  }, [value]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const list: number[] = [];
    for (let y = current - minAge; y >= current - maxAge; y--) list.push(y);
    return list;
  }, [minAge, maxAge]);

  const maxDay = month ? daysInMonth(parseInt(year, 10), parseInt(month, 10)) : 31;

  const emit = (d: string, m: string, y: string) => {
    if (d && m && y) {
      const safeDay = Math.min(parseInt(d, 10), daysInMonth(parseInt(y, 10), parseInt(m, 10)));
      onChange(`${y}-${m.padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`);
    } else {
      onChange("");
    }
  };

  const base =
    "w-full px-2 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-800 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-neutral-100 " +
    selectClassName;

  return (
    <div className="grid grid-cols-[1fr_1.3fr_1.3fr] gap-2">
      <select
        aria-label="Day"
        value={day}
        disabled={disabled}
        onChange={(e) => {
          setDay(e.target.value);
          emit(e.target.value, month, year);
        }}
        className={base}
      >
        <option value="">Day</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d)}>
            {d}
          </option>
        ))}
      </select>

      <select
        aria-label="Month"
        value={month}
        disabled={disabled}
        onChange={(e) => {
          const m = e.target.value;
          let d = day;
          if (d && m && parseInt(d, 10) > daysInMonth(parseInt(year, 10), parseInt(m, 10))) {
            d = String(daysInMonth(parseInt(year, 10), parseInt(m, 10)));
            setDay(d);
          }
          setMonth(m);
          emit(d, m, year);
        }}
        className={base}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>

      <select
        aria-label="Year"
        value={year}
        disabled={disabled}
        onChange={(e) => {
          const y = e.target.value;
          let d = day;
          if (d && month && parseInt(d, 10) > daysInMonth(parseInt(y, 10), parseInt(month, 10))) {
            d = String(daysInMonth(parseInt(y, 10), parseInt(month, 10)));
            setDay(d);
          }
          setYear(y);
          emit(d, month, y);
        }}
        className={base}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
