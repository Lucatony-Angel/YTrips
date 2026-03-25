import { useState } from "react";
import { createTrip } from "../api/trips";

export default function CreateTrip({ onTripCreated }) {
  const [form, setForm] = useState({
    name: "",
    destination_name: "",
    start_date: "",
    end_date: "",
    arrival_window_start: "",
    arrival_window_end: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    await createTrip(form);
    alert("Trip created!");
    onTripCreated();
  };
  
  return (
    <div style={{ marginBottom: "40px" }}>
        <h2>Create Trip</h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input name="name" placeholder="Trip Name" onChange={handleChange} />
        <input name="destination_name" placeholder="Destination" onChange={handleChange} />
        <input type="date" name="start_date" onChange={handleChange} />
        <input type="date" name="end_date" onChange={handleChange} />
        <input type="datetime-local" name="arrival_window_start" onChange={handleChange} />
        <input type="datetime-local" name="arrival_window_end" onChange={handleChange} />

        <button onClick={handleSubmit}>Create</button>
        </div>
    </div>
);
}