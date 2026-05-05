// API calls for flight search and saving. assignFlightsBulk is the one used
// by the group search flow to save one flight per member in a single request.
import api from "../api";

export async function searchFlights(data) {
  const res = await api.post("/api/flights/search", data);
  return res.data;
}

export async function addFlight(data) {
  const res = await api.post("/api/flights/add", data);
  return res.data;
}

export async function addFlightToAll(data) {
  const res = await api.post("/api/flights/add-to-all", data);
  return res.data;
}

export async function assignFlightsBulk(data) {
  const res = await api.post("/api/flights/assign-bulk", data);
  return res.data;
}
