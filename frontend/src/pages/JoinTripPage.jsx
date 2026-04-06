import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { joinTrip, getTrips } from "../api/trips";
import Navbar from "../components/Navbar";
import "../App.css";

export default function JoinTripPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter an invite code.");
      return;
    }

    setLoading(true);
    try {
      await joinTrip(trimmed);
      const trips = await getTrips();
      const joined = trips.find((t) => t.invite_code === trimmed);
      navigate(joined ? `/trips/${joined.id}` : "/", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === "Already a member") {
        setError("You're already a member of this trip.");
      } else if (detail === "Invalid invite code") {
        setError("That invite code doesn't exist. Double-check and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="centered-page">
        <div className="onboarding-card">
          <h1>Join a Trip</h1>
          <p>Enter the invite code shared by your group to join their trip.</p>
          <form className="onboarding-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="invite-code">Invite Code</label>
              <input
                id="invite-code"
                type="text"
                placeholder="e.g. 3f2a1b4c-..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px" }}
              disabled={loading}
            >
              {loading ? "Joining…" : "Join Trip"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: "100%", padding: "12px" }}
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
