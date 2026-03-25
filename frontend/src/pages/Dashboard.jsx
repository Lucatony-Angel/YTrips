import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import CreateTrip from "../components/CreateTrip";
import TripDashboard from "../components/TripDashboard";
import "../App.css";

export default function Dashboard() {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
            <h1>Welcome back, {user.display_name}!</h1>
            <p>Manage your trips and coordinate with your group.</p>
          </div>
        </div>
        <div className="dashboard-body">
          <div className="dashboard-top">
            <h2>Your Trips</h2>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Trip
            </button>
          </div>
          <TripDashboard
            refreshTrigger={refresh}
            onNewTrip={() => setShowCreate(true)}
          />
        </div>
      </div>

      {showCreate && (
        <CreateTrip
          onTripCreated={() => setRefresh((r) => r + 1)}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
