import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { jsPDF } from "jspdf";
import {
  createTripItineraryItem,
  deleteTripFlight,
  deleteTripItineraryItem,
  getTrip,
  getTripFlights,
  getTripItinerary,
  getTripMembers, 
  updateTripBanner,
  updateTripItineraryItem,
  voteOnItineraryItem,
  finalizeTrip,
  unfinalizeTrip,
  removeItineraryVote,
  groupArrivalsSearch,
  setMyHomeAirport,
} from "../api/trips";
import { assignFlightsBulk } from "../api/flights";
import Navbar from "../components/Navbar";
import FlightSearch from "../components/FlightSearch";
import AirportInput from "../components/AirportInput";
import "../App.css";

const ITINERARY_CATEGORIES = [
  "Food & Dining",
  "Activity",
  "Transit",
  "Accommodation",
  "Sightseeing",
  "Shopping",
  "Entertainment",
  "Other",
];

const PRESET_COLORS = [
  "#1e3a8a", "#7C3AED", "#DB2777", "#DC2626",
  "#D97706", "#16A34A", "#0891B2", "#374151",
];

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

function formatHm(iso) {
  if (!iso || typeof iso !== "string" || iso.length < 16) return iso || "";
  return iso.slice(11, 16);
}

function getDateKey(value) {
  if (!value) return "unscheduled";
  const key = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "unscheduled";
}

