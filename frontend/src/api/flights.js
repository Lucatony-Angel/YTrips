import api from "../api";

export async function searchFlights(data) {
  const res = await api.post("/api/flights/search", data);
  return res.data;
}

export async function addFlight(data) {
  const res = await api.post("/api/flights/add", data);
  return res.data;
}
