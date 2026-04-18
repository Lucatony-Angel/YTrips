import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTrips, deleteTrip } from "../api/trips";

const [fetchError, setFetchError] = useState("");

export default function TripDashboard({ refreshTrigger, onNewTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // trip id pending delete
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getTrips()
      .then(setTrips)
      .catch(() => {
        setTrips([]);
        setFetchError("Unable to load trips. Please refresh.");
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const copyInviteCode = (code, id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (e, tripId) => {
    e.stopPropagation();
    try {
      await deleteTrip(tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch (err) {
      alert("Unable to delete trip. Please try again.")
    }
    setConfirmDelete(null);
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  if (loading) {
    return <p style={{ color: "var(--subtext)", padding: "40px 0" }}>Loading trips…</p>;
  }

  if (fetchError){
    return <p style={{ color: "red", padding: "40x 0" }}>{fetchError}</p>;
  }

  if (trips.length === 0) {
    return (
      <div className="empty-state">
        <h3>No trips yet</h3>
        <p>Create your first trip and invite your friends.</p>
        <button className="btn btn-primary" onClick={onNewTrip}>
          + New Trip
        </button>
      </div>
    );
  }

  return (
    <div className="trips-grid">
      {trips.map((trip) => {
        const bannerStyle = trip.banner_image_url
          ? { backgroundImage: `url(${trip.banner_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: trip.banner_color || "#2D3BE8" };

        const shortCode = trip.invite_code ? trip.invite_code.slice(0, 18) + "..." : "";
        const isPendingDelete = confirmDelete === trip.id;

        return (
          <div key={trip.id} className="trip-card" onClick={() => navigate(`/trips/${trip.id}`)}>
            <div className="trip-card-banner" style={bannerStyle}>
              {/* Delete button lives on the banner */}
              <button
                className="trip-card-delete-btn"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(isPendingDelete ? null : trip.id); }}
                title="Delete trip"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
              {isPendingDelete && (
                <div className="trip-card-delete-confirm" onClick={(e) => e.stopPropagation()}>
                  <span>Delete this trip?</span>
                  <button className="confirm-yes" onClick={(e) => handleDelete(e, trip.id)}>Delete</button>
                  <button className="confirm-no" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}>Cancel</button>
                </div>
              )}
            </div>
            <div className="trip-card-content">
              <h3>{trip.name}</h3>
              <div className="trip-card-meta">
                <span className="trip-meta-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                  {trip.destination_name}
                </span>
                <span className="trip-meta-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                </span>
                {trip.member_count != null && (
                  <span className="trip-meta-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {trip.member_count} {trip.member_count === 1 ? "member" : "members"}
                  </span>
                )}
              </div>
              {trip.invite_code && (
                <div className="trip-card-invite" onClick={(e) => e.stopPropagation()}>
                  <span className="trip-card-invite-code">{shortCode}</span>
                  <button className="trip-card-copy-btn" onClick={(e) => copyInviteCode(trip.invite_code, trip.id, e)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    {copied === trip.id ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Create new trip card */}
      <div className="trip-card trip-card-new" onClick={onNewTrip}>
        <div className="trip-card-new-inner">
          <div className="trip-card-new-icon">+</div>
          <h3>Create New Trip</h3>
          <p>Start planning your next adventure</p>
        </div>
      </div>
    </div>
  );
}
