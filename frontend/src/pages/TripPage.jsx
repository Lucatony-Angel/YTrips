import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getTrip, getTripFlights, getTripMembers, deleteTripFlight, updateTripBanner,
  getTripItinerary, createTripItineraryItem, updateTripItineraryItem, deleteTripItineraryItem,
} from "../api/trips";
import Navbar from "../components/Navbar";
import FlightSearch from "../components/FlightSearch";
import "../App.css";

const PRESET_COLORS = [
  "#2D3BE8", "#7C3AED", "#DB2777", "#DC2626",
  "#D97706", "#16A34A", "#0891B2", "#374151",
];

const emptyItineraryForm = {
  title: "", description: "", scheduled_at: "", location: "", category: "",
};

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function getTripDateTimeBoundary(date, isEndOfDay = false) {
  if (!date) return undefined;
  return `${date}T${isEndOfDay ? "23:59" : "00:00"}`;
}

function isScheduledWithinTripDates(scheduledAt, trip) {
  if (!scheduledAt || !trip?.start_date || !trip?.end_date) return true;
  const d = scheduledAt.slice(0, 10);
  return d >= trip.start_date && d <= trip.end_date;
}

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [trip, setTrip] = useState(null);
  const [flights, setFlights] = useState([]);
  const [members, setMembers] = useState([]);
  const [itineraryItems, setItineraryItems] = useState([]);
  const [activeTab, setActiveTab] = useState("my");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBannerEdit, setShowBannerEdit] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [confirmDeleteFlight, setConfirmDeleteFlight] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Itinerary add form
  const [itineraryForm, setItineraryForm] = useState(emptyItineraryForm);
  const [itinerarySubmitting, setItinerarySubmitting] = useState(false);
  const [itineraryError, setItineraryError] = useState("");
  const [itinerarySuccess, setItinerarySuccess] = useState("");

  // Itinerary edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState(null);
  const [editModalForm, setEditModalForm] = useState(emptyItineraryForm);
  const [editModalSubmitting, setEditModalSubmitting] = useState(false);
  const [editModalError, setEditModalError] = useState("");

  // Itinerary inline delete confirm
  const [confirmDeleteItinerary, setConfirmDeleteItinerary] = useState(null);

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    Promise.all([getTrip(id), getTripFlights(id), getTripMembers(id), getTripItinerary(id)])
      .then(([tripData, flightData, memberData, itineraryData]) => {
        if (!isActive) return;
        setTrip(tripData);
        setFlights(flightData);
        setMembers(memberData);
        setItineraryItems(itineraryData);
      })
      .catch(() => { if (isActive) setError("Trip not found."); })
      .finally(() => { if (isActive) setLoading(false); });
    return () => { isActive = false; };
  }, [id]);

  const refreshFlights = async () => {
    try {
      const data = await getTripFlights(id);
      setFlights(data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to refresh flights."));
    }
  };

  const refreshItinerary = async () => {
    const data = await getTripItinerary(id);
    setItineraryItems(data);
  };

  const resetItineraryForm = () => {
    setItineraryForm(emptyItineraryForm);
    setItineraryError("");
    setItinerarySuccess("");
  };

  const openEditModal = (item) => {
    setEditModalItem(item);
    setEditModalForm({
      title: item.title,
      description: item.description,
      scheduled_at: toDateTimeLocalValue(item.scheduled_at),
      location: item.location,
      category: item.category,
    });
    setEditModalError("");
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditModalItem(null);
    setEditModalForm(emptyItineraryForm);
    setEditModalError("");
  };

  const handleEditModalFieldChange = (e) => {
    const { name, value } = e.target;
    setEditModalForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitEditModal = async (e) => {
    e.preventDefault();
    setEditModalError("");
    const rawAt = editModalForm.scheduled_at;
    const scheduled_at = rawAt.length === 16 ? rawAt + ":00" : rawAt;
    const payload = {
      title: editModalForm.title.trim(),
      description: editModalForm.description.trim(),
      scheduled_at,
      location: editModalForm.location.trim(),
      category: editModalForm.category.trim(),
    };
    if (!isScheduledWithinTripDates(payload.scheduled_at, trip)) {
      setEditModalError("Date & time must fall within the trip dates.");
      return;
    }
    setEditModalSubmitting(true);
    try {
      await updateTripItineraryItem(id, editModalItem.id, payload);
      await refreshItinerary();
      closeEditModal();
    } catch (err) {
      setEditModalError(getErrorMessage(err, "Unable to update itinerary item."));
    } finally {
      setEditModalSubmitting(false);
    }
  };

  const handleColorChange = async (color) => {
    setSavingBanner(true);
    try {
      const updated = await updateTripBanner(id, { banner_color: color, banner_image_url: null });
      setTrip(updated);
    } catch {} finally {
      setSavingBanner(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setSavingBanner(true);
      try {
        const updated = await updateTripBanner(id, { banner_image_url: ev.target.result });
        setTrip(updated);
      } catch {} finally {
        setSavingBanner(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async () => {
    setSavingBanner(true);
    try {
      const updated = await updateTripBanner(id, { banner_image_url: null });
      setTrip(updated);
    } catch {} finally {
      setSavingBanner(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const formatDateTime = (dt) =>
    dt ? new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const flightByUser = {};
  for (const f of flights) {
    if (!flightByUser[f.user_id]) flightByUser[f.user_id] = [];
    flightByUser[f.user_id].push(f);
  }

  const memberNameById = Object.fromEntries(
    members.map((m) => [m.user_id, m.user_id === user?.id ? "You" : m.display_name])
  );

  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === user?.id) return -1;
    if (b.user_id === user?.id) return 1;
    return 0;
  });

  const handleDeleteFlight = async (flightId) => {
    try {
      await deleteTripFlight(id, flightId);
      setConfirmDeleteFlight(null);
      await refreshFlights();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete flight."));
    }
  };

  const handleItineraryFieldChange = (event) => {
    const { name, value } = event.target;
    setItineraryForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmitItinerary = async (event) => {
    event.preventDefault();
    setItineraryError("");
    setItinerarySuccess("");
    const rawAt = itineraryForm.scheduled_at;
    const scheduled_at = rawAt.length === 16 ? rawAt + ":00" : rawAt;
    const payload = {
      title: itineraryForm.title.trim(),
      description: itineraryForm.description.trim(),
      scheduled_at,
      location: itineraryForm.location.trim(),
      category: itineraryForm.category.trim(),
    };
    if (!isScheduledWithinTripDates(payload.scheduled_at, trip)) {
      setItineraryError("Date & time must fall within the trip dates.");
      return;
    }
    setItinerarySubmitting(true);
    try {
      await createTripItineraryItem(id, payload);
      setItinerarySuccess("Itinerary item added.");
      await refreshItinerary();
      resetItineraryForm();
    } catch (err) {
      setItineraryError(getErrorMessage(err, "Unable to add itinerary item."));
    } finally {
      setItinerarySubmitting(false);
    }
  };

  const handleDeleteItineraryItem = async (itemId) => {
    try {
      await deleteTripItineraryItem(id, itemId);
      setConfirmDeleteItinerary(null);
      await refreshItinerary();
    } catch (err) {
      setItineraryError(getErrorMessage(err, "Unable to remove itinerary item."));
    }
  };

  const FlightCard = ({ flight, canDelete }) => (
    <div className="flight-result-card">
      <div className="flight-result-top">
        <div>
          <div className="flight-carrier">{flight.airline}</div>
          <div className="flight-route">
            {flight.departure_airport} → {flight.arrival_airport}
            <span className="flight-number-tag">· {flight.flight_number}</span>
          </div>
          <div className="flight-times">
            {formatDateTime(flight.departure_time)} → {formatDateTime(flight.arrival_time)}
          </div>
        </div>
        {canDelete && (
          confirmDeleteFlight === flight.id ? (
            <div className="flight-delete-confirm">
              <span>Remove?</span>
              <button className="confirm-yes" onClick={() => handleDeleteFlight(flight.id)}>Delete</button>
              <button className="confirm-no" onClick={() => setConfirmDeleteFlight(null)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-delete" onClick={() => setConfirmDeleteFlight(flight.id)}>
              Delete
            </button>
          )
        )}
      </div>
    </div>
  );

  const bannerStyle = trip
    ? trip.banner_image_url
      ? { backgroundImage: `url(${trip.banner_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { background: trip.banner_color || "#2D3BE8" }
    : { background: "transparent" };

  const myFlights = flightByUser[user?.id] || [];

  return (
    <div className="page">
      <Navbar />
      <div className="trip-detail-page">
        {/* Full-width banner */}
        <div className="trip-banner" style={bannerStyle}>
          <div className="trip-banner-inner">
            <button className="btn btn-back-white" onClick={() => navigate("/")}>
              ← Back to Dashboard
            </button>
            {!loading && !error && trip && (
              <div className="trip-banner-title">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <h1 style={{ flex: 1 }}>{trip.name}</h1>
                  <button
                    className="banner-edit-btn"
                    onClick={() => setShowBannerEdit((v) => !v)}
                    title="Edit banner"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit banner
                  </button>
                </div>
                <div className="trip-banner-meta">
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                    {trip.destination_name}
                  </span>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                  </span>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </span>
                </div>

                {showBannerEdit && (
                  <div className="banner-edit-panel">
                    <div className="banner-edit-section">
                      <span className="banner-edit-label">Colour</span>
                      <div className="color-picker-row">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`color-swatch${trip.banner_color === c && !trip.banner_image_url ? " selected" : ""}`}
                            style={{ background: c }}
                            onClick={() => handleColorChange(c)}
                            disabled={savingBanner}
                          />
                        ))}
                        <div className="color-custom-wrapper" title="Custom colour">
                          <div className="color-custom-swatch">+</div>
                          <input
                            type="color"
                            className="color-custom-input"
                            value={trip.banner_color || "#2D3BE8"}
                            onChange={(e) => handleColorChange(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="banner-edit-section">
                      <span className="banner-edit-label">Image</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="banner-upload-btn"
                          onClick={() => fileInputRef.current.click()}
                          disabled={savingBanner}
                        >
                          {trip.banner_image_url ? "Change image" : "Upload image"}
                        </button>
                        {trip.banner_image_url && (
                          <button
                            type="button"
                            className="banner-remove-btn"
                            onClick={handleRemoveImage}
                            disabled={savingBanner}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleImageChange}
                      />
                    </div>
                    {savingBanner && <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Saving…</span>}
                  </div>
                )}
              </div>
            )}
            {loading && <p style={{ color: "rgba(255,255,255,0.8)" }}>Loading…</p>}
            {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
          </div>
        </div>

        {!loading && !error && (
          <div className="page-body">
            {/* Invite Code */}
            <div className="card">
              <h3>Invite Code</h3>
              <p className="text-sub" style={{ marginTop: 4, marginBottom: 16 }}>
                Share this code with friends so they can join the trip.
              </p>
              <div className="trip-invite-full">
                <code>{trip.invite_code}</code>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { navigator.clipboard.writeText(trip.invite_code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {copiedCode ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Main tabbed card */}
            <div className="card">
              <div className="flight-tabs">
                <button className={`flight-tab${activeTab === "my" ? " active" : ""}`} onClick={() => setActiveTab("my")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                  My Flight
                </button>
                <button className={`flight-tab${activeTab === "group" ? " active" : ""}`} onClick={() => setActiveTab("group")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Group Flights
                </button>
                <button className={`flight-tab${activeTab === "itinerary" ? " active" : ""}`} onClick={() => setActiveTab("itinerary")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Itinerary
                  <span className="tab-count">{itineraryItems.length}</span>
                </button>
                <button className={`flight-tab${activeTab === "members" ? " active" : ""}`} onClick={() => setActiveTab("members")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Members
                  <span className="tab-count">{members.length}</span>
                </button>
              </div>

              {/* My Flight */}
              {activeTab === "my" && (
                <div className="mt-md">
                  <div className="member-flight-label" style={{ marginBottom: 8 }}>
                    <span className="member-flight-name">My Flight</span>
                    <span className="trip-badge">You</span>
                  </div>
                  {myFlights.length > 0 ? (
                    <div className="flight-results">
                      {myFlights.map((f) => <FlightCard key={f.id} flight={f} canDelete={true} />)}
                    </div>
                  ) : (
                    <p className="text-sub">No flight added yet. Search and add your flight below!</p>
                  )}
                </div>
              )}

              {/* Group Flights */}
              {activeTab === "group" && (
                <div className="gap-col mt-md">
                  {sortedMembers.map((member) => {
                    const isMe = member.user_id === user?.id;
                    const memberFlights = flightByUser[member.user_id] || [];
                    return (
                      <div key={member.user_id}>
                        <div className="member-flight-label">
                          <span className="member-flight-name">{isMe ? "My Flight" : member.display_name}</span>
                          {isMe && <span className="trip-badge">You</span>}
                        </div>
                        {memberFlights.length > 0 ? (
                          <div className="flight-results mt-sm">
                            {memberFlights.map((f) => <FlightCard key={f.id} flight={f} canDelete={isMe} />)}
                          </div>
                        ) : (
                          <p className="text-sub" style={{ marginTop: 6 }}>No flight added yet.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Itinerary */}
              {activeTab === "itinerary" && (
                <div className="mt-md">
                  <form className="itinerary-form" onSubmit={handleSubmitItinerary}>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="itinerary-title">Title</label>
                        <input id="itinerary-title" name="title" value={itineraryForm.title} onChange={handleItineraryFieldChange} placeholder="Sunset dinner" required />
                      </div>
                      <div className="form-group">
                        <label htmlFor="itinerary-category">Category</label>
                        <input id="itinerary-category" name="category" value={itineraryForm.category} onChange={handleItineraryFieldChange} placeholder="Food, activity, transit…" required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="itinerary-datetime">Date &amp; Time</label>
                        <input id="itinerary-datetime" type="datetime-local" name="scheduled_at" value={itineraryForm.scheduled_at} onChange={handleItineraryFieldChange} min={getTripDateTimeBoundary(trip?.start_date)} max={getTripDateTimeBoundary(trip?.end_date, true)} required />
                      </div>
                      <div className="form-group">
                        <label htmlFor="itinerary-location">Location</label>
                        <input id="itinerary-location" name="location" value={itineraryForm.location} onChange={handleItineraryFieldChange} placeholder="123 Ocean Ave" required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="itinerary-description">Description</label>
                      <textarea id="itinerary-description" name="description" value={itineraryForm.description} onChange={handleItineraryFieldChange} placeholder="Add notes, meeting details, reservation info, or links." rows={3} required />
                    </div>
                    {itineraryError && <p className="error-text">{itineraryError}</p>}
                    {itinerarySuccess && <p className="text-success">{itinerarySuccess}</p>}
                    <div className="itinerary-form-actions">
                      <button type="submit" className="btn btn-primary" disabled={itinerarySubmitting}>
                        {itinerarySubmitting ? "Adding…" : "Add Item"}
                      </button>
                    </div>
                  </form>

                  {itineraryItems.length > 0 ? (
                    <div className="itinerary-list">
                      {itineraryItems.map((item) => (
                        <div className="itinerary-card" key={item.id}>
                          <div className="itinerary-card-top">
                            <div style={{ flex: 1 }}>
                              <div className="itinerary-card-title-row">
                                <h4>{item.title}</h4>
                                <span className="trip-badge">{item.category}</span>
                              </div>
                              <div className="itinerary-meta">
                                <span>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  {formatDateTime(item.scheduled_at)}
                                </span>
                                <span>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                  {item.location}
                                </span>
                                <span>Added by {memberNameById[item.created_by_user_id] || "A trip member"}</span>
                              </div>
                              {item.description && <p className="itinerary-description">{item.description}</p>}
                            </div>
                            <div className="itinerary-actions">
                              {confirmDeleteItinerary === item.id ? (
                                <div className="flight-delete-confirm">
                                  <span>Remove?</span>
                                  <button className="confirm-yes" onClick={() => handleDeleteItineraryItem(item.id)}>Delete</button>
                                  <button className="confirm-no" onClick={() => setConfirmDeleteItinerary(null)}>Cancel</button>
                                </div>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditModal(item)}>Edit</button>
                                  <button type="button" className="btn btn-delete" onClick={() => setConfirmDeleteItinerary(item.id)}>Delete</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="itinerary-empty">
                      <h4>No itinerary items yet</h4>
                      <p>Start building the plan with activities, reservations, transfers, or meetups.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Members */}
              {activeTab === "members" && (
                <div className="members-list mt-md">
                  {sortedMembers.map((member) => {
                    const isMe = member.user_id === user?.id;
                    const initials = member.display_name
                      ? member.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                      : "?";
                    return (
                      <div key={member.user_id} className="member-row">
                        <div className="member-avatar">
                          {member.avatar_url
                            ? <img src={member.avatar_url} alt={member.display_name} />
                            : <span>{initials}</span>
                          }
                        </div>
                        <div className="member-info">
                          <div className="member-info-top">
                            <span className="member-info-name">{isMe ? "You" : member.display_name}</span>
                            {member.role === "owner" && <span className="member-role-badge">Owner</span>}
                          </div>
                          <span className="member-info-sub">{member.display_name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search & Add Flights */}
            <div className="card">
              <h3 className="mb-lg">Search &amp; Add Flights</h3>
              <FlightSearch
                tripId={parseInt(id)}
                destination={trip.destination_name}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
                tripArrivalWindow={
                  trip.arrival_window_start
                    ? { arrival_window_start: trip.arrival_window_start, arrival_window_end: trip.arrival_window_end }
                    : null
                }
                onFlightAdded={refreshFlights}
                myFlights={myFlights}
              />
            </div>
          </div>
        )}
      </div>

      {/* Edit itinerary modal */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Itinerary Item</h3>
              <button className="modal-close" onClick={closeEditModal}>✕</button>
            </div>
            <form onSubmit={handleSubmitEditModal}>
              <div className="form-row">
                <div className="form-group">
                  <label>Title</label>
                  <input name="title" value={editModalForm.title} onChange={handleEditModalFieldChange} required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input name="category" value={editModalForm.category} onChange={handleEditModalFieldChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date &amp; Time</label>
                  <input type="datetime-local" name="scheduled_at" value={editModalForm.scheduled_at} onChange={handleEditModalFieldChange} min={getTripDateTimeBoundary(trip?.start_date)} max={getTripDateTimeBoundary(trip?.end_date, true)} required />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input name="location" value={editModalForm.location} onChange={handleEditModalFieldChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={editModalForm.description} onChange={handleEditModalFieldChange} rows={3} required />
              </div>
              {editModalError && <p className="error-text">{editModalError}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeEditModal} disabled={editModalSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editModalSubmitting}>
                  {editModalSubmitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