function formatDateKey(dateKey) {
  if (dateKey === "unscheduled") return "Unscheduled";
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDayOffset(startDateKey, dateKey) {
  if (!startDateKey || dateKey === "unscheduled") return null;
  const startParts = startDateKey.split("-").map(Number);
  const dateParts = dateKey.split("-").map(Number);
  if (startParts.length !== 3 || dateParts.length !== 3) return null;
  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const dateUtc = Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const diff = Math.round((dateUtc - startUtc) / 86_400_000);
  return diff >= 0 ? diff : null;
}

function getItineraryDayGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const dateKey = getDateKey(item.scheduled_at);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey).push(item);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === "unscheduled") return 1;
      if (b === "unscheduled") return -1;
      return a.localeCompare(b);
    })
    .map(([dateKey, dayItems]) => ({ dateKey, items: dayItems }));
}

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [trip, setTrip] = useState(null);
  const [flights, setFlights] = useState([]);
  const [members, setMembers] = useState([]);
  const [itineraryItems, setItineraryItems] = useState([]);
  const [activeTab, setActiveTab] = useState("my");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBannerEdit, setShowBannerEdit] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [confirmDeleteFlight, setConfirmDeleteFlight] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [itineraryForm, setItineraryForm] = useState(emptyItineraryForm);
  const [itinerarySubmitting, setItinerarySubmitting] = useState(false);
  const [itineraryError, setItineraryError] = useState("");
  const [itinerarySuccess, setItinerarySuccess] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState(null);
  const [editModalForm, setEditModalForm] = useState(emptyItineraryForm);
  const [editModalSubmitting, setEditModalSubmitting] = useState(false);
  const [editModalError, setEditModalError] = useState("");

  const [confirmDeleteItinerary, setConfirmDeleteItinerary] = useState(null);

  const [confirmSoloNoVote, setConfirmSoloNoVote] = useState(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizedModal, setShowFinalizedModal] = useState(false);
  const [showTripPreview, setShowTripPreview] = useState(false);

  const [editingHomeAirportUserId, setEditingHomeAirportUserId] = useState(null);
  const [homeAirportDraft, setHomeAirportDraft] = useState("");
  const [homeAirportError, setHomeAirportError] = useState("");
  const [homeAirportOverrides, setHomeAirportOverrides] = useState({});
  const [editingMyHome, setEditingMyHome] = useState(false);
  const [myHomeDraft, setMyHomeDraft] = useState("");
  const [myHomeSaving, setMyHomeSaving] = useState(false);
  const [myHomeError, setMyHomeError] = useState("");
  const [groupSearchDate, setGroupSearchDate] = useState("");
  const [groupSearchDest, setGroupSearchDest] = useState("");
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupSearchError, setGroupSearchError] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState(null);
  const [groupSearchSummary, setGroupSearchSummary] = useState(null);
  const [assigningWindowIdx, setAssigningWindowIdx] = useState(null);
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");
  const [excludedMemberIds, setExcludedMemberIds] = useState(() => new Set());

  const isMemberIncluded = (userId) => !excludedMemberIds.has(userId);
  const toggleMemberIncluded = (userId) => {
    setExcludedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError("");

    Promise.allSettled([getTrip(id), getTripFlights(id), getTripMembers(id), getTripItinerary(id)])
      .then(([tripResult, flightResult, memberResult, itineraryResult]) => {
        if (!isActive) return;
        if (tripResult.status === "rejected") {
          setError(getErrorMessage(tripResult.reason, "Trip not found."));
          return;
        }
        setTrip(tripResult.value);
        if (flightResult.status === "fulfilled") setFlights(flightResult.value);
        if (memberResult.status === "fulfilled") setMembers(memberResult.value);
        if (itineraryResult.status === "fulfilled") setItineraryItems(itineraryResult.value);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => { isActive = false; };
  }, [id]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [itineraryData, memberData] = await Promise.all([
          getTripItinerary(id),
          getTripMembers(id),
        ]);
        setItineraryItems(itineraryData);
        setMembers(memberData);
      } catch {
        // Polling should not surface transient refresh failures.
      }
    }, 4000);
    return () => clearInterval(interval);
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
    try {
      const data = await getTripItinerary(id);
      setItineraryItems(data);
    } catch {
      //silent - polling recovers recovery
    }
  };

  const resetItineraryForm = () => {
    setItineraryForm(emptyItineraryForm);
    setItineraryError("");
    setItinerarySuccess("");
  };

  const openEditModal = (item) => {
    setEditModalItem(item);
    setEditModalForm({
      title: item.title,
      description: item.description || "",
      scheduled_at: toDateTimeLocalValue(item.scheduled_at),
      location: item.location,
      category: item.category,
    });
    setEditModalError("");
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditModalItem(null);
    setEditModalForm(emptyItineraryForm);
    setEditModalError("");
  };

  const handleEditModalFieldChange = (e) => {
    const { name, value } = e.target;
    setEditModalForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitEditModal = async (e) => {
    e.preventDefault();
    setEditModalError("");
    const rawAt = editModalForm.scheduled_at;
    const scheduled_at = rawAt.length === 16 ? rawAt + ":00" : rawAt;
    const payload = {
      title: editModalForm.title.trim(),
      description: editModalForm.description.trim(),
      scheduled_at,
      location: editModalForm.location.trim(),
      category: editModalForm.category.trim(),
    };
    if (!isScheduledWithinTripDates(payload.scheduled_at, trip)) {
      setEditModalError("Date & time must fall within the trip dates.");
      return;
    }
    setEditModalSubmitting(true);
    try {
      await updateTripItineraryItem(id, editModalItem.id, payload);
      await refreshItinerary();
      closeEditModal();
    } catch (err) {
      setEditModalError(getErrorMessage(err, "Unable to update itinerary item."));
    } finally {
      setEditModalSubmitting(false);
    }
  };

  const handleColorChange = async (color) => {
    setSavingBanner(true);
    try {
      const updated = await updateTripBanner(id, { banner_color: color, banner_image_url: null });
      setTrip(updated);
    } catch {
      setError("Unable to update banner.");
    } finally {
      setSavingBanner(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setSavingBanner(true);
      try {
        const updated = await updateTripBanner(id, { banner_image_url: ev.target.result });
        setTrip(updated);
      } catch {
        setError("Unable to update banner.");
      } finally {
        setSavingBanner(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async () => {
    setSavingBanner(true);
    try {
      const updated = await updateTripBanner(id, { banner_image_url: null });
      setTrip(updated);
    } catch {
      setError("Unable to update banner.");
    } finally {
      setSavingBanner(false);
    }
  };

  // Use the multi-arg Date constructor (always local time) — new Date("YYYY-MM-DD") parses as UTC and shifts the displayed date in non-UTC timezones.
  const formatDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (dt) =>
    dt ? new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const flightByUser = {};
  for (const f of flights) {
    if (!flightByUser[f.user_id]) flightByUser[f.user_id] = [];
    flightByUser[f.user_id].push(f);
  }

  const memberNameById = Object.fromEntries(
    members.map((m) => [m.user_id, m.user_id === user?.id ? "You" : m.display_name])
  );

  const conflictedItemIds = new Set();
  const byTime = {}
  for (const item of itineraryItems) {
    const key = item.scheduled_at;
    if (!byTime[key]) byTime[key] = [];
    byTime[key].push(item);
  }
  for (const group of Object.values(byTime)) {
    if (group.length < 2) continue;
    const maxVotes = Math.max(...group.map((i) => i.yes_votes));
    for (const item of group) {
      if (item.yes_votes < maxVotes) conflictedItemIds.add(item.id);
    }
  }

  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === user?.id) return -1;
    if (b.user_id === user?.id) return 1;
    return 0;
  });

  const handleDeleteFlight = async (flightId) => {
    try {
      await deleteTripFlight(id, flightId);
      setConfirmDeleteFlight(null);
      await refreshFlights();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete flight."));
    }
  };

  const handleItineraryFieldChange = (event) => {
    const { name, value } = event.target;
    setItineraryForm((current) => ({ ...current, [name]: value }));
  };

  const getEffectiveHomeAirport = (member) =>
    homeAirportOverrides[member.user_id] ?? member.home_airport ?? null;

  const startEditHomeAirport = (member) => {
    setEditingHomeAirportUserId(member.user_id);
    setHomeAirportDraft(getEffectiveHomeAirport(member) || "");
    setHomeAirportError("");
  };

  const cancelEditHomeAirport = () => {
    setEditingHomeAirportUserId(null);
    setHomeAirportDraft("");
    setHomeAirportError("");
  };

  const saveHomeAirport = (userId) => {
    const code = homeAirportDraft.trim().toUpperCase();
    if (code.length < 3 || code.length > 4) {
      setHomeAirportError("Enter a valid 3- or 4-letter IATA code.");
      return;
    }
    setHomeAirportOverrides((prev) => ({ ...prev, [userId]: code }));
    cancelEditHomeAirport();
  };

  const myMember = members.find((m) => m.user_id === user?.id);

  const startEditMyHome = () => {
    setMyHomeDraft(myMember?.home_airport || "");
    setMyHomeError("");
    setEditingMyHome(true);
  };

  const cancelEditMyHome = () => {
    setEditingMyHome(false);
    setMyHomeDraft("");
    setMyHomeError("");
  };

  const handleSaveMyHome = async () => {
    const code = myHomeDraft.trim().toUpperCase();
    if (code.length < 3 || code.length > 4) {
      setMyHomeError("Enter a valid 3- or 4-letter IATA code.");
      return;
    }
    setMyHomeSaving(true);
    setMyHomeError("");
    try {
      await setMyHomeAirport(id, code);
      const fresh = await getTripMembers(id);
      setMembers(fresh);
      cancelEditMyHome();
    } catch (err) {
      setMyHomeError(getErrorMessage(err, "Unable to save home airport."));
    } finally {
      setMyHomeSaving(false);
    }
  };

  const handleAssignWindow = async (win, idx) => {
    setAssignError("");
    setAssignSuccess("");
    const assignments = [];
    for (const member of members) {
      if (!isMemberIncluded(member.user_id)) continue;
      const origin = getEffectiveHomeAirport(member);
      if (!origin) continue;
      const offer = win.best_offer_per_origin[origin];
      if (!offer || !offer.segments?.length) continue;
      const first = offer.segments[0];
      const last = offer.segments[offer.segments.length - 1];
      const code = `${first.marketing_carrier_iata_code || ""}${first.flight_number || ""}`.trim()
        || first.flight_number
        || "UNKNOWN";
      assignments.push({
        user_id: member.user_id,
        airline: offer.owner_name || "Unknown",
        flight_number: code,
        departure_airport: first.origin,
        arrival_airport: last.destination,
        departure_time: first.departing_at,
        arrival_time: last.arriving_at,
      });
    }
    if (assignments.length === 0) {
      setAssignError("No members with resolvable origins for this window.");
      return;
    }
    setAssigningWindowIdx(idx);
    try {
      const created = await assignFlightsBulk({
        trip_id: parseInt(id, 10),
        assignments,
      });
      await refreshFlights();
      setAssignSuccess(
        created.length === 0
          ? "Everyone already had this flight."
          : `Assigned flights to ${created.length} member${created.length === 1 ? "" : "s"}.`
      );
    } catch (err) {
      setAssignError(getErrorMessage(err, "Unable to assign flights."));
    } finally {
      setAssigningWindowIdx(null);
    }
  };

  const handleRunGroupSearch = async () => {
    setGroupSearchError("");
    setGroupSearchResults(null);
    setGroupSearchSummary(null);
    const dest = groupSearchDest.trim().toUpperCase();
    if (!groupSearchDate) {
      setGroupSearchError("Pick a departure date.");
      return;
    }
    if (dest.length < 3 || dest.length > 4) {
      setGroupSearchError("Enter a valid destination IATA code.");
      return;
    }

    const perMember = members
      .filter((m) => isMemberIncluded(m.user_id))
      .map((m) => ({
        member: m,
        origin: getEffectiveHomeAirport(m),
        overridden: Boolean(homeAirportOverrides[m.user_id]),
      }));
    const resolved = perMember.filter((r) => r.origin);
    const skipped = perMember.filter((r) => !r.origin).map((r) => r.member.display_name);
    const excludedNames = members
      .filter((m) => !isMemberIncluded(m.user_id))
      .map((m) => (m.user_id === user?.id ? "You" : m.display_name));
    const origins = Array.from(new Set(resolved.map((r) => r.origin)));

    if (origins.length === 0) {
      setGroupSearchError("Select at least one member with a home airport.");
      return;
    }

    setGroupSearchLoading(true);
    try {
      const data = await groupArrivalsSearch(id, {
        arrivalDate: groupSearchDate,
        destinationIata: dest,
        origins,
      });
      setGroupSearchResults(data.windows || []);
      setGroupSearchSummary({
        destination: dest,
        date: groupSearchDate,
        origins,
        perMember: resolved,
        skipped,
        excluded: excludedNames,
        skippedMixedCurrency: data.skipped_mixed_currency_count || 0,
        infeasibleOrigins: data.infeasible_origins || [],
      });
    } catch (err) {
      setGroupSearchError(getErrorMessage(err, "Unable to run group search."));
    } finally {
      setGroupSearchLoading(false);
    }
  };

  const handleSubmitItinerary = async (event) => {
    event.preventDefault();
    setItineraryError("");
    setItinerarySuccess("");
    const rawAt = itineraryForm.scheduled_at;
    const scheduled_at = rawAt && !rawAt.includes(":") ? rawAt : rawAt.length === 16 ? rawAt + ":00" : rawAt;
    const payload = {
      title: itineraryForm.title.trim(),
      description: itineraryForm.description.trim(),
      scheduled_at,
      location: itineraryForm.location.trim(),
      category: itineraryForm.category.trim(),
    };
    if (!isScheduledWithinTripDates(payload.scheduled_at, trip)) {
      setItineraryError("Date & time must fall within the trip dates.");
      return;
    }
    setItinerarySubmitting(true);
    try {
      await createTripItineraryItem(id, payload);
      setItinerarySuccess("Itinerary item added.");
      await refreshItinerary();
      resetItineraryForm();
    } catch (err) {
      setItineraryError(getErrorMessage(err, "Unable to add itinerary item."));
    } finally {
      setItinerarySubmitting(false);
    }
  };

  const handleDeleteItineraryItem = async (itemId) => {
    try {
      await deleteTripItineraryItem(id, itemId);
      setConfirmDeleteItinerary(null);
      await refreshItinerary();
    } catch (err) {
      setItineraryError(getErrorMessage(err, "Unable to remove itinerary item."));
    }
  };

  const handleVote = async (itemId, vote) => {
    if (vote === false && members.length === 1) {
      setConfirmSoloNoVote(itemId);
      return;
    }
    try {
      const item = itineraryItems.find((i) => i.id === itemId);
      if (item?.user_vote === vote) {
        await removeItineraryVote(id, itemId);
      } else {
        await voteOnItineraryItem(id, itemId, vote);
      }
      await refreshItinerary();
    } catch {
      setItineraryError("Unable to cast vote. Please try again.");
    }
  };

  const handleConfirmSoloNoVote = async (itemId) => {
    setConfirmSoloNoVote(null);
    try {
      const item = itineraryItems.find((i) => i.id === itemId);
      if (item?.user_vote === false) {
        await removeItineraryVote(id, itemId);
      } else {
        await voteOnItineraryItem(id, itemId, false);
      }
      await refreshItinerary();
    } catch {
      setItineraryError("Unable to cast vote. Please try again.");
    }
  };


  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const updated = await finalizeTrip(id);
      setTrip(updated);
      setShowFinalizeConfirm(false);
      setShowBannerEdit(false);
      setShowFinalizedModal(true);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to finalize trip."));
    } finally {
      setFinalizing(false);
    }
  };

  const handleUnfinalize = async () => {
    try {
      const updated = await unfinalizeTrip(id);
      setTrip(updated);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to unlock trip."));
    }
  };

  // Extracts first sentence for a clean summary line
  const summarize = (text) => {
    if (!text) return "";
    const first = text.split(/[.!?]/)[0].trim();
    return first.length > 120 ? first.slice(0, 117) + "..." : first;
  };

  const buildPDFDoc = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 52;
    const contentW = pageW - margin * 2;
    let y = 0;

    // Parse trip banner color to RGB
    const hexToRgb = (hex) => {
      const h = hex.replace("#", "");
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const [hr, hg, hb] = hexToRgb(trip.banner_color || "#1e3a8a");

    const checkPage = (needed = 24) => {
      if (y + needed > pageH - 56) { doc.addPage(); y = 52; }
    };

    const sectionHeader = (title) => {
      checkPage(36);
      y += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(hr, hg, hb);
      doc.text(title.toUpperCase(), margin, y);
      y += 5;
      doc.setDrawColor(hr, hg, hb);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentW, y);
      doc.setLineWidth(0.2);
      doc.setDrawColor(229, 231, 235);
      y += 16;
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
    };

    // Header
    if (trip.banner_image_url) {
      try {
        // Draw image stretched across the header area, then darken with a semi-transparent overlay
        doc.addImage(trip.banner_image_url, 0, 0, pageW, 82);
        doc.setFillColor(0, 0, 0);
        doc.setGState(new doc.GState({ opacity: 0.45 }));
        doc.rect(0, 0, pageW, 82, "F");
        doc.setGState(new doc.GState({ opacity: 1 }));
      } catch {
        // Fallback to solid color if image fails
        doc.setFillColor(hr, hg, hb);
        doc.rect(0, 0, pageW, 82, "F");
      }
    } else {
      doc.setFillColor(hr, hg, hb);
      doc.rect(0, 0, pageW, 82, "F");
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(trip.name, margin, 38);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const meta = `${trip.destination_name}   |   ${formatDate(trip.start_date)} to ${formatDate(trip.end_date)}   |   ${members.length} member${members.length !== 1 ? "s" : ""}`;
    doc.text(meta, margin, 58);
    doc.setFontSize(9);
    doc.setTextColor(200, 210, 255);
    doc.text("Generated by YTrips", margin, 74);

    y = 106;
    doc.setTextColor(17, 24, 39);

    // Members
    sectionHeader("Members");
    members.forEach((m) => {
      checkPage(18);
      const isMe = m.user_id === user?.id;
      doc.setFont("helvetica", isMe ? "bold" : "normal");
      doc.text(`${m.display_name}${isMe ? "  (You)" : ""}`, margin + 10, y);
      y += 17;
    });
    doc.setFont("helvetica", "normal");

    // Flights
    sectionHeader("Flights");
    if (flights.length === 0) {
      doc.setTextColor(156, 163, 175);
      doc.text("No flights have been added yet.", margin + 10, y);
      doc.setTextColor(17, 24, 39);
      y += 18;
    } else {
      const fbu = {};
      for (const f of flights) { if (!fbu[f.user_id]) fbu[f.user_id] = []; fbu[f.user_id].push(f); }
      members.forEach((m) => {
        const mf = fbu[m.user_id] || [];
        const name = m.user_id === user?.id ? `${m.display_name} (You)` : m.display_name;
        checkPage(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(55, 65, 81);
        doc.text(name, margin + 10, y);
        y += 15;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 24, 39);
        if (mf.length === 0) {
          doc.setTextColor(156, 163, 175);
          doc.text("No flight added.", margin + 20, y);
          doc.setTextColor(17, 24, 39);
          y += 15;
        } else {
          mf.forEach((f) => {
            checkPage(50);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text(`Flight ${f.flight_number}  -  ${f.airline}`, margin + 20, y);
            doc.setFont("helvetica", "normal");
            y += 14;
            doc.text(`${f.departure_airport} to ${f.arrival_airport}`, margin + 20, y);
            y += 13;
            doc.setTextColor(107, 114, 128);
            doc.setFontSize(10);
            doc.text(`Departs ${formatDateTime(f.departure_time)}   Arrives ${formatDateTime(f.arrival_time)}`, margin + 20, y);
            doc.setFontSize(11);
            doc.setTextColor(17, 24, 39);
            y += 18;
          });
        }
        y += 4;
      });
    }

    // Itinerary — only items with score (yes - no) >= 0
    sectionHeader("Itinerary");
    const approvedItems = itineraryItems.filter((item) => (item.yes_votes - item.no_votes) >= 0);
    if (approvedItems.length === 0) {
      doc.setTextColor(156, 163, 175);
      doc.text(
        itineraryItems.length === 0
          ? "No itinerary items have been added yet."
          : "No itinerary items met the approval threshold (score ≥ 0).",
        margin + 10, y
      );
      y += 18;
    } else {
      const sorted = [...approvedItems].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
      const byDate = {};
      sorted.forEach((item) => {
        const date = new Date(item.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(item);
      });

      Object.entries(byDate).forEach(([date, items]) => {
        checkPage(28);
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, y - 11, contentW, 17, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        doc.text(date, margin + 8, y);
        doc.setFontSize(11);
        doc.setTextColor(17, 24, 39);
        y += 20;

        items.forEach((item) => {
          checkPage(52);
          const timeStr = new Date(item.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const score = item.yes_votes - item.no_votes;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(17, 24, 39);
          doc.text(`${timeStr}  -  ${item.title}`, margin + 10, y);
          y += 14;
          if (item.category) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(150, 155, 165);
            const scoreLabel = `  ·  Score: ${score > 0 ? "+" : ""}${score}  (Yes ${item.yes_votes}  /  No ${item.no_votes})`;
            doc.text(item.category.toUpperCase() + scoreLabel, margin + 10, y);
            y += 12;
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(150, 155, 165);
            const scoreLabel = `Score: ${score > 0 ? "+" : ""}${score}  (Yes ${item.yes_votes}  /  No ${item.no_votes})`;
            doc.text(scoreLabel, margin + 10, y);
            y += 12;
          }
          doc.setFontSize(10);
          doc.setTextColor(107, 114, 128);
          doc.text(item.location, margin + 10, y);
          y += 13;
          if (item.description) {
            const summary = summarize(item.description);
            if (summary) {
              const lines = doc.splitTextToSize(summary, contentW - 20);
              doc.setTextColor(75, 85, 99);
              lines.forEach((line) => { checkPage(13); doc.text(line, margin + 10, y); y += 13; });
            }
          }
          doc.setTextColor(17, 24, 39);
          y += 10;
        });
        y += 6;
      });
    }

    // Footer on every page
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(249, 250, 251);
      doc.rect(0, pageH - 36, pageW, 36, "F");
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text(`YTrips  |  ${trip.name}`, margin, pageH - 16);
      doc.text(`Page ${i} of ${totalPages}`, pageW - margin - doc.getTextWidth(`Page ${i} of ${totalPages}`), pageH - 16);
    }

    return doc;
  };

  const doExportPDF = () => {
    setShowExportConfirm(false);
    const doc = buildPDFDoc();
    doc.save(`YTRIPS - ${trip.name} Itinerary.pdf`);
  };

  const handleDownloadAndShare = async () => {
    setShowFinalizedModal(false);
    setShowExportConfirm(false);
    const doc = buildPDFDoc();
    const filename = `YTRIPS - ${trip.name} Itinerary.pdf`;
    // Try sharing the PDF file directly — no download
    try {
      const blob = doc.output("blob");
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `YTRIPS - ${trip.name} Itinerary` });
        return;
      }
    } catch {}
    // Fallback: just download it
    doc.save(filename);
  };


  const FlightCard = ({ flight, canDelete }) => (
    <div className="flight-result-card">
      <div className="flight-result-top">
        <div>
          <div className="flight-carrier">
            {flight.airline}
            {flight.flight_number && (
              <span className="flight-number-tag"> · {flight.flight_number}</span>
            )}
          </div>
          <div className="flight-route">
            {flight.departure_airport} → {flight.arrival_airport}
          </div>
          <div className="flight-times">
            {formatDateTime(flight.departure_time)} → {formatDateTime(flight.arrival_time)}
          </div>
        </div>
        {canDelete && (
          confirmDeleteFlight === flight.id ? (
            <div className="flight-delete-confirm">
              <span>Remove?</span>
              <button className="confirm-yes" onClick={() => handleDeleteFlight(flight.id)}>Delete</button>
              <button className="confirm-no" onClick={() => setConfirmDeleteFlight(null)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-delete" onClick={() => setConfirmDeleteFlight(flight.id)}>
              Delete
            </button>
          )
        )}
      </div>
    </div>
  );

  const bannerStyle = trip
    ? trip.banner_image_url
      ? { backgroundImage: `url(${trip.banner_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { background: trip.banner_color || "#1e3a8a" }
    : { background: "transparent" };

  const myFlights = flightByUser[user?.id] || [];
  const isOwner = trip && user && trip.created_by_user_id === user.id;
  const itineraryDayGroups = getItineraryDayGroups(itineraryItems);

  const renderItineraryCard = (item) => {
    const totalVotes = item.yes_votes + item.no_votes;
    const allVoted = members.length > 0 && totalVotes === members.length;
    const isUnpopular = allVoted && totalVotes > 0 && item.yes_votes / totalVotes < 0.5;
    return (
    <div className={`itinerary-card${isUnpopular ? " itinerary-card-unpopular" : ""}`} key={item.id}>
      <div className="itinerary-card-top">
        <div style={{ flex: 1 }}>
          <div className="itinerary-card-title-row">
            <h4>{item.title}</h4>
            <span className="trip-badge">{item.category}</span>
          </div>
          <div className="itinerary-meta">
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {formatDateTime(item.scheduled_at)}
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
              {item.location}
            </span>
            <span>Added by {memberNameById[item.created_by_user_id] || "A trip member"}</span>
          </div>
          {item.description && <p className="itinerary-description">{item.description}</p>}
          <div className="itinerary-vote-row">
            <button
              className={`btn btn-vote${item.user_vote === true ? " vote-active-yes" : ""}`}
              onClick={() => handleVote(item.id, true)}
            >
              <span style={{ color: item.user_vote === true ? "#fff" : "#16a34a" }}>👍</span> {item.yes_votes}
            </button>
            {confirmSoloNoVote === item.id ? (
              <div className="flight-delete-confirm">
                <span>You're the only member — voting No will delete this item. Continue?</span>
                <button className="btn btn-danger btn-xs" onClick={() => handleConfirmSoloNoVote(item.id)}>Yes, delete</button>
                <button className="btn btn-outline btn-xs" onClick={() => setConfirmSoloNoVote(null)}>Cancel</button>
              </div>
            ) : (
              <button
                className={`btn btn-vote${item.user_vote === false ? " vote-active-no" : ""}`}
                onClick={() => handleVote(item.id, false)}
              >
                <span style={{ color: item.user_vote === false ? "#fff" : "#dc2626" }}>👎</span> {item.no_votes}
              </button>
            )}
            {(item.yes_votes + item.no_votes) > 0 && (
              <span className="vote-approval">
                {Math.round((item.yes_votes / (item.yes_votes + item.no_votes)) * 100)}% approval
              </span>
            )}
          </div>
        </div>
        <div className="itinerary-actions">
          {confirmDeleteItinerary === item.id ? (
            <div className="flight-delete-confirm">
              <span>Remove?</span>
              <button className="confirm-yes" onClick={() => handleDeleteItineraryItem(item.id)}>Delete</button>
              <button className="confirm-no" onClick={() => setConfirmDeleteItinerary(null)}>Cancel</button>
            </div>
          ) : (
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditModal(item)}>
                Edit
              </button>
              <button type="button" className="btn btn-delete" onClick={() => setConfirmDeleteItinerary(item.id)}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="page">
      <Navbar />
      <div className="trip-detail-page">
        {/* Full-width banner */}
        <div className="trip-banner" style={{ ...bannerStyle, alignItems: loading ? "flex-start" : undefined }}>
          <div className="trip-banner-inner">
            {!loading && (
              <button className="btn btn-back-white" onClick={() => navigate("/")}>
                ← Back to Dashboard
              </button>
            )}
            {!loading && !error && trip && (
              <div className="trip-banner-title">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <h1 style={{ flex: 1 }}>{trip.name}</h1>
                  <button
                    className="banner-edit-btn"
                    onClick={() => setShowTripPreview(true)}
                    title="Preview trip"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Preview
                  </button>
                  {!trip.is_finalized && (
                  <button
                    className="banner-edit-btn"
                    onClick={() => setShowBannerEdit((v) => !v)}
                    title="Edit banner"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit banner
                  </button>
                  )}
                  {trip.is_finalized && (
                  <button
                    className="banner-edit-btn"
                    onClick={() => setShowExportConfirm(true)}
                    title="Download itinerary PDF"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export PDF
                  </button>
                  )}
                  {isOwner && (
                    trip.is_finalized ? (
                      <button
                        className="banner-edit-btn banner-unlock-btn"
                        onClick={handleUnfinalize}
                        title="Unlock trip"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                        Unlock
                      </button>
                    ) : (
                      <button
                        className="banner-edit-btn banner-finalize-btn"
                        onClick={() => setShowFinalizeConfirm(true)}
                        title="Finalize trip"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Finalize
                      </button>
                    )
                  )}
                </div>
                {trip.is_finalized && (
                  <div className="finalized-banner-badge" style={{ marginTop: 14, marginBottom: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Trip Finalized
                    {!isOwner && <span style={{ opacity: 0.75, marginLeft: 8 }}>· Itinerary is locked</span>}
                  </div>
                )}
                <div className="trip-banner-meta" style={{ marginTop: trip.is_finalized ? 0 : 14 }}>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                    {trip.destination_name}
                  </span>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                  </span>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </span>
                </div>

                {showBannerEdit && (
                  <div className="banner-edit-panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="banner-edit-label" style={{ marginBottom: 0 }}>Edit Banner</span>
                      <button
                        type="button"
                        className="banner-panel-close"
                        onClick={() => setShowBannerEdit(false)}
                        title="Close"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="banner-edit-section">
                      <span className="banner-edit-label">Colour</span>
                      <div className="color-picker-row">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`color-swatch${trip.banner_color === c && !trip.banner_image_url ? " selected" : ""}`}
                            style={{ background: c }}
                            onClick={() => handleColorChange(c)}
                            disabled={savingBanner}
                          />
                        ))}
                        <div className="color-custom-wrapper" title="Custom colour">
                          <div className="color-custom-swatch">+</div>
                          <input
                            type="color"
                            className="color-custom-input"
                            value={trip.banner_color || "#1e3a8a"}
                            onChange={(e) => handleColorChange(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="banner-edit-section">
                      <span className="banner-edit-label">Image</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="banner-upload-btn"
                          onClick={() => fileInputRef.current.click()}
                          disabled={savingBanner}
                        >
                          {trip.banner_image_url ? "Change image" : "Upload image"}
                        </button>
                        {trip.banner_image_url && (
                          <button
                            type="button"
                            className="banner-remove-btn"
                            onClick={handleRemoveImage}
                            disabled={savingBanner}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleImageChange}
                      />
                    </div>
                    {savingBanner && <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Saving…</span>}
                  </div>
                )}
              </div>
            )}
            {loading && <p style={{ color: "rgba(255,255,255,0.8)" }}>Loading…</p>}
            {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
          </div>
        </div>

        {!loading && !error && (
          <div className="page-body">
            {/* Invite Code */}
            <div className="card">
              <h3>Invite Code</h3>
              <p className="text-sub" style={{ marginTop: 4, marginBottom: 16 }}>
                Share this code with friends so they can join the trip.
              </p>
              <div className="trip-invite-full">
                <code>{trip.invite_code}</code>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { navigator.clipboard.writeText(trip.invite_code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {copiedCode ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Main tabbed card */}
            <div className="card">
              <div className="flight-tabs">
                <button className={`flight-tab${activeTab === "my" ? " active" : ""}`} onClick={() => setActiveTab("my")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                  My Flight
                </button>
                <button className={`flight-tab${activeTab === "group" ? " active" : ""}`} onClick={() => setActiveTab("group")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Group Flights
                </button>
                <button
                  className={`flight-tab${activeTab === "itinerary" ? " active" : ""}`}
                  onClick={() => setActiveTab("itinerary")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Itinerary
                  <span className="tab-count">{itineraryItems.length}</span>
                </button>
                <button
                  className={`flight-tab${activeTab === "members" ? " active" : ""}`}
                  onClick={() => setActiveTab("members")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Members
                  <span className="tab-count">{members.length}</span>
                </button>
              </div>

              {/* My Flight */}
              {activeTab === "my" && (
                <div className="mt-md">
                  <div className="member-flight-label" style={{ marginBottom: 8 }}>
                    <span className="member-flight-name">My Flight</span>
                    <span className="trip-badge">You</span>
                    <span className="member-home-airport">
                      {editingMyHome ? (
                        <>
                          <div style={{ width: 220 }}>
                            <AirportInput
                              value={myHomeDraft}
                              onChange={setMyHomeDraft}
                              autoFocus
                              placeholder="City or IATA"
                              inputStyle={{ width: "100%", padding: "4px 8px", fontSize: 13 }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={handleSaveMyHome}
                            disabled={myHomeSaving}
                          >
                            {myHomeSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={cancelEditMyHome}
                            disabled={myHomeSaving}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="trip-badge">
                            {myMember?.home_airport ? `Home: ${myMember.home_airport}` : "No home airport"}
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={startEditMyHome}
                          >
                            Change
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  {editingMyHome && myHomeError && (
                    <p className="error-text" style={{ marginTop: 4 }}>{myHomeError}</p>
                  )}
                  {myFlights.length > 0 ? (
                    <div className="flight-results">
                      {myFlights.map((f) => <FlightCard key={f.id} flight={f} canDelete={!trip.is_finalized} />)}
                    </div>
                  ) : (
                    <p className="text-sub">{trip.is_finalized ? "No flight was added." : "No flight added yet. Search and add your flight below!"}</p>
                  )}
                </div>
              )}

              {/* Group Flights */}
              {activeTab === "group" && (
                <div className="gap-col mt-md">
                  {sortedMembers.map((member) => {
                    const isMe = member.user_id === user?.id;
                    const memberFlights = flightByUser[member.user_id] || [];
                    const isEditingAirport = editingHomeAirportUserId === member.user_id;
                    return (
                      <div key={member.user_id}>
                        <div className="member-flight-label">
                          <span className="member-flight-name">{isMe ? "My Flight" : member.display_name}</span>
                          {isMe && <span className="trip-badge">You</span>}
                          <span className="member-home-airport">
                            {isEditingAirport ? (
                              <>
                                <div style={{ width: 220 }}>
                                  <AirportInput
                                    value={homeAirportDraft}
                                    onChange={setHomeAirportDraft}
                                    autoFocus
                                    placeholder="City or IATA"
                                    inputStyle={{ width: "100%", padding: "4px 8px", fontSize: 13 }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  onClick={() => saveHomeAirport(member.user_id)}
                                >
                                  Use
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={cancelEditHomeAirport}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                {(() => {
                                  const effective = getEffectiveHomeAirport(member);
                                  const overridden = homeAirportOverrides[member.user_id];
                                  return (
                                    <span className="trip-badge">
                                      {effective ? `Home: ${effective}` : "No home airport"}
                                      {overridden && " (this search only)"}
                                    </span>
                                  );
                                })()}
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => startEditHomeAirport(member)}
                                >
                                  Edit
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                        {isEditingAirport && homeAirportError && (
                          <p className="error-text" style={{ marginTop: 4 }}>{homeAirportError}</p>
                        )}
                        {memberFlights.length > 0 ? (
                          <div className="flight-results mt-sm">
                            {memberFlights.map((f) => <FlightCard key={f.id} flight={f} canDelete={isMe} />)}
                          </div>
                        ) : (
                          <p className="text-sub" style={{ marginTop: 6 }}>No flight added yet.</p>
                        )}
                      </div>
                    );
                  })}

                  <div className="card mt-md">
                    <h4 style={{ marginBottom: 12 }}>Find a group arrival window</h4>
                    <p className="text-sub" style={{ marginBottom: 12 }}>
                      Uses each checked member's home airport above (including any "this search only" overrides). Picks the cheapest combined 3-hour arrival window where everyone can land.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      <div className="text-sub" style={{ marginBottom: 8, fontWeight: 600 }}>Include in search</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {sortedMembers.map((m) => {
                          const isMe = m.user_id === user?.id;
                          const label = isMe ? "You" : m.display_name;
                          const hasFlight = (flightByUser[m.user_id] || []).length > 0;
                          const included = isMemberIncluded(m.user_id);
                          return (
                            <label
                              key={m.user_id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 12px",
                                border: "1.5px solid var(--border)",
                                borderRadius: 999,
                                background: included ? "var(--bg-input)" : "transparent",
                                cursor: "pointer",
                                fontSize: 14,
                                userSelect: "none",
                                lineHeight: 1.2,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={() => toggleMemberIncluded(m.user_id)}
                                style={{
                                  width: 16,
                                  height: 16,
                                  padding: 0,
                                  margin: 0,
                                  flexShrink: 0,
                                  cursor: "pointer",
                                }}
                              />
                              <span style={{ whiteSpace: "nowrap" }}>{label}</span>
                              {hasFlight && (
                                <span className="text-sub" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                                  · has flight
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="group-search-date">Arrival date</label>
                        <input
                          id="group-search-date"
                          type="date"
                          value={groupSearchDate}
                          min={trip?.start_date || undefined}
                          max={trip?.end_date || undefined}
                          onChange={(e) => setGroupSearchDate(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="group-search-dest">Destination</label>
                        <AirportInput
                          inputId="group-search-dest"
                          placeholder="City or IATA (e.g. Paris or CDG)"
                          value={groupSearchDest}
                          onChange={setGroupSearchDest}
                        />
                      </div>
                    </div>
                    {groupSearchError && <p className="error-text" style={{ marginTop: 12 }}>{groupSearchError}</p>}
                    <div style={{ marginTop: 16 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleRunGroupSearch}
                        disabled={groupSearchLoading}
                      >
                        {groupSearchLoading ? "Searching…" : "Run group search"}
                      </button>
                    </div>

                    {groupSearchSummary && (
                      <div className="group-search-summary mt-md">
                        <div>
                          <strong>Searching:</strong> {groupSearchSummary.destination} · {groupSearchSummary.date}
                        </div>
                        <div className="group-search-origins mt-sm">
                          {groupSearchSummary.perMember.map(({ member, origin, overridden }) => (
                            <span key={member.user_id} className="trip-badge">
                              {member.display_name}: {origin}
                              {overridden && " ★"}
                            </span>
                          ))}
                        </div>
                        {groupSearchSummary.skipped.length > 0 && (
                          <p className="text-sub mt-sm">
                            Skipped (no home airport): {groupSearchSummary.skipped.join(", ")}
                          </p>
                        )}
                        {groupSearchSummary.excluded.length > 0 && (
                          <p className="text-sub mt-sm">
                            Not included: {groupSearchSummary.excluded.join(", ")}
                          </p>
                        )}
                        {groupSearchSummary.infeasibleOrigins?.length > 0 && (
                          <p className="text-sub mt-sm">
                            No flights landing on this date from: {groupSearchSummary.infeasibleOrigins.join(", ")}
                          </p>
                        )}
                        {groupSearchSummary.skippedMixedCurrency > 0 && (
                          <p className="text-sub mt-sm">
                            {groupSearchSummary.skippedMixedCurrency} window(s) hidden due to mixed currencies across origins.
                          </p>
                        )}
                        <p className="text-sub" style={{ marginTop: 4, fontSize: 12 }}>
                          ★ Airports marked were manually inputted for this search
                        </p>
                      </div>
                    )}

                    {groupSearchResults && groupSearchResults.length === 0 && (
                      <p className="text-sub mt-md">No arrival window covers every origin on that date.</p>
                    )}
                    {groupSearchResults && groupSearchResults.length > 0 && (
                      <div className="mt-md gap-col">
                        {assignError && <p className="error-text">{assignError}</p>}
                        {assignSuccess && <p className="text-success">{assignSuccess}</p>}
                        {groupSearchResults.map((win, idx) => {
                          const membersForWindow = members
                            .filter((m) => isMemberIncluded(m.user_id))
                            .map((m) => {
                              const origin = getEffectiveHomeAirport(m);
                              const offer = origin ? win.best_offer_per_origin[origin] : null;
                              return { member: m, origin, offer };
                            });
                          const anyAssignable = membersForWindow.some((r) => r.offer);
                          const startHm = formatHm(win.window_start);
                          const endHm = formatHm(win.window_end);
                          const isTopPick = idx === 0;
                          return (
                            <div key={idx} className="card" style={{ padding: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <div>
                                  <strong>
                                    Arrival {startHm} – {endHm}
                                    {win.end_day_offset > 0 && <sup>+{win.end_day_offset}</sup>}
                                  </strong>
                                  <div className="text-sub" style={{ fontSize: 12, marginTop: 2 }}>
                                    {isTopPick && <span style={{ marginRight: 8 }}>Best balance of cost vs. everyone arriving close together · </span>}
                                    {win.total_combined} {win.currency} combined
                                    {" · "}{win.arrival_spread_minutes} min apart
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleAssignWindow(win, idx)}
                                  disabled={!anyAssignable || assigningWindowIdx === idx || trip.is_finalized}
                                  title={trip.is_finalized ? "Trip is locked" : "Create a flight row for each member using their origin"}
                                >
                                  {assigningWindowIdx === idx ? "Assigning…" : "Assign flights"}
                                </button>
                              </div>
                              <div className="text-sub mt-sm">
                                {membersForWindow.map(({ member, origin, offer }) => {
                                  if (!offer) {
                                    return (
                                      <div key={member.user_id} style={{ marginTop: 4 }}>
                                        <strong>{member.display_name}</strong>
                                        {origin ? <> ({origin})</> : null}: no flight in this window
                                      </div>
                                    );
                                  }
                                  const codes = offer.segments
                                    .map((s) => `${s.marketing_carrier_iata_code || ""}${s.flight_number || ""}`.trim())
                                    .filter(Boolean)
                                    .join(" → ");
                                  const lastSeg = offer.segments[offer.segments.length - 1];
                                  const arrHm = lastSeg.arriving_at.slice(11, 16);
                                  return (
                                    <div key={member.user_id} style={{ marginTop: 4 }}>
                                      <strong>{member.display_name}</strong> ({origin}): {offer.total_amount} {offer.total_currency} · {offer.owner_name}
                                      {codes && <> · {codes}</>}
                                      {" "}· arrives {arrHm}
                                      {offer.arrival_day_offset > 0 && <sup>+{offer.arrival_day_offset}</sup>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Itinerary */}
              {activeTab === "itinerary" && (
                <div className="mt-md">
                  {trip.is_finalized && (
                    <div className="finalized-notice">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      {isOwner ? "Trip is locked. Unlock to make changes." : "This itinerary has been finalized by the trip owner. Items are read-only."}
                    </div>
                  )}
                  {!trip.is_finalized && (
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
                        <select
                          id="itinerary-category"
                          name="category"
                          value={itineraryForm.category}
                          onChange={handleItineraryFieldChange}
                          required
                        >
                          <option value="" disabled>Select a category</option>
                          {ITINERARY_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
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
                      <label htmlFor="itinerary-description">Description <span className="optional-label">Optional</span></label>
                      <textarea
                        id="itinerary-description"
                        name="description"
                        value={itineraryForm.description}
                        onChange={handleItineraryFieldChange}
                        placeholder="Add notes, meeting details, reservation info, or links."
                        rows={3}
                      />
                    </div>
                    {itineraryError && <p className="error-text">{itineraryError}</p>}
                    {itinerarySuccess && <p className="text-success">{itinerarySuccess}</p>}
                    <div className="itinerary-form-actions">
                      <button type="submit" className="btn btn-primary" disabled={itinerarySubmitting}>
                        {itinerarySubmitting ? "Adding…" : "Add Item"}
                      </button>
                    </div>
                  </form>
                  )}

                  {itineraryItems.length > 0 ? (
                    <div className="itinerary-list">
                      {itineraryDayGroups.map((group) => {
                        const dayOffset = getDayOffset(trip?.start_date, group.dateKey);
                        return (
                          <section className="itinerary-day" key={group.dateKey}>
                            <div className="itinerary-day-header">
                              <span>{dayOffset === null ? "Itinerary" : `Day ${dayOffset + 1}`}</span>
                              <h4>{formatDateKey(group.dateKey)}</h4>
                            </div>
                            <div className="itinerary-day-items">
                              {group.items.map((item) => (
                                renderItineraryCard(item)
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="itinerary-empty">
                      <h4>No itinerary items yet</h4>
                      <p>Start building the plan with activities, reservations, transfers, or meetups.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Members */}
              {activeTab === "members" && (
                <div className="members-list mt-md">
                  {sortedMembers.length === 0 ? (
                    <p className="text-sub">No members found.</p>
                  ) : (
                    sortedMembers.map((member) => {
                      const isMe = member.user_id === user?.id;
                      const initials = member.display_name
                        ? member.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                        : "?";
                      return (
                        <div key={member.user_id} className="member-row">
                          <div className="member-avatar">
                            {member.avatar_url
                              ? <img src={member.avatar_url} alt={member.display_name} referrerPolicy="no-referrer" />
                              : <span>{initials}</span>
                            }
                          </div>
                          <div className="member-info">
                            <div className="member-info-top">
                              <span className="member-info-name">{isMe ? "You" : member.display_name}</span>
                              {member.role === "owner" && <span className="member-role-badge">Owner</span>}
                            </div>
                            <span className="member-info-sub">{member.display_name}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Search & Add Flights — only on the "My Flight" tab */}
            {activeTab === "my" && (
              trip.is_finalized ? (
                <div className="card">
                  <div className="finalized-notice">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Flight search is locked — trip has been finalized.
                  </div>
                </div>
              ) : (
                <div className="card">
                  <h3 className="mb-lg">Search &amp; Add Flights</h3>
                  <FlightSearch
                    tripId={parseInt(id, 10)}
                    destination={trip.destination_name}
                    tripStartDate={trip.start_date}
                    tripEndDate={trip.end_date}
                    onFlightAdded={refreshFlights}
                    myFlights={myFlights}
                  />
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Edit itinerary modal */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Itinerary Item</h3>
              <button className="modal-close" onClick={closeEditModal}>✕</button>
            </div>
            <form onSubmit={handleSubmitEditModal}>
              <div className="form-row">
                <div className="form-group">
                  <label>Title</label>
                  <input name="title" value={editModalForm.title} onChange={handleEditModalFieldChange} required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={editModalForm.category} onChange={handleEditModalFieldChange} required>
                    <option value="" disabled>Select a category</option>
                    {ITINERARY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    name="scheduled_at"
                    value={editModalForm.scheduled_at}
                    onChange={handleEditModalFieldChange}
                    min={getTripDateTimeBoundary(trip?.start_date)}
                    max={getTripDateTimeBoundary(trip?.end_date, true)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input name="location" value={editModalForm.location} onChange={handleEditModalFieldChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>Description <span className="optional-label">Optional</span></label>
                <textarea name="description" value={editModalForm.description} onChange={handleEditModalFieldChange} rows={3} />
              </div>
              {editModalError && <p className="error-text">{editModalError}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeEditModal} disabled={editModalSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editModalSubmitting}>
                  {editModalSubmitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Finalize confirmation */}
      {showFinalizeConfirm && (
        <div className="modal-overlay" onClick={() => setShowFinalizeConfirm(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Finalize Trip</h3>
              <button className="modal-close" onClick={() => setShowFinalizeConfirm(false)}>&#x2715;</button>
            </div>
            <p style={{ color: "var(--subtext)", fontSize: 14, lineHeight: 1.6 }}>
              Finalizing will lock the itinerary and banner for all members. You can unlock the trip at any time.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowFinalizeConfirm(false)} disabled={finalizing}>Cancel</button>
              <button className="btn btn-primary" onClick={handleFinalize} disabled={finalizing}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                {finalizing ? "Finalizing…" : "Finalize Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-finalize action modal */}
      {showFinalizedModal && (
        <div className="modal-overlay" onClick={() => setShowFinalizedModal(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8, verticalAlign: "middle", color: "#16a34a" }}><polyline points="20 6 9 17 4 12"/></svg>
                Trip Finalized!
              </h3>
              <button className="modal-close" onClick={() => setShowFinalizedModal(false)}>&#x2715;</button>
            </div>
            <p style={{ color: "var(--subtext)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              The itinerary is now locked. Would you like to export a PDF summary to share with your group?
            </p>
            <div className="finalized-action-grid">
              <button className="finalized-action-btn" onClick={() => setShowFinalizedModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
                <span>Later</span>
                <small>I'll do this another time</small>
              </button>
              <button className="finalized-action-btn finalized-action-btn--primary" onClick={() => { setShowFinalizedModal(false); doExportPDF(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download PDF</span>
                <small>Save itinerary to device</small>
              </button>
              <button className="finalized-action-btn finalized-action-btn--share" onClick={handleDownloadAndShare}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span>Share PDF</span>
                <small>Send without saving</small>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share copied toast */}
      {/* Export PDF confirmation (from banner button) */}
      {showExportConfirm && (
        <div className="modal-overlay" onClick={() => setShowExportConfirm(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Trip Summary</h3>
              <button className="modal-close" onClick={() => setShowExportConfirm(false)}>&#x2715;</button>
            </div>
            <p style={{ color: "var(--subtext)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Generate a PDF with your trip details, member list, flights, and itinerary.
            </p>
            <div className="finalized-action-grid">
              <button className="finalized-action-btn" onClick={() => setShowExportConfirm(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                <span>Cancel</span>
                <small>Go back</small>
              </button>
              <button className="finalized-action-btn finalized-action-btn--primary" onClick={doExportPDF}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download PDF</span>
                <small>Save to device</small>
              </button>
              <button className="finalized-action-btn finalized-action-btn--share" onClick={() => { setShowExportConfirm(false); handleDownloadAndShare(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span>Share PDF</span>
                <small>Send without saving</small>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Preview overlay */}
      {showTripPreview && (
        <div className="trip-preview-overlay">
          <div className="trip-preview-header">
            <span className="trip-preview-title">Trip Preview</span>
            <button className="trip-preview-close" onClick={() => setShowTripPreview(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Close
            </button>
          </div>
          <div className="trip-preview-body">
            {/* Hero */}
            <div className="trip-preview-hero" style={bannerStyle}>
              <div className="trip-preview-hero-inner">
                <h1>{trip.name}</h1>
                <div className="trip-preview-hero-meta">
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                    {trip.destination_name}
                  </span>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                  </span>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </span>
                </div>
              </div>
            </div>

            <div className="trip-preview-content">
              {/* Members */}
              <section className="trip-preview-section">
                <h2 className="trip-preview-section-title">Members</h2>
                <div className="trip-preview-members">
                  {sortedMembers.map((m) => {
                    const initials = m.display_name ? m.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";
                    const isMe = m.user_id === user?.id;
                    return (
                      <div key={m.user_id} className="trip-preview-member">
                        <div className="member-avatar">
                          {m.avatar_url ? <img src={m.avatar_url} alt={m.display_name} referrerPolicy="no-referrer" /> : <span>{initials}</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{isMe ? "You" : m.display_name}</div>
                          {m.role === "owner" && <div style={{ fontSize: 12, color: "var(--subtext)" }}>Owner</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Flights */}
              <section className="trip-preview-section">
                <h2 className="trip-preview-section-title">Flights</h2>
                {sortedMembers.map((m) => {
                  const isMe = m.user_id === user?.id;
                  const mFlights = flightByUser[m.user_id] || [];
                  return (
                    <div key={m.user_id} className="trip-preview-flight-group">
                      <div className="trip-preview-flight-name">
                        {isMe ? "My Flight" : m.display_name}
                        {isMe && <span className="trip-badge" style={{ marginLeft: 8 }}>You</span>}
                      </div>
                      {mFlights.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--subtext)", marginTop: 4 }}>No flight added.</p>
                      ) : (
                        mFlights.map((f) => (
                          <div key={f.id} className="trip-preview-flight-card">
                            <div style={{ fontWeight: 700, fontSize: 15 }}>Flight {f.flight_number} · {f.airline}</div>
                            <div style={{ fontSize: 14, color: "var(--subtext)", marginTop: 2 }}>{f.departure_airport} → {f.arrival_airport}</div>
                            <div style={{ fontSize: 13, color: "var(--subtext)", marginTop: 2 }}>{formatDateTime(f.departure_time)} → {formatDateTime(f.arrival_time)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </section>

              {/* Itinerary */}
              <section className="trip-preview-section">
                <h2 className="trip-preview-section-title">Itinerary</h2>
                {itineraryItems.length === 0 ? (
                  <p style={{ fontSize: 14, color: "var(--subtext)" }}>No itinerary items yet.</p>
                ) : (() => {
                  const sorted = [...itineraryItems].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
                  const byDate = {};
                  sorted.forEach((item) => {
                    const d = new Date(item.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                    if (!byDate[d]) byDate[d] = [];
                    byDate[d].push(item);
                  });
                  return Object.entries(byDate).map(([date, items]) => (
                    <div key={date} className="trip-preview-day">
                      <div className="trip-preview-day-header">{date}</div>
                      {items.map((item) => (
                        <div key={item.id} className="trip-preview-item">
                          <div className="trip-preview-item-time">
                            {new Date(item.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </div>
                          <div className="trip-preview-item-body">
                            <div className="trip-preview-item-title">
                              {item.title}
                              <span className="trip-badge" style={{ marginLeft: 8, fontSize: 11 }}>{item.category}</span>
                            </div>
                            {item.location && <div className="trip-preview-item-meta">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                              {item.location}
                            </div>}
                            {item.description && <p className="trip-preview-item-desc">{item.description}</p>}
                            <div className="trip-preview-item-votes">
                              <span style={{ color: "#16a34a" }}>👍 {item.yes_votes}</span>
                              <span style={{ color: "#dc2626", marginLeft: 10 }}>👎 {item.no_votes}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
