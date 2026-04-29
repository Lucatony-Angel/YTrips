import { useState, useEffect, useRef } from "react";
import { suggestAirports } from "../api/airports";

export default function AirportInput({
  value = "",
  onChange,
  placeholder = "City or IATA code",
  disabled = false,
  inputId,
  inputStyle,
  inputClassName,
  autoFocus = false,
  maxLength,
}) {
  const [query, setQuery] = useState(value || "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if ((value || "") !== query) {
      skipNextFetch.current = true;
      setQuery(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const trimmed = (query || "").trim();
    if (trimmed.length < 1) {
      setItems([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await suggestAirports(trimmed, 8);
        setItems(res || []);
        setHighlighted(res && res.length ? 0 : -1);
      } catch {
        setItems([]);
      }
    }, 180);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    function onMouseDownOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDownOutside);
    return () => document.removeEventListener("mousedown", onMouseDownOutside);
  }, []);

  const handlePick = (item) => {
    skipNextFetch.current = true;
    setQuery(item.iata);
    setItems([]);
    setOpen(false);
    if (onChange) onChange(item.iata);
  };

  const handleType = (e) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    if (onChange) onChange(next.trim().toUpperCase());
  };

  const handleKey = (e) => {
    if (!open || items.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (highlighted >= 0 && items[highlighted]) {
        e.preventDefault();
        handlePick(items[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={handleType}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={handleKey}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={maxLength}
        className={inputClassName}
        style={inputStyle}
      />
      {open && items.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            margin: "2px 0 0 0",
            padding: 0,
            listStyle: "none",
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: 6,
            boxShadow: "0 6px 18px rgba(15, 23, 42, 0.12)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {items.map((item, idx) => (
            <li
              key={`${item.iata}-${item.icao || idx}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(item);
              }}
              onMouseEnter={() => setHighlighted(idx)}
              style={{
                padding: "8px 10px",
                cursor: "pointer",
                background: idx === highlighted ? "rgba(45, 59, 232, 0.08)" : "transparent",
                fontSize: 13,
                lineHeight: 1.35,
              }}
            >
              <strong style={{ marginRight: 8, fontFamily: "monospace" }}>{item.iata}</strong>
              <span style={{ color: "var(--subtext, #64748b)" }}>
                {item.city ? `${item.city} · ` : ""}
                {item.name}
                {item.country ? ` · ${item.country}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
