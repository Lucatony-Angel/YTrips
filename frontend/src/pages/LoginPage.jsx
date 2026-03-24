import { API_BASE_URL } from "../api";

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  return (
    <div className="login-page">
      <h1>YTrips</h1>
      <p>Plan trips together with friends.</p>
      <button className="google-btn" onClick={handleLogin}>
        Sign in with Google
      </button>
    </div>
  );
}
