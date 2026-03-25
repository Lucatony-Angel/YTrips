import api from "../api";

export async function createTrip(data) {
  const res = await api.post("/api/trips/", data);
  return res.data;
}

export async function getTrips() {
  const res = await api.get("/api/trips/my-trips");
  return res.data;
}

export async function getTrip(id) {
  const res = await api.get(`/api/trips/${id}`);
  return res.data;
}

export async function getTripMembers(id) {
  const res = await api.get(`/api/trips/${id}/members`);
  return res.data;
}

export async function getTripFlights(id) {
  const res = await api.get(`/api/trips/${id}/flights`);
  return res.data;
}

export async function deleteTripFlight(tripId, flightId) {
  const res = await api.delete(`/api/trips/${tripId}/flights/${flightId}`);
  return res.data;
}

export async function joinTrip(inviteCode) {
  const res = await api.post(`/api/trips/join/${inviteCode}`);
  return res.data;
}
