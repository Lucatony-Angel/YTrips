import { useState } from "react";
import { searchFlights, addFlight, addFlightToAll } from "../api/flights";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = (tripId, userId) => `flight-search-${tripId}-${userId}`;

export default function FlightSearch({ tripId, destination, tripStartDate, tripEndDate, onFlightAdded, myFlights = [] }) {
  const { user } = useAuth();
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY(tripId, user?.id))) || {}; } catch { return {}; } })();

  const [origin, setOrigin] = useState(saved.origin || "");
  const [dest, setDest] = useState(saved.dest || destination || "");
  const [date, setDate] = useState(saved.date || "");
  const [directOnly, setDirectOnly] = useState(saved.directOnly ?? false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 10;

  const persist = (field, value) => {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY(tripId, user?.id))) || {};
      localStorage.setItem(STORAGE_KEY(tripId, user?.id), JSON.stringify({ ...current, [field]: value }));
    } catch {}
  };

  const handleSearch = async () => {
    if (!origin || !dest || !date) {
      setError("Please fill in origin, destination, and date.");
      return;
    }
    const iataRegex = /^[A-Z]{3,4}$/;
    if (!iataRegex.test(origin)) {
      setError("Origin must be a 3-4 letter airport code (e.g. JFK).");
      return;
    }
    if (!iataRegex.test(dest)) {
      setError("Destination must be a 3-4 letter airport code (e.g. LAX).");
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
    setPage(0);
    setLoading(true);
    try {
      const data = await searchFlights({ origin, destination: dest, departure_date: date });
      setResults(Array.isArray(data) ? data : []);
      if (!data?.length) setError("No flights found for that route and date.");
    } catch (err) {
      const data = err?.response?.data;
      const errors = data?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        setError(errors.map((e) => e.message.replace(/^Value error,\s*/i, "")).join(" "));
      } else if (typeof data?.detail === "string" && data.detail !== "Validation error") {
        setError(data.detail);
      } else {
        setError("Flight search failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatFlightCode = (seg) =>
    seg ? `${seg.marketing_carrier_iata_code || ""}${seg.flight_number || ""}`.trim() : "";

  const existingFlightNums = new Set(myFlights.map((f) => f.flight_number));

  const buildFlightPayload = (flight, segment) => ({
    trip_id: tripId,
    airline: flight.owner_name,
    flight_number: formatFlightCode(segment) || segment.flight_number,
    departure_airport: segment.origin,
    arrival_airport: segment.destination,
    departure_time: segment.departing_at,
    arrival_time: segment.arriving_at,
  });

  const handleAddFlight = async (flight, segment) => {
    try {
      await addFlight(buildFlightPayload(flight, segment));
      if (onFlightAdded) onFlightAdded();
    } catch {
      setError("Failed to add flight.");
    }
  };

  const handleAddFlightToAll = async (flight, segment) => {
    try {
      await addFlightToAll(buildFlightPayload(flight, segment));
      if (onFlightAdded) onFlightAdded();
    } catch {
      setError("Failed to add flight for everyone.");
    }
  };

  const formatDateTime = (dt) =>
    dt ? new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const filteredResults = directOnly
    ? results.filter((f) => (f.segments?.length ?? 0) === 1)
    : results;
  const hiddenCount = results.length - filteredResults.length;
  const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE);
  const pageResults = filteredResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flight-search">
      <div className="flight-search-form">
        <div className="form-group">
          <label>From (IATA)</label>
          <input
            placeholder="e.g. LAX JFK etc"
            value={origin}
            onChange={(e) => { setOrigin(e.target.value.toUpperCase()); persist("origin", e.target.value.toUpperCase()); }}
            maxLength={4}
          />
        </div>
        <div className="form-group">
          <label>To (IATA)</label>
          <input
            placeholder="e.g. ORD"
            value={dest}
            onChange={(e) => { setDest(e.target.value.toUpperCase()); persist("dest", e.target.value.toUpperCase()); }}
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
            onChange={(e) => { setDate(e.target.value); persist("date", e.target.value); }}
          />
        </div>
        <button className="btn btn-primary flight-search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? "Searching…" : "Search Flights"}
        </button>
      </div>

      <div className="flight-window-row">
        <label className="pill-toggle">
          <input
            type="checkbox"
            checked={directOnly}
            onChange={(e) => { setDirectOnly(e.target.checked); persist("directOnly", e.target.checked); setPage(0); }}
          />
          <span className="pill-track"><span className="pill-thumb" /></span>
          <span className="pill-label">Direct flights only</span>
        </label>
      </div>

      {error && <p className="error-text mt-md">{error}</p>}

      {results.length > 0 && filteredResults.length === 0 && (
        <p className="text-sub mt-md">
          No direct flights in these results.{" "}
          <button className="btn-link" onClick={() => { setDirectOnly(false); persist("directOnly", false); setPage(0); }}>
            Show all {results.length} flights
          </button>
        </p>
      )}

      {filteredResults.length > 0 && (
        <div className="flight-results">
          {pageResults.map((flight, i) => {
            if (!flight.segments?.length) return null;
            const segment = flight.segments[0];
            const lastSeg = flight.segments[flight.segments.length - 1];
            return (
              <div key={i} className="flight-result-card">
                <div className="flight-result-top">
                  <div>
                    <div className="flight-carrier">
                      {flight.owner_name}
                      {flight.segments.some((s) => s.flight_number) && (
                        <span className="flight-number-tag">
                          {" · "}
                          {flight.segments
                            .map((s) => formatFlightCode(s))
                            .filter(Boolean)
                            .join(" → ")}
                        </span>
                      )}
                    </div>
                    <div className="flight-route">
                      {segment.origin} → {lastSeg.destination}
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
                    {(() => {
                      const composed = formatFlightCode(segment) || segment.flight_number;
                      const isAdded = existingFlightNums.has(composed);
                      return (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button
                            className={`btn btn-sm ${isAdded ? "btn-added" : "btn-primary"}`}
                            onClick={() => !isAdded && handleAddFlight(flight, segment)}
                            disabled={isAdded}
                          >
                            {isAdded ? "✓ Added" : "Add to Trip"}
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleAddFlightToAll(flight, segment)}
                            title="Assign this flight to every trip member"
                          >
                            Add to all
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: "var(--subtext)" }}>
                Page {page + 1} of {totalPages} &nbsp;·&nbsp; {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}
                {directOnly && hiddenCount > 0 ? ` (${hiddenCount} with stops hidden)` : ""}
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
