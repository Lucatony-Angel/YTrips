import { useRef, useCallback } from "react";

const MAJOR_TICKS = [0, 6, 12, 18, 23];

export default function DualRangeSlider({ min = 0, max = 23, startValue, endValue, onChange }) {
  const trackRef = useRef(null);
  const valuesRef = useRef({ start: startValue, end: endValue });
  valuesRef.current = { start: startValue, end: endValue };

  const pct = (v) => ((v - min) / (max - min)) * 100;

  const valueFromClientX = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (max - min) + min);
  }, [min, max]);

  const startDrag = (e, thumb) => {
    e.preventDefault();
    const onMove = (ev) => {
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const v = valueFromClientX(clientX);
      const cur = valuesRef.current;
      if (thumb === "start") {
        const clamped = Math.max(min, Math.min(v, cur.end - 1));
        onChange(clamped, cur.end);
      } else {
        const clamped = Math.min(max, Math.max(v, cur.start + 1));
        onChange(cur.start, clamped);
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const startZ = startValue <= (max - min) / 2 ? 3 : 2;
  const endZ = startValue <= (max - min) / 2 ? 2 : 3;

  return (
    <div className="drs-root">
      <div className="drs-track-wrapper" ref={trackRef}>
        <div className="drs-track-bg" />
        <div
          className="drs-fill"
          style={{ left: `${pct(startValue)}%`, width: `${pct(endValue) - pct(startValue)}%` }}
        />
        <div
          className="drs-thumb"
          style={{ left: `${pct(startValue)}%`, zIndex: startZ }}
          onMouseDown={(e) => startDrag(e, "start")}
          onTouchStart={(e) => startDrag(e, "start")}
        />
        <div
          className="drs-thumb"
          style={{ left: `${pct(endValue)}%`, zIndex: endZ }}
          onMouseDown={(e) => startDrag(e, "end")}
          onTouchStart={(e) => startDrag(e, "end")}
        />
      </div>

      <div className="drs-ticks">
        {Array.from({ length: max - min + 1 }, (_, i) => {
          const val = min + i;
          const isMajor = MAJOR_TICKS.includes(val);
          return (
            <div key={val} className="drs-tick" style={{ left: `${pct(val)}%` }}>
              <div className={`drs-tick-line ${isMajor ? "drs-tick-major" : ""}`} />
              {isMajor && (
                <span className="drs-tick-label">{String(val).padStart(2, "0")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
