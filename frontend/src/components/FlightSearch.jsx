import { useState } from "react";
import { searchFlights, addFlight } from "../api/flights";

export default function FlightSearch({ tripId }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    try {
      setLoading(true);

      const data = await searchFlights({
        origin,
        destination,
        departure_date: date,
      });

      console.log("FLIGHT RESPONSE:", data);

      if (Array.isArray(data)) {
        setResults(data);
      } else {
        console.error("API returned error:", data);
        setResults([]);
      }

    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFlight = async (flight) => {
    try {
      await addFlight({
        trip_id: tripId,
        airline: flight.airline,
        flight_number: flight.flight_number,
        departure_airport: flight.departure_airport,
        arrival_airport: flight.arrival_airport,
        departure_time: flight.departure_time,
        arrival_time: flight.arrival_time,
      });

      alert("Flight added!");
    } catch (err) {
      console.error("Failed to add flight:", err);
    }
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Search Flights ✈️</h2>

      <input
        placeholder="Origin (e.g. LAX)"
        onChange={(e) => setOrigin(e.target.value)}
      />
      <input
        placeholder="Destination (e.g. SFO)"
        onChange={(e) => setDestination(e.target.value)}
      />
      <input
        type="date"
        onChange={(e) => setDate(e.target.value)}
      />

      <button onClick={handleSearch} style={{ marginLeft: "10px" }}>
        Search
      </button>

      {loading && <p>Searching flights...</p>}

      {/* ✅ SAFE RENDERING */}
      {Array.isArray(results) && results.map((flight, i) => {
        if (!flight.segments || flight.segments.length === 0) return null;

        const segment = flight.segments[0];

        return (
          <div key={i} style={{ border: "1px solid gray", margin: "10px", padding: "10px" }}>
            <p><strong>{flight.owner_name}</strong></p>
            <p>{segment.origin} → {segment.destination}</p>
            <p>{segment.departing_at} → {segment.arriving_at}</p>

            <button
              onClick={() =>
                handleAddFlight({
                  airline: flight.owner_name,
                  flight_number: segment.flight_number,
                  departure_airport: segment.origin,
                  arrival_airport: segment.destination,
                  departure_time: segment.departing_at,
                  arrival_time: segment.arriving_at,
                })
              }
            >
              Add to Trip
            </button>
          </div>
        );
      })}
    </div>
  );
}