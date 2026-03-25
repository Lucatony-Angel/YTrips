import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTrip, getTripFlights, getTripMembers, deleteTripFlight } from "../api/trips";
import Navbar from "../components/Navbar";
import FlightSearch from "../components/FlightSearch";
import "../App.css";

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [flights, setFlights] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
            <span style={{ marginLeft: 8, color: "var(--subtext)", fontWeight: 500 }}>· {flight.flight_number}</span>
          </div>
          <div className="flight-times">
            {formatDateTime(flight.departure_time)} → {formatDateTime(flight.arrival_time)}
          </div>
        </div>
        {canDelete && (
          <button
            className="btn btn-delete"
            onClick={() => handleDeleteFlight(flight.id)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="page">
      <Navbar />
      <div className="trip-detail-page">
        <div className="trip-detail-header">
          <div className="trip-detail-header-inner">
            <button className="btn btn-outline btn-back" onClick={() => navigate("/")}>
              ← Back
            </button>
            {loading ? (
              <p style={{ color: "var(--subtext)" }}>Loading…</p>
            ) : error ? (
              <p className="error-text">{error}</p>
            ) : (
              <div className="trip-detail-title">
                <h1>{trip.name}</h1>
                <div className="trip-detail-meta">
                  <span>📍 {trip.destination_name}</span>
                  <span>📅 {formatDate(trip.start_date)} → {formatDate(trip.end_date)}</span>
                  {trip.arrival_window_start && (
                    <span>🕐 Arrival window: {formatDateTime(trip.arrival_window_start)} → {formatDateTime(trip.arrival_window_end)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {!loading && !error && (
          <div className="trip-detail-body">
            <div className="trip-detail-invite card">
              <h3>Invite Code</h3>
              <p style={{ color: "var(--subtext)", fontSize: 14, marginTop: 4, marginBottom: 12 }}>
                Share this code with friends so they can join the trip.
              </p>
              <div className="trip-invite" style={{ maxWidth: 360 }}>
                <code>{trip.invite_code}</code>
                <button onClick={() => navigator.clipboard.writeText(trip.invite_code)}>Copy</button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Flights</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                        <div className="flight-results" style={{ marginTop: 8 }}>
                          {memberFlights.map((f) => <FlightCard key={f.id} flight={f} canDelete={isMe} />)}
                        </div>
                      ) : (
                        <p style={{ color: "var(--subtext)", fontSize: 14, marginTop: 6 }}>
                          No flight added yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Search &amp; Add Flights</h3>
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
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
