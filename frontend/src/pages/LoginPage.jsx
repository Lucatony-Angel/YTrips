import { API_BASE_URL } from "../api";
import Navbar from "../components/Navbar";
import "../App.css";

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  return (
    <div className="page">
      <Navbar />

      {/* Landing page Hero */}
      <div className="landing-hero">
        <div className="landing-hero-text">
          <h1>
            Coordinate Group Travel,{" "}
            <span>Effortlessly</span>
          </h1>
          <p>
            Find flights within coordinated arrival windows, build shared
            itineraries, and keep your whole group on the same page — all in one
            place.
          </p>
          <button className="btn btn-primary btn-lg" onClick={handleLogin}>
            Get Started Free
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="landing-features-bg">
        <div className="landing-features">
          <h2>Everything You Need for Group Travel</h2>
          <p>From flights to itineraries, YTrips handles the coordination.</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"></div>
              <h3>Coordinated Flights</h3>
              <p>Find flights from different cities that arrive within your group's agreed time window.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"></div>
              <h3>Arrival Window Voting</h3>
              <p>Democratically choose arrival times that work for everyone in your group.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"></div>
              <h3>Shared Itinerary</h3>
              <p>Build day-by-day plans with real place data, reviews, and photos.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"></div>
              <h3>Even Cost Splits</h3>
              <p>Track and split all trip expenses evenly across your entire group.</p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="landing-how">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Create a Trip</h3>
            <p>Set your destination, dates, and invite up to 7 friends with a simple join code.</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Vote &amp; Book Flights</h3>
            <p>Agree on an arrival window, then each person finds their perfect flight.</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Plan Together</h3>
            <p>Collaboratively build your itinerary and track costs as you go.</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="landing-cta">
        <h2>Ready to Plan Your Next Adventure?</h2>
        <p>Join travelers coordinating their group trips with YTrips.</p>
        <button className="btn btn-white btn-lg" onClick={handleLogin}>
          Sign in with Google
        </button>
      </div>

      <footer className="landing-footer">
        © 2026 YTrips. Making group travel simple.
      </footer>
    </div>
  );
}
