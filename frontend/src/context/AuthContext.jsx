// Holds auth state for the whole app. On mount, we check localStorage for
// a saved token and verify it with the backend — if it checks out, the user
// is already logged in. Logout clears the token and hard-navigates to /login
// so nothing stale sticks around.
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/api/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}