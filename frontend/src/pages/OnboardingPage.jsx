import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";

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
    <div className="onboarding-page">
      <h1>Welcome to YTrips, {user?.display_name}!</h1>
      <p>Set your home airport so we can find flights for you.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="home-airport">Home Airport (IATA code)</label>
        <input
          id="home-airport"
          type="text"
          placeholder="e.g. JFK, LAX, ORD"
          maxLength={4}
          value={homeAirport}
          onChange={(e) => setHomeAirport(e.target.value.toUpperCase())}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Continue</button>
      </form>
    </div>
  );
}
