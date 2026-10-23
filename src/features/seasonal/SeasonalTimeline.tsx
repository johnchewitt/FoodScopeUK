import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { MONTHS_LONG, MONTHS_SHORT } from "@/analysis/format";
import { isAvailable } from "@/analysis/seasonal";
import { formatMeasure } from "@/features/origins/model";
import { PLAY_MONTH_MS, PLAY_SPEEDS, useAppStore, type PlaySpeed } from "@/state/store";
import type { SeasonalModel } from "./model";
import { useSeasonal } from "./useSeasonal";

const SPEED_LABEL: Record<PlaySpeed, string> = { 0.5: "½×", 1: "1×", 2: "2×" };

function monthValueText(model: SeasonalModel, m: number): string {
  const info = model.months[m - 1]!;
  const base = `${MONTHS_LONG[m - 1]} ${model.year}`;
  if (info.state === "not_yet_published") return `${base}: not yet published by HMRC`;
  if (info.state === "before_snapshot") return `${base}: before this snapshot`;
  if (info.state === "nil") return `${base}: no recorded imports`;
  const v = model.totals[m - 1];
  return `${base}: ${v === null || v === undefined ? "—" : formatMeasure(v, model.measure)} recorded imports${info.provisional ? ", provisional" : ""}`;
}

/** First and last month of the year with published figures (playback range). */
function playableRange(model: SeasonalModel): [number, number] | null {
  const avail = model.months.filter(isAvailable).map((m) => m.month);
  return avail.length ? [avail[0]!, avail[avail.length - 1]!] : null;
}

/**
 * Plays through the months of the selected year (SS-03): 1.2 s per month at 1×, stopping at the
 * last published month. Any change the user makes to month, year, commodity, measure or
 * comparison stops it (store actions). Under reduced motion the steps still advance — they are
 * user-started — but every transition is instant.
 */
function usePlayback(model: SeasonalModel | null): void {
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.playSpeed);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const playbackStep = useAppStore((s) => s.playbackStep);
  const year = model?.year ?? null;
  const month = model?.month ?? null;
  const range = model ? playableRange(model) : null;
  const last = range?.[1] ?? null;

  useEffect(() => {
    if (!playing || year === null || month === null) return;
    if (last === null || month >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => playbackStep(year, month + 1), PLAY_MONTH_MS / speed);
    return () => window.clearTimeout(timer);
  }, [playing, year, month, last, speed, setPlaying, playbackStep]);
}

