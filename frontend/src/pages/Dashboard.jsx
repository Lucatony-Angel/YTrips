import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard">
      <h1>Welcome, {user.display_name}!</h1>
      <p>{user.email}</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
