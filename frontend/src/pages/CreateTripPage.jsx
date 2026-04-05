import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createTrip } from "../api/trips";
import ArrivalWindowPicker from "../components/ArrivalWindowPicker";
import Navbar from "../components/Navbar";
import "../App.css";

const PRESET_COLORS = [
  "#2D3BE8", "#7C3AED", "#DB2777", "#DC2626",
  "#D97706", "#16A34A", "#0891B2", "#374151",
];

const fmtWindow = (iso) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : null;

export default function CreateTripPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    destination_name: "",
    start_date: "",
    end_date: "",
    arrival_window_start: null,
    arrival_window_end: null,
    banner_color: "#2D3BE8",
    banner_image_url: null,
  });
  const [bannerPreview, setBannerPreview] = useState(null);
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBannerPreview(ev.target.result);
      setForm((prev) => ({ ...prev, banner_image_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.destination_name || !form.start_date || !form.end_date) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.start_date > form.end_date) {
      setError("End date must be on or after start date.");
      return;
    }

    try {
      setLoading(true);
      await createTrip(form);
      navigate("/");
    } catch {
      setError("Failed to create trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const windowSet = form.arrival_window_start && form.arrival_window_end;

  const bannerStyle = bannerPreview
    ? { backgroundImage: `url(${bannerPreview})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: form.banner_color };

  return (
    <div className="page">
      <Navbar />
      <div className="create-trip-page">
        {/* Banner preview */}
        <div className="create-trip-banner" style={bannerStyle}>
          <button
            type="button"
            className="banner-upload-btn"
            onClick={() => fileInputRef.current.click()}
          >
            {bannerPreview ? "Change Image" : "Add Banner Image"}
          </button>
          {bannerPreview && (
            <button
              type="button"
              className="banner-remove-btn"
              onClick={() => { setBannerPreview(null); setForm((f) => ({ ...f, banner_image_url: null })); }}
            >
              Remove
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageChange}
          />
        </div>

        <div className="create-trip-body">
          <div className="create-trip-inner">
            <div className="create-trip-top">
              <button className="btn btn-outline btn-sm btn-back" onClick={() => navigate("/")}>
                ← Back
              </button>
              <h1>Create a New Trip</h1>
            </div>

            <form className="create-trip-form" onSubmit={handleSubmit}>
              {/* Banner colour (only shown when no image) */}
              {!bannerPreview && (
                <div className="form-group">
                  <label>Banner Colour</label>
                  <div className="color-picker-row">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`color-swatch${form.banner_color === c ? " selected" : ""}`}
                        style={{ background: c }}
                        onClick={() => setForm((f) => ({ ...f, banner_color: c }))}
                      />
                    ))}
                    <div className="color-custom-wrapper" title="Custom colour">
                      <div className="color-custom-swatch">+</div>
                      <input
                        type="color"
                        className="color-custom-input"
                        value={form.banner_color}
                        onChange={(e) => setForm((f) => ({ ...f, banner_color: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

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
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    name="end_date"
                    value={form.end_date}
                    min={form.start_date || undefined}
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

              <div className="create-trip-actions">
                <button type="button" className="btn btn-outline" onClick={() => navigate("/")}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Creating…" : "Create Trip"}
                </button>
              </div>
            </form>
          </div>
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
    </div>
  );
}
