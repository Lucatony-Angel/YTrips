import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTrips } from "../api/trips";

export default function TripDashboard({ refreshTrigger, onNewTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getTrips()
      .then(setTrips)
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const copyInviteCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  if (loading) {
    return <p style={{ color: "var(--subtext)", padding: "40px 0" }}>Loading trips…</p>;
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
      {trips.map((trip) => (
        <div key={trip.id} className="trip-card" onClick={() => navigate(`/trips/${trip.id}`)}>
          <div className="trip-card-header">
            <h3>{trip.name}</h3>
            <span className="trip-badge">Trip</span>
          </div>
          <div className="trip-card-dest">
            <span>📍</span>
            <span>{trip.destination_name}</span>
          </div>
          <div className="trip-card-dates">
            {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
          </div>
          {trip.invite_code && (
            <div className="trip-invite" onClick={(e) => e.stopPropagation()}>
              <code>{trip.invite_code}</code>
              <button onClick={() => copyInviteCode(trip.invite_code, trip.id)}>
                {copied === trip.id ? "Copied!" : "Copy invite"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
