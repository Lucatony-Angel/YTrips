import { API_BASE_URL } from "../api";
import "../App.css";

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  return (
    <div className="landing-page">
      {/* Fixed nav */}
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
          </svg>
          YTrips
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleLogin}>Sign in</button>
      </nav>

      {/* Dark hero */}
      <div className="landing-dark">
        <section className="landing-hero-new">
          <div className="landing-hero-eyebrow">Group travel, simplified</div>
          <h1 className="landing-hero-h1">
            Coordinate flights.<br />
            <span>Plan together.</span>
          </h1>
          <p className="landing-hero-sub">
            Find flights within coordinated arrival windows, build shared itineraries,
            and keep your whole group on the same page — all in one place.
          </p>
          <div className="landing-hero-actions">
            <button className="btn btn-primary btn-lg" onClick={handleLogin}>
              Get Started Free
            </button>
          </div>

          <div className="landing-proof">
            <div className="landing-proof-item">
              <strong>1 code</strong>
              <span>to invite everyone</span>
            </div>
            <div className="landing-proof-divider" />
            <div className="landing-proof-item">
              <strong>Real-time</strong>
              <span>flight data</span>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <section className="landing-features-new">
        <div className="landing-section-header">
          <h2>Everything your group needs</h2>
          <p>From flights to itineraries, YTrips handles the coordination.</p>
        </div>
        <div className="features-grid-new">
          <div className="feature-card-new">
            <div className="feature-icon-new">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
            </div>
            <h3>Coordinated Flights</h3>
            <p>Find flights from different cities that arrive within your group's agreed time window.</p>
          </div>
          <div className="feature-card-new">
            <div className="feature-icon-new">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h3>Arrival Window Voting</h3>
            <p>Democratically choose arrival times that work for everyone in your group.</p>
          </div>
          <div className="feature-card-new">
            <div className="feature-icon-new">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h3>Shared Itinerary</h3>
            <p>Build day-by-day plans with real place data, reviews, and photos.</p>
          </div>
          <div className="feature-card-new">
            <div className="feature-icon-new">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3>Even Cost Splits</h3>
            <p>Track and split all trip expenses evenly across your entire group.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-how-new">
        <div className="landing-section-header">
          <h2>How it works</h2>
        </div>
        <div className="how-steps">
          <div className="how-step">
            <div className="how-step-num">1</div>
            <div className="how-step-content">
              <h3>Create a trip</h3>
              <p>Set your destination, dates, and invite your friends with a simple join code.</p>
            </div>
          </div>
          <div className="how-step-arrow">→</div>
          <div className="how-step">
            <div className="how-step-num">2</div>
            <div className="how-step-content">
              <h3>Vote &amp; book flights</h3>
              <p>Agree on an arrival window, then each person finds their perfect flight.</p>
            </div>
          </div>
          <div className="how-step-arrow">→</div>
          <div className="how-step">
            <div className="how-step-num">3</div>
            <div className="how-step-content">
              <h3>Plan together</h3>
              <p>Collaboratively build your itinerary and track costs as you go.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-new">
        <h2>Ready for your next adventure?</h2>
        <p>Join travelers coordinating their group trips with YTrips.</p>
        <button className="btn btn-white btn-lg" onClick={handleLogin}>
          Sign in with Google
        </button>
      </section>

      <footer className="landing-footer">
        © 2026 YTrips. Making group travel simple.
      </footer>
    </div>
  );
}
