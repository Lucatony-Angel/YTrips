import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTrip, getTripFlights, getTripMembers, deleteTripFlight, updateTripBanner } from "../api/trips";
import Navbar from "../components/Navbar";
import FlightSearch from "../components/FlightSearch";
import "../App.css";

const PRESET_COLORS = [
  "#2D3BE8", "#7C3AED", "#DB2777", "#DC2626",
  "#D97706", "#16A34A", "#0891B2", "#374151",
];

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [trip, setTrip] = useState(null);
  const [flights, setFlights] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState("my");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBannerEdit, setShowBannerEdit] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [confirmDeleteFlight, setConfirmDeleteFlight] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    Promise.all([getTrip(id), getTripFlights(id), getTripMembers(id)])
      .then(([tripData, flightData, memberData]) => {
        setTrip(tripData);
        setFlights(flightData);
        setMembers(memberData);
      })
      .catch(() => setError("Trip not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshFlights = () => {
    getTripFlights(id).then(setFlights).catch(() => {});
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
    dt ? new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const flightByUser = {};
  for (const f of flights) {
    if (!flightByUser[f.user_id]) flightByUser[f.user_id] = [];
    flightByUser[f.user_id].push(f);
  }

  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === user?.id) return -1;
    if (b.user_id === user?.id) return 1;
    return 0;
  });

  const handleDeleteFlight = async (flightId) => {
    try {
      await deleteTripFlight(id, flightId);
      setConfirmDeleteFlight(null);
      refreshFlights();
    } catch {}
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

                {/* Inline banner editor */}
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

            {/* Flights with tabs */}
            <div className="card">
              <div className="flight-tabs">
                <button
                  className={`flight-tab${activeTab === "my" ? " active" : ""}`}
                  onClick={() => setActiveTab("my")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                  My Flight
                </button>
                <button
                  className={`flight-tab${activeTab === "group" ? " active" : ""}`}
                  onClick={() => setActiveTab("group")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Group Flights
                </button>
                <button
                  className={`flight-tab${activeTab === "members" ? " active" : ""}`}
                  onClick={() => setActiveTab("members")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Members
                  <span className="tab-count">{members.length}</span>
                </button>
              </div>

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

              {activeTab === "group" && (
                <div className="gap-col mt-md">
                  {sortedMembers.map((member) => {
                    const isMe = member.user_id === user?.id;
                    const memberFlights = flightByUser[member.user_id] || [];
                    return (
                      <div key={member.user_id}>
                        <div className="member-flight-label">
                          <span className="member-flight-name">
                            {isMe ? "My Flight" : member.display_name}
                          </span>
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

            {/* Search */}
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
    </div>
  );
}
