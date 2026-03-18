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