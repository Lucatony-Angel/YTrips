import { useState } from "react";
import CreateTrip from "./components/CreateTrip";
import TripDashboard from "./components/TripDashboard";

function App() {
  const [refresh, setRefresh] = useState(0);

  const refreshTrips = () => {
    setRefresh((prev) => prev + 1);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>YTrips</h1>

      <CreateTrip onTripCreated={refreshTrips} />
      <TripDashboard refreshTrigger={refresh} />
    </div>
  );
}

export default App;
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import OnboardingPage from "./pages/OnboardingPage";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
