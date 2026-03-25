import { useState } from "react";
import { searchFlights, addFlight } from "../api/flights";
import ArrivalWindowPicker from "./ArrivalWindowPicker";

const isoHour = (iso) => (iso ? parseInt(iso.slice(11, 13), 10) : null);
const fmtHour = (iso) => iso ? `${iso.slice(11, 16)}` : null;

export default function FlightSearch({ tripId, destination, tripStartDate, tripEndDate, tripArrivalWindow, onFlightAdded }) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState(destination || "");
  const [date, setDate] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(null);
  const [error, setError] = useState("");

  const [window_, setWindow] = useState(tripArrivalWindow || null);
  const [showWindowPicker, setShowWindowPicker] = useState(false);

  const handleSearch = async () => {
    if (!origin || !dest || !date) {
      setError("Please fill in origin, destination, and date.");
      return;
    }
    if (tripStartDate && date < tripStartDate) {
      setError(`Flight date cannot be before the trip start (${tripStartDate}).`);
      return;
    }
    if (tripEndDate && date > tripEndDate) {
      setError(`Flight date cannot be after the trip end (${tripEndDate}).`);
      return;
    }
    setError("");
    setResults([]);
    setLoading(true);
    try {
      const data = await searchFlights({ origin, destination: dest, departure_date: date });
      setResults(Array.isArray(data) ? data : []);
      if (!data?.length) setError("No flights found for that route and date.");
    } catch {
      setError("Flight search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFlight = async (flight, segment) => {
    try {
      await addFlight({
        trip_id: tripId,
        airline: flight.owner_name,
        flight_number: segment.flight_number,
        departure_airport: segment.origin,
        arrival_airport: segment.destination,
        departure_time: segment.departing_at,
        arrival_time: segment.arriving_at,
      });
      setAdded(segment.flight_number);
      setTimeout(() => setAdded(null), 2500);
      if (onFlightAdded) onFlightAdded();
    } catch {
      setError("Failed to add flight.");
    }
  };

  const formatDateTime = (dt) =>
    dt ? new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const filteredResults = results.filter((flight) => {
    if (!window_) return true;
    const lastSeg = flight.segments?.[flight.segments.length - 1];
    if (!lastSeg) return false;
    const arrHour = isoHour(lastSeg.arriving_at);
    const winStart = isoHour(window_.arrival_window_start);
    const winEnd = isoHour(window_.arrival_window_end);
    return arrHour >= winStart && arrHour <= winEnd;
  });

  const hiddenCount = results.length - filteredResults.length;

  return (
    <div className="flight-search">
      <div className="flight-search-form">
        <div className="form-group">
          <label>From (IATA)</label>
          <input
            placeholder="e.g. LAX JFK etc"
            value={origin}
            onChange={(e) => setOrigin(e.target.value.toUpperCase())}
            maxLength={4}
          />
        </div>
        <div className="form-group">
          <label>To (IATA)</label>
          <input
            placeholder="e.g. ORD"
            value={dest}
            onChange={(e) => setDest(e.target.value.toUpperCase())}
            maxLength={4}
          />
        </div>
        <div className="form-group">
          <label>Flight Date</label>
          <input
            type="date"
            value={date}
            min={tripStartDate || undefined}
            max={tripEndDate || undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button className="btn btn-primary flight-search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? "Searching…" : "Search Flights"}
        </button>
      </div>

      <div className="flight-window-row">
        <span style={{ fontSize: 14, fontWeight: 500 }}>Arrival Window</span>
        {window_ ? (
          <div className="window-summary" style={{ flex: 1 }}>
            <span>🕐 {fmtHour(window_.arrival_window_start)} – {fmtHour(window_.arrival_window_end)}</span>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => setShowWindowPicker(true)}
            >
              Edit
            </button>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "var(--subtext)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}
              onClick={() => setWindow(null)}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 13 }}
            onClick={() => setShowWindowPicker(true)}
          >
            + Set Window
          </button>
        )}
      </div>

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
      {added && <p style={{ color: "#16A34A", fontSize: 14, marginTop: 12 }}>✓ Flight {added} added to trip!</p>}

      {results.length > 0 && (
        <div className="flight-results">
          {filteredResults.length === 0 ? (
            <p style={{ color: "var(--subtext)", fontSize: 14 }}>
              No flights arrive within your window. <button style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", padding: 0, fontSize: 14 }} onClick={() => setWindow(null)}>Clear window</button> to see all {results.length} results.
            </p>
          ) : (
            <>
              {filteredResults.map((flight, i) => {
                if (!flight.segments?.length) return null;
                const segment = flight.segments[0];
                const lastSeg = flight.segments[flight.segments.length - 1];
                return (
                  <div key={i} className="flight-result-card">
                    <div className="flight-result-top">
                      <div>
                        <div className="flight-carrier">{flight.owner_name}</div>
                        <div className="flight-route">
                          {segment.origin} → {lastSeg.destination}
                          {segment.flight_number && (
                            <span style={{ marginLeft: 8, color: "var(--subtext)", fontWeight: 500 }}>
                              · {segment.marketing_carrier} {segment.flight_number}
                            </span>
                          )}
                          {flight.segments.length > 1 && (
                            <span className="flight-stops">
                              {" "}· {flight.segments.length - 1} stop{flight.segments.length > 2 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="flight-times">
                          {formatDateTime(segment.departing_at)} → {formatDateTime(lastSeg.arriving_at)}
                        </div>
                      </div>
                      <div className="flight-result-right">
                        <div className="flight-price">{flight.total_currency} {flight.total_amount}</div>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 13, padding: "7px 14px" }}
                          onClick={() => handleAddFlight(flight, segment)}
                        >
                          Add to Trip
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <p style={{ color: "var(--subtext)", fontSize: 13, textAlign: "center" }}>
                  {hiddenCount} flight{hiddenCount > 1 ? "s" : ""} outside your window hidden.{" "}
                  <button style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", padding: 0, fontSize: 13 }} onClick={() => setWindow(null)}>
                    Show all
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {showWindowPicker && (
        <ArrivalWindowPicker
          defaultDate={date || undefined}
          existingWindow={window_}
          onConfirm={(w) => setWindow(w)}
          onClose={() => setShowWindowPicker(false)}
        />
      )}
    </div>
  );
}
