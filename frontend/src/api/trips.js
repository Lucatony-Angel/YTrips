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

export async function getTripItinerary(id) {
  const res = await api.get(`/api/trips/${id}/itinerary`);
  return res.data;
}

export async function createTripItineraryItem(tripId, data) {
  const res = await api.post(`/api/trips/${tripId}/itinerary`, data);
  return res.data;
}

export async function updateTripItineraryItem(tripId, itemId, data) {
  const res = await api.put(`/api/trips/${tripId}/itinerary/${itemId}`, data);
  return res.data;
}

export async function deleteTripItineraryItem(tripId, itemId) {
  const res = await api.delete(`/api/trips/${tripId}/itinerary/${itemId}`);
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

export async function deleteTrip(id) {
  const res = await api.delete(`/api/trips/${id}`);
  return res.data;
}

export async function updateTripBanner(id, data) {
  const res = await api.patch(`/api/trips/${id}/banner`, data);
  return res.data;
}
