// Landing page after Google OAuth. The backend redirects here with a JWT in
// the query string. We store it, fetch the user profile, and then send new
// users to onboarding and returning users straight to the dashboard.
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const isNew = searchParams.get("is_new") === "true";
    localStorage.setItem("token", token);

    api
      .get("/api/auth/me")
      .then((res) => {
        setUser(res.data);
        navigate(isNew ? "/onboarding" : "/", { replace: true });
      })
      .catch(() => {
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
      });
  }, [searchParams, navigate, setUser]);

  return <p>Signing you in...</p>;
}
