import { useEffect, useState } from "react";
import { getTrips } from "../api/trips";

export default function TripDashboard({ refreshTrigger }) {
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    async function fetchTrips() {
      const data = await getTrips();
      setTrips(data);
    }
    fetchTrips();
  }, [refreshTrigger]);

  return (
    <div>
        <h2>My Trips</h2>

        {trips.map((trip) => (
        <div
            key={trip.id}
            style={{
            border: "1px solid #444",
            borderRadius: "10px",
            padding: "20px",
            margin: "20px 0",
            backgroundColor: "#1e1e1e"
            }}
        >
            <h3>{trip.name}</h3>
            <p>{trip.destination_name}</p>
            <p>{trip.start_date} → {trip.end_date}</p>

            <p style={{ fontSize: "12px", color: "gray" }}>
            Arrival: {trip.arrival_window_start} → {trip.arrival_window_end}
            </p>
        </div>
        ))}
    </div>
  );
}