export function SeasonalTimeline() {
  const { model, status } = useSeasonal();
  usePlayback(model);
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.playSpeed);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setPlaySpeed = useAppStore((s) => s.setPlaySpeed);
  const playbackStep = useAppStore((s) => s.playbackStep);
  const setYearMonth = useAppStore((s) => s.setYearMonth);
  const compareMonth = useAppStore((s) => s.compareMonth);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragging = useRef(false);

  if (!model) {
    return (
      <section className="timeline timeline--seasonal" aria-label="Timeline">
        <div className="timeline__bar glass season-tl">
          <button type="button" className="season-play" aria-disabled="true" aria-label="Play through months">
            <Play size={18} aria-hidden="true" />
          </button>
          <p className="timeline__status" aria-live="polite">
            {status === "error" ? "Monthly trade data could not be loaded." : "Loading monthly data…"}
          </p>
        </div>
      </section>
    );
  }

  const { year, month, years } = model;
  const range = playableRange(model);
  const firstYear = years[0]!;
  const lastYear = years[years.length - 1]!;
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (!range) return;
    // From the end of the year (or an unpublished month) playback restarts in January.
    if (month >= range[1] || month < range[0]) playbackStep(year, range[0]);
    setPlaying(true);
  };
  const changeYear = (delta: number) => {
    const y = Math.min(lastYear, Math.max(firstYear, year + delta));
    if (y !== year) setYearMonth(y, month);
  };
  // Pointer: press or drag anywhere on the track to scrub through the months (each column is one
  // month, so the pointer lands exactly on the month under it). Keyboard: the range input below.
  const monthAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(12, Math.max(1, Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * 12) + 1));
  };
  const scrub = (e: PointerEvent<HTMLDivElement>) => {
    const m = monthAt(e);
    if (m !== month || playing) setYearMonth(year, m);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    inputRef.current?.focus({ preventScroll: true });
    scrub(e);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) scrub(e);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const onRangeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Page Up / Page Down step the year; arrows, Home and End move the month (native slider).
    if (e.key === "PageUp") changeYear(1);
    else if (e.key === "PageDown") changeYear(-1);
    else if (e.key === " " && !e.repeat) togglePlay();
    else return;
    e.preventDefault();
  };
  const info = model.monthInfo;
  const value = model.totals[month - 1];
  const statusText = !model.available
    ? (model.monthUnavailableText ?? "")
    : `${MONTHS_LONG[month - 1]} ${year} · ${info.state === "nil" ? "no recorded imports" : value === null || value === undefined ? "—" : formatMeasure(value, model.measure)}${
        model.summary.top ? ` · top partner ${model.summary.top.name}` : ""
      }${info.provisional ? " · provisional" : ""}`;

  return (
    <section className="timeline timeline--seasonal" aria-label="Timeline">
      <div className="timeline__bar glass season-tl" data-playing={playing}>
        <div className="season-tl__controls">
          <button
            type="button"
            className="season-play"
            aria-pressed={playing}
            aria-label={playing ? "Pause" : `Play through ${year}`}
            title={playing ? "Pause" : `Play through ${year} (${PLAY_MONTH_MS / 1000 / speed} s per month)`}
            aria-disabled={!range}
            onClick={togglePlay}
          >
            {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <div className="season-speed" role="radiogroup" aria-label="Playback speed">
            {PLAY_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                title={`${(PLAY_MONTH_MS / 1000 / s).toLocaleString("en-GB")} s per month`}
                aria-label={`${SPEED_LABEL[s]} speed, ${(PLAY_MONTH_MS / 1000 / s).toLocaleString("en-GB")} seconds per month`}
                onClick={() => setPlaySpeed(s)}
              >
                {SPEED_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="season-tl__year" role="group" aria-label="Year">
          <button
            type="button"
            className="tool-btn"
            aria-label="Previous year"
            aria-disabled={year <= firstYear}
            onClick={() => changeYear(-1)}
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <span className="season-tl__year-label" aria-live="polite">
            {year}
          </span>
          <button
            type="button"
            className="tool-btn"
            aria-label="Next year"
            aria-disabled={year >= lastYear}
            onClick={() => changeYear(1)}
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>

        <div
          className="season-tl__track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="season-tl__cols" aria-hidden="true">
            {model.months.map((m, i) => {
              const v = model.totals[i];
              const h = v !== null && v !== undefined && model.barScaleMax > 0 ? v / model.barScaleMax : 0;
              return (
                <span
                  key={m.key}
                  className="season-tl__col"
                  data-state={m.state}
                  data-selected={m.month === month}
                  data-compare={compareMonth === m.month}
                  data-provisional={m.provisional}
                >
                  <span
                    className="season-tl__bar"
                    style={{ height: `${Math.max(isAvailable(m) ? 6 : 0, h * 100)}%` }}
                  />
                  <span className="season-tl__label">
                    <span className="season-tl__label-long">{MONTHS_SHORT[i]}</span>
                    <span className="season-tl__label-short">{MONTHS_SHORT[i]!.slice(0, 1)}</span>
                  </span>
                </span>
              );
            })}
          </div>
          <input
            ref={inputRef}
            type="range"
            className="season-tl__range"
            min={1}
            max={12}
            step={1}
            value={month}
            aria-label={`Month, ${year}`}
            aria-valuetext={monthValueText(model, month)}
            onChange={(e) => setYearMonth(year, Number(e.target.value))}
            onKeyDown={onRangeKey}
          />
        </div>

        <p
          className="season-tl__status"
          aria-live={playing ? "off" : "polite"}
          data-unavailable={!model.available}
        >
          {statusText}
        </p>
      </div>
    </section>
  );
}
