export async function searchFlights(data) {
  const res = await fetch("http://127.0.0.1:8000/api/flights/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function addFlight(data) {
  const res = await fetch("http://127.0.0.1:8000/api/flights/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return res.json();
}