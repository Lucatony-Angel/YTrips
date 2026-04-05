import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import TripDashboard from "../components/TripDashboard";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
            <h1>Hey, {user.display_name} 👋</h1>
            <p>Ready to plan your next adventure?</p>
          </div>
        </div>
        <div className="dashboard-body">
          <div className="dashboard-top">
            <div>
              <h2>Your Trips</h2>
              <p className="text-sub" style={{ marginTop: 4 }}>Manage and coordinate all your adventures</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate("/trips/new")}>
              + New Trip
            </button>
          </div>
          <TripDashboard onNewTrip={() => navigate("/trips/new")} />
        </div>
      </div>
    </div>
  );
}
