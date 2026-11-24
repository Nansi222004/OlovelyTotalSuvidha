import { useEffect, useRef, useState } from "react";

/**
 * Date field that can be TYPED (DD/MM/YYYY, slashes added automatically) or PICKED
 * from the calendar button. Inside the Android app WebView a plain <input type="date">
 * only opens the picker and cannot be typed into, which is slow for dates of birth.
 *
 * value / onChange use the same "YYYY-MM-DD" string as <input type="date">,
 * so it is a drop-in replacement. onChange("") is sent while the typed date is incomplete/invalid.
 */
interface TypeableDateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  /** "YYYY-MM-DD" limits (optional). */
  min?: string;
  max?: string;
}

const isoToDisplay = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

const displayToIso = (display: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const valid =
    d.getFullYear() === Number(yyyy) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd);
  return valid ? `${yyyy}-${mm}-${dd}` : "";
};

/** Keep digits only and insert "/" after DD and MM. */
const maskTyped = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export default function TypeableDateInput({
  value,
  onChange,
  name,
  disabled,
  className = "",
  min,
  max,
}: TypeableDateInputProps) {
  const [text, setText] = useState<string>(isoToDisplay(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  // Sync when the parent value changes (e.g. picked from calendar or form reset).
  useEffect(() => {
    if (displayToIso(text) !== value) setText(isoToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleTyped = (raw: string) => {
    const masked = maskTyped(raw);
    setText(masked);
    onChange(displayToIso(masked));
  };

  const openPicker = () => {
    const el = pickerRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el || disabled) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else el.click();
    } catch {
      el.click();
    }
  };

  const incomplete = text.length > 0 && !displayToIso(text);

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          name={name}
          value={text}
          onChange={(e) => handleTyped(e.target.value)}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          autoComplete="bday"
          disabled={disabled}
          className={`${className} pr-11`}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label="Pick date from calendar"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-500 hover:text-teal-700 hover:bg-teal-50 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
        {/* Hidden native picker used only by the calendar button */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="absolute right-0 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
        />
      </div>
      {incomplete && (
        <p className="mt-1 text-[11px] text-amber-700">Enter the full date as DD/MM/YYYY</p>
      )}
    </div>
  );
}
