import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import Navbar from "../components/Navbar";
import "../App.css";

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [homeAirport, setHomeAirport] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!homeAirport.trim()) {
      setError("Please enter your home airport code.");
      return;
    }

    try {
      const res = await api.put("/api/auth/me/home-airport", {
        home_airport: homeAirport.trim(),
      });
      setUser(res.data);
      navigate("/", { replace: true });
    } catch {
      setError("Failed to save. Please try again.");
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="onboarding-page">
        <div className="onboarding-card">
          <h1>Welcome to YTrips!</h1>
          <p>
            Hi {user?.display_name}! Set your home airport so we can find
            flights for you.
          </p>
          <form className="onboarding-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="home-airport">Home Airport (IATA code)</label>
              <input
                id="home-airport"
                type="text"
                placeholder="e.g. JFK, LAX, ORD"
                maxLength={4}
                value={homeAirport}
                onChange={(e) => setHomeAirport(e.target.value.toUpperCase())}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "12px" }}>
              Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
