import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { ProfessionalDropdown } from "./ProfessionalDropdown";

type ProfessionalDatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "datetime";
  min?: string;
  placeholder?: string;
  variant?: "patient" | "doctor" | "default";
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function timeFromValue(value?: string) {
  return value?.includes("T") ? value.slice(11, 16) : "";
}

function timeParts(value: string) {
  const [hoursValue, minutesValue] = value.split(":").map(Number);
  const period = hoursValue >= 12 ? "PM" : "AM";
  const hour12 = hoursValue % 12 || 12;
  return {
    hour: pad(hour12),
    minute: pad(minutesValue || 0),
    period,
  };
}

function toTwentyFourHourTime(hour: string, minute: string, period: string) {
  let nextHour = Number(hour);
  if (period === "PM" && nextHour !== 12) nextHour += 12;
  if (period === "AM" && nextHour === 12) nextHour = 0;
  return `${pad(nextHour)}:${minute}`;
}

function clampTimeForMin(date: Date, time: string, min?: string) {
  if (!min || !min.includes("T") || dateKey(date) !== min.slice(0, 10)) return time;
  const minTime = min.slice(11, 16);
  return time < minTime ? minTime : time;
}

function displayValue(value: string, mode: "date" | "datetime") {
  const date = parseDateKey(value);
  if (!date) return "";

  const dateText = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (mode === "date") return dateText;

  const time = timeFromValue(value);
  if (!time) return dateText;

  const [hours, minutes] = time.split(":").map(Number);
  const withTime = new Date(date);
  withTime.setHours(hours || 0, minutes || 0, 0, 0);

  return `${dateText}, ${withTime.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function buildCalendarDays(viewDate: Date) {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstCell = new Date(firstOfMonth);
  firstCell.setDate(firstOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return date;
  });
}

export function ProfessionalDatePicker({
  id,
  value,
  onChange,
  mode = "date",
  min,
  placeholder,
  variant = "default",
}: ProfessionalDatePickerProps) {
  const generatedId = useId();
  const buttonId = id || generatedId;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = parseDateKey(value);
  const minDate = parseDateKey(min);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate || minDate || new Date());
  const [time, setTime] = useState(timeFromValue(value) || timeFromValue(min) || "09:00");

  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const display = displayValue(value, mode);

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate);
    const nextTime = timeFromValue(value);
    if (nextTime) setTime(nextTime);
  }, [value]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selectDate = (date: Date) => {
    if (minDate && dateKey(date) < dateKey(minDate)) return;

    if (mode === "date") {
      onChange(dateKey(date));
      setOpen(false);
      return;
    }

    const nextTime = clampTimeForMin(date, time, min);
    setTime(nextTime);
    onChange(`${dateKey(date)}T${nextTime}`);
  };

  const commitTime = (nextTime: string) => {
    setTime(nextTime);
    const date = selectedDate || minDate || new Date();
    const clampedTime = clampTimeForMin(date, nextTime, min);
    onChange(`${dateKey(date)}T${clampedTime}`);
  };

  const commitTimePart = (part: "hour" | "minute" | "period", nextValue: string) => {
    const current = timeParts(time);
    const nextTime = toTwentyFourHourTime(
      part === "hour" ? nextValue : current.hour,
      part === "minute" ? nextValue : current.minute,
      part === "period" ? nextValue : current.period,
    );
    commitTime(nextTime);
  };

  const currentTime = timeParts(time);

  return (
    <div ref={rootRef} className={`professional-date-picker professional-date-picker--${variant} ${open ? "is-open" : ""}`}>
      <button
        id={buttonId}
        type="button"
        className="professional-date-picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="professional-date-picker__icon">
          <CalendarDays size={17} strokeWidth={2.3} />
        </span>
        <span className={display ? "professional-date-picker__value" : "professional-date-picker__placeholder"}>
          {display || placeholder || (mode === "datetime" ? "Select date and time" : "Select date")}
        </span>
      </button>

      {open ? (
        <div className="professional-date-picker__panel" role="dialog" aria-labelledby={buttonId}>
          <div className="professional-date-picker__header">
            <button
              type="button"
              className="professional-date-picker__nav"
              aria-label="Previous month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <div className="professional-date-picker__month">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button
              type="button"
              className="professional-date-picker__nav"
              aria-label="Next month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="professional-date-picker__weekdays">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="professional-date-picker__grid">
            {days.map((date) => {
              const key = dateKey(date);
              const outside = date.getMonth() !== viewDate.getMonth();
              const selected = selectedDate ? key === dateKey(selectedDate) : false;
              const today = key === dateKey(new Date());
              const disabled = minDate ? key < dateKey(minDate) : false;

              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    "professional-date-picker__day",
                    outside ? "is-outside" : "",
                    selected ? "is-selected" : "",
                    today ? "is-today" : "",
                    disabled ? "is-disabled" : "",
                  ].filter(Boolean).join(" ")}
                  disabled={disabled}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {mode === "datetime" ? (
            <div className="professional-date-picker__time-row">
              <div className="professional-date-picker__time-label">
                <Clock size={15} /> Time
              </div>
              <ProfessionalDropdown
                variant={variant === "doctor" ? "doctor" : "patient"}
                value={currentTime.hour}
                onChange={(nextValue) => commitTimePart("hour", nextValue)}
                options={HOURS.map((hour) => ({ value: hour, label: hour }))}
              />
              <ProfessionalDropdown
                variant={variant === "doctor" ? "doctor" : "patient"}
                value={currentTime.minute}
                onChange={(nextValue) => commitTimePart("minute", nextValue)}
                options={MINUTES.map((minute) => ({ value: minute, label: minute }))}
              />
              <ProfessionalDropdown
                variant={variant === "doctor" ? "doctor" : "patient"}
                value={currentTime.period}
                onChange={(nextValue) => commitTimePart("period", nextValue)}
                options={[
                  { value: "AM", label: "AM" },
                  { value: "PM", label: "PM" },
                ]}
              />
              <button type="button" className="professional-date-picker__done" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
