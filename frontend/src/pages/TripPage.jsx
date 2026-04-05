import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createTripItineraryItem,
  deleteTripFlight,
  deleteTripItineraryItem,
  getTrip,
  getTripFlights,
  getTripItinerary,
  getTripMembers,
  updateTripItineraryItem,
} from "../api/trips";
import Navbar from "../components/Navbar";
import FlightSearch from "../components/FlightSearch";
import "../App.css";

const emptyItineraryForm = {
  title: "",
  description: "",
  scheduled_at: "",
  location: "",
  category: "",
};

function getErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallbackMessage;
}

function toDateTimeLocalValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function getTripDateTimeBoundary(date, isEndOfDay = false) {
  if (!date) return undefined;
  return `${date}T${isEndOfDay ? "23:59" : "00:00"}`;
}

function isScheduledWithinTripDates(scheduledAt, trip) {
  if (!scheduledAt || !trip?.start_date || !trip?.end_date) return true;
  const scheduledDate = scheduledAt.slice(0, 10);
  return scheduledDate >= trip.start_date && scheduledDate <= trip.end_date;
}

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [flights, setFlights] = useState([]);
  const [members, setMembers] = useState([]);
  const [itineraryItems, setItineraryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [itineraryForm, setItineraryForm] = useState(emptyItineraryForm);
  const [editingItineraryId, setEditingItineraryId] = useState(null);
  const [itinerarySubmitting, setItinerarySubmitting] = useState(false);
  const [itineraryError, setItineraryError] = useState("");
  const [itinerarySuccess, setItinerarySuccess] = useState("");

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError("");

    Promise.all([getTrip(id), getTripFlights(id), getTripMembers(id), getTripItinerary(id)])
      .then(([tripData, flightData, memberData, itineraryData]) => {
        if (!isActive) return;
        setTrip(tripData);
        setFlights(flightData);
        setMembers(memberData);
        setItineraryItems(itineraryData);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(getErrorMessage(err, "Trip not found."));
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  const refreshFlights = async () => {
    try {
      const data = await getTripFlights(id);
      setFlights(data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to refresh flights."));
    }
  };

  const refreshItinerary = async () => {
    const data = await getTripItinerary(id);
    setItineraryItems(data);
  };

  const resetItineraryForm = () => {
    setEditingItineraryId(null);
    setItineraryForm(emptyItineraryForm);
  };

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

  const flightByUser = {};
  for (const flight of flights) {
    if (!flightByUser[flight.user_id]) flightByUser[flight.user_id] = [];
    flightByUser[flight.user_id].push(flight);
  }

  const memberNameById = Object.fromEntries(
    members.map((member) => [member.user_id, member.user_id === user?.id ? "You" : member.display_name])
  );

  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === user?.id) return -1;
    if (b.user_id === user?.id) return 1;
    return 0;
  });

  const handleDeleteFlight = async (flightId) => {
    try {
      await deleteTripFlight(id, flightId);
      await refreshFlights();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete flight."));
    }
  };

  const handleItineraryFieldChange = (event) => {
    const { name, value } = event.target;
    setItineraryForm((current) => ({ ...current, [name]: value }));
  };

  const handleEditItineraryItem = (item) => {
    setEditingItineraryId(item.id);
    setItineraryForm({
      title: item.title,
      description: item.description,
      scheduled_at: toDateTimeLocalValue(item.scheduled_at),
      location: item.location,
      category: item.category,
    });
    setItineraryError("");
    setItinerarySuccess("");
  };

  const handleSubmitItinerary = async (event) => {
    event.preventDefault();
    setItineraryError("");
    setItinerarySuccess("");

    const payload = {
      title: itineraryForm.title.trim(),
      description: itineraryForm.description.trim(),
      scheduled_at: itineraryForm.scheduled_at,
      location: itineraryForm.location.trim(),
      category: itineraryForm.category.trim(),
    };

    if (!isScheduledWithinTripDates(payload.scheduled_at, trip)) {
      setItineraryError("Date & time must fall within the trip dates.");
      return;
    }

    setItinerarySubmitting(true);

    try {
      if (editingItineraryId) {
        await updateTripItineraryItem(id, editingItineraryId, payload);
        setItinerarySuccess("Itinerary item updated.");
      } else {
        await createTripItineraryItem(id, payload);
        setItinerarySuccess("Itinerary item added.");
      }

      await refreshItinerary();
      resetItineraryForm();
    } catch (err) {
      setItineraryError(
        getErrorMessage(
          err,
          editingItineraryId
            ? "Unable to update itinerary item."
            : "Unable to add itinerary item."
        )
      );
    } finally {
      setItinerarySubmitting(false);
    }
  };

  const handleDeleteItineraryItem = async (itemId) => {
    if (!window.confirm("Delete this itinerary item?")) return;

    setItineraryError("");
    setItinerarySuccess("");

    try {
      await deleteTripItineraryItem(id, itemId);
      await refreshItinerary();
      if (editingItineraryId === itemId) resetItineraryForm();
      setItinerarySuccess("Itinerary item removed.");
    } catch (err) {
      setItineraryError(getErrorMessage(err, "Unable to remove itinerary item."));
    }
  };

  const FlightCard = ({ flight, canDelete }) => (
    <div className="flight-result-card">
      <div className="flight-result-top">
        <div>
          <div className="flight-carrier">{flight.airline}</div>
          <div className="flight-route">
            {flight.departure_airport} → {flight.arrival_airport}
            <span className="flight-number-tag">· {flight.flight_number}</span>
          </div>
          <div className="flight-times">
            {formatDateTime(flight.departure_time)} → {formatDateTime(flight.arrival_time)}
          </div>
        </div>
        {canDelete && (
          <button className="btn btn-delete" onClick={() => handleDeleteFlight(flight.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="page">
      <Navbar />
      <div className="trip-detail-page">
        <div className="page-header">
          <div className="trip-detail-header-inner">
            <button className="btn btn-outline btn-back" onClick={() => navigate("/")}>
              ← Back
            </button>
            {loading ? (
              <p className="text-sub">Loading…</p>
            ) : error ? (
              <p className="error-text">{error}</p>
            ) : (
              <div className="trip-detail-title">
                <h1>{trip.name}</h1>
                <div className="trip-detail-meta">
                  <span>{trip.destination_name}</span>
                  <span>
                    {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                  </span>
                  {trip.arrival_window_start && (
                    <span>
                      Arrival window: {formatDateTime(trip.arrival_window_start)} →{" "}
                      {formatDateTime(trip.arrival_window_end)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {!loading && !error && (
          <div className="page-body">
            <div className="card">
              <h3>Invite Code</h3>
              <p className="text-sub mb-md" style={{ marginTop: 4 }}>
                Share this code with friends so they can join the trip.
              </p>
              <div className="trip-invite" style={{ maxWidth: 360 }}>
                <code>{trip.invite_code}</code>
                <button onClick={() => navigator.clipboard.writeText(trip.invite_code)}>Copy</button>
              </div>
            </div>

            <div className="card">
              <div className="itinerary-header">
                <div>
                  <h3>Itinerary</h3>
                  <p className="text-sub mt-sm">
                    Add, edit, and remove shared plans for this trip.
                  </p>
                </div>
                <span className="trip-badge">{itineraryItems.length} items</span>
              </div>

              <form className="itinerary-form" onSubmit={handleSubmitItinerary}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="itinerary-title">Title</label>
                    <input
                      id="itinerary-title"
                      name="title"
                      value={itineraryForm.title}
                      onChange={handleItineraryFieldChange}
                      placeholder="Sunset dinner"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="itinerary-category">Category</label>
                    <input
                      id="itinerary-category"
                      name="category"
                      value={itineraryForm.category}
                      onChange={handleItineraryFieldChange}
                      placeholder="Food, activity, transit..."
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="itinerary-datetime">Date &amp; Time</label>
                    <input
                      id="itinerary-datetime"
                      type="datetime-local"
                      name="scheduled_at"
                      value={itineraryForm.scheduled_at}
                      onChange={handleItineraryFieldChange}
                      min={getTripDateTimeBoundary(trip?.start_date)}
                      max={getTripDateTimeBoundary(trip?.end_date, true)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="itinerary-location">Location</label>
                    <input
                      id="itinerary-location"
                      name="location"
                      value={itineraryForm.location}
                      onChange={handleItineraryFieldChange}
                      placeholder="123 Ocean Ave"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="itinerary-description">Description</label>
                  <textarea
                    id="itinerary-description"
                    name="description"
                    value={itineraryForm.description}
                    onChange={handleItineraryFieldChange}
                    placeholder="Add notes, meeting details, reservation info, or links."
                    rows={4}
                    required
                  />
                </div>

                <div className="itinerary-form-actions">
                  {editingItineraryId && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={resetItineraryForm}
                      disabled={itinerarySubmitting}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={itinerarySubmitting}>
                    {itinerarySubmitting
                      ? editingItineraryId
                        ? "Saving..."
                        : "Adding..."
                      : editingItineraryId
                        ? "Save Changes"
                        : "Add Item"}
                  </button>
                </div>
              </form>

              {itineraryError && <p className="error-text mb-md">{itineraryError}</p>}
              {itinerarySuccess && <p className="text-success mb-md">{itinerarySuccess}</p>}

              {itineraryItems.length > 0 ? (
                <div className="itinerary-list">
                  {itineraryItems.map((item) => (
                    <div className="itinerary-card" key={item.id}>
                      <div className="itinerary-card-top">
                        <div>
                          <div className="itinerary-card-title-row">
                            <h4>{item.title}</h4>
                            <span className="trip-badge">{item.category}</span>
                          </div>
                          <div className="itinerary-meta">
                            <span>{formatDateTime(item.scheduled_at)}</span>
                            <span>{item.location}</span>
                            <span>Added by {memberNameById[item.created_by_user_id] || "A trip member"}</span>
                          </div>
                          <p className="itinerary-description">{item.description}</p>
                        </div>
                        <div className="itinerary-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleEditItineraryItem(item)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-delete"
                            onClick={() => handleDeleteItineraryItem(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="itinerary-empty">
                  <h4>No itinerary items yet</h4>
                  <p>Start building the plan with activities, reservations, transfers, or meetups.</p>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="mb-lg">Flights</h3>
              <div className="gap-col">
                {sortedMembers.map((member) => {
                  const isMe = member.user_id === user?.id;
                  const memberFlights = flightByUser[member.user_id] || [];
                  return (
                    <div key={member.user_id}>
                      <div className="member-flight-label">
                        <span className="member-flight-name">
                          {isMe ? "My Flight" : member.display_name}
                        </span>
                        {isMe && <span className="trip-badge">You</span>}
                      </div>
                      {memberFlights.length > 0 ? (
                        <div className="flight-results mt-sm">
                          {memberFlights.map((flight) => (
                            <FlightCard key={flight.id} flight={flight} canDelete={isMe} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sub" style={{ marginTop: 6 }}>
                          No flight added yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-lg">Search &amp; Add Flights</h3>
              <FlightSearch
                tripId={parseInt(id, 10)}
                destination={trip.destination_name}
                tripStartDate={trip.start_date}
                tripEndDate={trip.end_date}
                tripArrivalWindow={
                  trip.arrival_window_start
                    ? {
                        arrival_window_start: trip.arrival_window_start,
                        arrival_window_end: trip.arrival_window_end,
                      }
                    : null
                }
                onFlightAdded={refreshFlights}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
