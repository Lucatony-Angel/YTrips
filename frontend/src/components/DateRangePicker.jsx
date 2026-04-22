import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/src/style.css";

function parseLocal(str) {
  if (!str) return undefined;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDisplay(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const todayLocal = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

export default function DateRangePicker({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ from: parseLocal(startDate), to: parseLocal(endDate) });
  // "start" = waiting for first click, "end" = waiting for second click
  const [phase, setPhase] = useState("start");
  const containerRef = useRef(null);

  // Only sync props → range when the calendar is closed, so an in-progress
  // selection is never interrupted by a parent re-render.
  useEffect(() => {
    if (!open) {
      setRange({ from: parseLocal(startDate), to: parseLocal(endDate) });
    }
  }, [startDate, endDate, open]);

  // Reset phase every time the calendar closes.
  useEffect(() => {
    if (!open) setPhase("start");
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (r) => {
    if (phase === "start") {
      // First click — capture whichever date react-day-picker resolved as "from"
      // (it may also set "to" to the same date; we ignore "to" here intentionally).
      const from = r?.from;
      if (!from) return;
      setRange({ from, to: undefined });
      setPhase("end");
      onChange({ start_date: toDateStr(from), end_date: "" });
    } else {
      // Second click — accept the full range react-day-picker gives us.
      // It always orders from <= to, and sets to = from for a same-day trip.
      if (!r?.from) return;
      const from = r.from;
      const to = r.to ?? r.from;
      setRange({ from, to });
      setPhase("start");
      onChange({ start_date: toDateStr(from), end_date: toDateStr(to) });
      setOpen(false);
    }
  };

  const label = startDate && endDate
    ? `${fmtDisplay(startDate)}  →  ${fmtDisplay(endDate)}`
    : startDate
    ? `${fmtDisplay(startDate)}  →  Pick end date`
    : null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 14px",
          border: `1.5px solid ${open ? "var(--blue)" : "var(--border)"}`,
          borderRadius: 8,
          background: "var(--bg-input)",
          color: label ? "var(--text)" : "#9CA3AF",
          fontSize: 15,
          cursor: "pointer",
          fontFamily: "var(--font)",
          transition: "border-color 0.15s",
        }}
      >
        {label ?? "Select trip dates"}
      </button>

      {open && (
        <div
          className="rdp-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            background: "var(--bg-card)",
            border: "1.5px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            padding: 16,
            "--rdp-accent-color": "#2D3BE8",
            "--rdp-accent-background-color": "#EEF0FD",
            "--rdp-range_middle-color": "#111827",
            "--rdp-day_button-border-radius": "8px",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--blue)", fontWeight: 600, marginBottom: 12, textAlign: "center" }}>
            {phase === "start" ? "Select a start date" : "Now select an end date"}
          </p>
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={handleSelect}
            disabled={{ before: todayLocal }}
            showOutsideDays
          />
        </div>
      )}
    </div>
  );
}
