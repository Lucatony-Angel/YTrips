import { useState } from "react";
import DualRangeSlider from "./DualRangeSlider";

const fmt = (h) => `${String(h).padStart(2, "0")}:00`;

const isoHour = (iso) => (iso ? parseInt(iso.slice(11, 13), 10) : null);
const isoDate = (iso) => (iso ? iso.slice(0, 10) : "");

export default function ArrivalWindowPicker({
  tripStart,        // min selectable date
  tripEnd,          // max selectable date
  defaultDate, 
  existingWindow,   // prefill sliders
  onConfirm,
  onClose,
}) {
  const initDate = isoDate(existingWindow?.arrival_window_start) || defaultDate || tripStart || "";
  const initStart = isoHour(existingWindow?.arrival_window_start) ?? 10;
  const initEnd = isoHour(existingWindow?.arrival_window_end) ?? 18;

  const [date, setDate] = useState(initDate);
  const [startHour, setStartHour] = useState(initStart);
  const [endHour, setEndHour] = useState(initEnd);

  const handleConfirm = () => {
    if (!date) return;
    onConfirm({
      arrival_window_start: `${date}T${fmt(startHour)}`,
      arrival_window_end: `${date}T${fmt(endHour)}`,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Set Arrival Window</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="form-group">
            <label>Arrival Date</label>
            <input
              type="date"
              value={date}
              min={tripStart || undefined}
              max={tripEnd || undefined}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 500, display: "block", marginBottom: 12 }}>
              Arrive between
            </label>

            <div className="window-time-display">
              <span className="window-time-badge">{fmt(startHour)}</span>
              <span style={{ color: "var(--subtext)", fontSize: 14 }}>to</span>
              <span className="window-time-badge">{fmt(endHour)}</span>
            </div>

            <DualRangeSlider
              min={0}
              max={23}
              startValue={startHour}
              endValue={endHour}
              onChange={(s, e) => { setStartHour(s); setEndHour(e); }}
            />
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!date}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
