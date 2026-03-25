const BASE_URL = "http://127.0.0.1:8000";

export async function createTrip(data) {
  const res = await fetch(`${BASE_URL}/trips/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  return res.json();
}

export async function getTrips() {
  const res = await fetch(`${BASE_URL}/trips/my-trips`);
  return res.json();
}