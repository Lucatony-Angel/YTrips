import api from "../api";

export async function suggestAirports(query, limit = 10) {
  if (!query || !query.trim()) return [];
  const res = await api.get("/api/airports/suggest", {
    params: { q: query.trim(), limit },
  });
  return res.data;
}
