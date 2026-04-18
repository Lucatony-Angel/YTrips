import { useState } from "react";
import { createTrip } from "../api/trips";
import ArrivalWindowPicker from "./ArrivalWindowPicker";

const fmtWindow = (iso) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : null;

const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function CreateTrip({ onTripCreated, onClose }) {
  const today = getTodayIsoDate();
  const [form, setForm] = useState({
    name: "",
    destination_name: "",
    start_date: "",
    end_date: "",
    arrival_window_start: null,
    arrival_window_end: null,
  });
  const [showWindowPicker, setShowWindowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "start_date" && next.end_date && value > next.end_date) {
        next.end_date = "";
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.destination_name || !form.start_date || !form.end_date) {
      setError("Please fill in all required fields.");
      return;
    }

    if (form.start_date < today) {
      setError("Start date cannot be in the past.");
      return;
    }

    if (form.start_date > form.end_date) {
      setError("End date must be on or after start date.");
      return;
    }

    try {
      setLoading(true);
      await createTrip(form);
      onTripCreated();
      onClose();
    } catch (err) {
      const data = err?.response?.data;
      const errors = data?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        setError(errors.map((e) => e.message.replace(/^Value error,\s*/i, "")).join(" "));
      } else if (typeof data?.detail === "string" && data.detail !== "Validation error") {
        setError(data.detail);
      } else {
        setError("Failed to create trip. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const windowSet = form.arrival_window_start && form.arrival_window_end;

  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-header">
            <h2>Create a New Trip</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Trip Name *</label>
              <input
                name="name"
                placeholder="e.g. Summer in Cancun"
                value={form.name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Destination *</label>
              <input
                name="destination_name"
                placeholder="e.g. Cancun, Mexico"
                value={form.destination_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  lang="en-US"
                  name="start_date"
                  value={form.start_date}
                  min={today}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  lang="en-US"
                  name="end_date"
                  value={form.end_date}
                  min={form.start_date || today}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="label-inline">
                Arrival Window <span className="label-hint">(optional)</span>
              </label>
              {windowSet ? (
                <div className="window-summary">
                  <span>{fmtWindow(form.arrival_window_start)} – {fmtWindow(form.arrival_window_end)}</span>
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => setShowWindowPicker(true)}>Edit</button>
                  <button type="button" className="btn-icon" onClick={() => setForm((f) => ({ ...f, arrival_window_start: null, arrival_window_end: null }))}>×</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!form.start_date || !form.end_date}
                  onClick={() => setShowWindowPicker(true)}
                >
                  + Set Arrival Window
                </button>
              )}
            </div>

            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Creating…" : "Create Trip"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showWindowPicker && (
        <ArrivalWindowPicker
          tripStart={form.start_date}
          tripEnd={form.end_date}
          onConfirm={(w) => setForm((f) => ({ ...f, ...w }))}
          onClose={() => setShowWindowPicker(false)}
        />
      )}
    </>
  );
}
