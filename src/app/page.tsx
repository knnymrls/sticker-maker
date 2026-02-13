"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type ProcessingState =
  | { status: "idle" }
  | { status: "removing-bg"; progress: number }
  | { status: "creating-sticker" }
  | { status: "error"; message: string }
  | { status: "done"; original: string; cutout: string };

type OutlineStyle = "solid" | "wobbly" | "chaotic" | "wavy";
type ShadowStyle = "none" | "soft" | "hard" | "float";

interface WaveParams {
  freq: number;
  amp: number;
}

interface StickerSettings {
  outlineWidth: number;
  outlineColor: string;
  outlineStyle: OutlineStyle;
  wave1: WaveParams;
  wave2: WaveParams;
  wave3: WaveParams;
  masterAmp: number;
  shadowStyle: ShadowStyle;
}

const WAVE_DEFAULTS: Record<Exclude<OutlineStyle, "solid">, {
  wave1: WaveParams; wave2: WaveParams; wave3: WaveParams; masterAmp: number;
}> = {
  wobbly: {
    wave1: { freq: 2, amp: 1.2 },
    wave2: { freq: 3.5, amp: 0.8 },
    wave3: { freq: 7, amp: 0.3 },
    masterAmp: 2,
  },
  chaotic: {
    wave1: { freq: 4, amp: 1.5 },
    wave2: { freq: 9, amp: 1.2 },
    wave3: { freq: 17, amp: 0.8 },
    masterAmp: 3,
  },
  wavy: {
    wave1: { freq: 1.5, amp: 1.8 },
    wave2: { freq: 2.5, amp: 0.6 },
    wave3: { freq: 5, amp: 0.2 },
    masterAmp: 1.5,
  },
};

const DEFAULT_SETTINGS: StickerSettings = {
  outlineWidth: 8,
  outlineColor: "#ffffff",
  outlineStyle: "solid",
  wave1: { freq: 2, amp: 1.2 },
  wave2: { freq: 3.5, amp: 0.8 },
  wave3: { freq: 7, amp: 0.3 },
  masterAmp: 2,
  shadowStyle: "none",
};

const OUTLINE_STYLES: { value: OutlineStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "wobbly", label: "Wobbly" },
  { value: "chaotic", label: "Chaotic" },
  { value: "wavy", label: "Wavy" },
];

const SHADOW_STYLES: { value: ShadowStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "hard", label: "Hard" },
  { value: "float", label: "Float" },
];

const OUTLINE_PRESETS = [
  { color: "#ffffff", label: "White" },
  { color: "#000000", label: "Black" },
  { color: "#ef4444", label: "Red" },
  { color: "#3b82f6", label: "Blue" },
  { color: "#22c55e", label: "Green" },
  { color: "#f59e0b", label: "Yellow" },
  { color: "#a855f7", label: "Purple" },
  { color: "#ec4899", label: "Pink" },
];

export default function Home() {
  const [state, setState] = useState<ProcessingState>({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const originalUrl = URL.createObjectURL(file);

    setState({ status: "removing-bg", progress: 0 });

    try {
      const { removeBackground, subscribeToProgress } = await import("rembg-webgpu");

      const unsub = subscribeToProgress((state) => {
        const pct = Math.round(state.progress);
        setState((prev) =>
          prev.status === "removing-bg"
            ? { status: "removing-bg", progress: pct }
            : prev
        );
      });

      const result = await removeBackground(originalUrl);
      unsub();

      setState({ status: "done", original: originalUrl, cutout: result.blobUrl });
    } catch (err) {
      console.error("Processing failed:", err);
      URL.revokeObjectURL(originalUrl);
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong processing your image.",
      });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const reset = useCallback(() => {
    if (state.status === "done") {
      URL.revokeObjectURL(state.original);
      URL.revokeObjectURL(state.cutout);
    }
    setState({ status: "idle" });
  }, [state]);

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      {/* Header */}
      <div className={`w-full flex flex-col gap-2 mb-8 ${state.status === "done" ? "max-w-[1100px]" : "max-w-[660px]"}`}>
        <h1 className="font-sans font-semibold text-[28px] text-primary leading-tight">
          Sticker Maker
        </h1>
        {state.status !== "done" && (
          <p className="font-body text-[16px] text-secondary leading-relaxed">
            Drop an image to remove its background and turn it into a sticker
            with a clean outline. Everything runs in your browser.
          </p>
        )}
      </div>

      {/* Content */}
      {state.status === "idle" && (
        <div className="w-full max-w-[660px] animate-in">
          <DropZone
            dragOver={dragOver}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          />
        </div>
      )}

      {(state.status === "removing-bg" || state.status === "creating-sticker") && (
        <div className="w-full max-w-[660px] animate-in">
          <LoadingState state={state} />
        </div>
      )}

      {state.status === "error" && (
        <div className="w-full max-w-[660px] animate-in">
          <div className="flex flex-col items-center justify-center gap-5 rounded-[20px] border border-border bg-surface py-16 px-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-body font-medium text-[16px] text-primary">
                Processing failed
              </p>
              <p className="font-body text-[14px] text-secondary mt-1 max-w-[360px]">
                {state.message}
              </p>
            </div>
            <button
              onClick={reset}
              className="flex items-center justify-center h-[40px] px-6 rounded-[12px] bg-primary text-background font-body font-medium text-[15px] cursor-pointer hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {state.status === "done" && (
        <ResultView
          original={state.original}
          cutout={state.cutout}
          onReset={reset}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Attribution */}
      <footer className="mt-auto pt-16 pb-4">
        <span className="inline-flex items-center justify-center w-fit mx-auto">
          <span className="font-body text-[16px] text-secondary mr-1.5">
            Made by
          </span>
          <a
            href="https://kenemrls.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center"
          >
            <img
              src="/kenny.png"
              alt="Kenny Morales"
              className="w-5 h-5 rounded-full object-cover mr-1 grayscale group-hover:grayscale-0 transition-all duration-200"
            />
            <span className="font-body font-medium text-[16px] text-secondary group-hover:text-primary underline decoration-border underline-offset-2 transition-colors">
              Kenny Morales
            </span>
          </a>
        </span>
      </footer>
    </main>
  );
}

function DropZone({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-4
        rounded-[20px] border-2 border-dashed cursor-pointer
        py-20 px-6 transition-all duration-200
        ${
          dragOver
            ? "border-primary bg-border/50 scale-[1.01]"
            : "border-border hover:border-secondary/40 bg-surface"
        }
      `}
    >
      <div className="w-12 h-12 rounded-full bg-border flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-secondary"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div className="text-center">
        <p className="font-body font-medium text-[16px] text-primary">
          Drop an image here
        </p>
        <p className="font-body text-[14px] text-secondary mt-1">
          or click to browse
        </p>
      </div>
    </div>
  );
}

function LoadingState({ state }: { state: ProcessingState }) {
  const message =
    state.status === "removing-bg"
      ? "Removing background..."
      : "Adding sticker outline...";

  const progress = state.status === "removing-bg" ? (state as { progress: number }).progress : 100;

  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-[20px] border border-border bg-surface py-20 px-6">
      <div className="relative w-10 h-10">
        <svg className="animate-spin w-10 h-10" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
          />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="100.5"
            strokeDashoffset={100.5 - (100.5 * progress) / 100}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="font-body font-medium text-[16px] text-primary">
          {message}
        </p>
        <p className="font-body text-[14px] text-secondary mt-1">
          {state.status === "removing-bg"
            ? "The ML model may take a moment to load the first time"
            : "Almost there"}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * CONTROL: Slider row
 * Renders a labeled range slider with a value badge
 * ───────────────────────────────────────────────────────── */
function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="font-body text-[14px] text-secondary">{label}</label>
        <span className="font-body font-medium text-[13px] text-primary tabular-nums bg-border rounded-[8px] px-2 py-0.5">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5 rounded-full appearance-none bg-border cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  );
}


function FineTuneControls({
  settings,
  set,
}: {
  settings: StickerSettings;
  set: <K extends keyof StickerSettings>(key: K, value: StickerSettings[K]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 font-body text-[12px] text-secondary/50 hover:text-secondary cursor-pointer transition-colors w-fit"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="M3 1l4 4-4 4z" />
        </svg>
        Fine tune
      </button>

      {open && (
        <div className="flex flex-col gap-4 pt-1 animate-in">
          <SliderControl
            label="Intensity"
            value={settings.masterAmp}
            min={0}
            max={5}
            step={0.1}
            unit="x"
            onChange={(v) => set("masterAmp", v)}
          />

          <div className="flex flex-col gap-1">
            <p className="font-body text-[12px] text-secondary/70">sin</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <SliderControl label="Freq" value={settings.wave1.freq} min={0.5} max={20} step={0.5} unit="" onChange={(v) => set("wave1", { ...settings.wave1, freq: v })} />
              </div>
              <div className="flex-1">
                <SliderControl label="Amp" value={settings.wave1.amp} min={0} max={2} step={0.05} unit="" onChange={(v) => set("wave1", { ...settings.wave1, amp: v })} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-body text-[12px] text-secondary/70">cos</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <SliderControl label="Freq" value={settings.wave2.freq} min={0.5} max={20} step={0.5} unit="" onChange={(v) => set("wave2", { ...settings.wave2, freq: v })} />
              </div>
              <div className="flex-1">
                <SliderControl label="Amp" value={settings.wave2.amp} min={0} max={2} step={0.05} unit="" onChange={(v) => set("wave2", { ...settings.wave2, amp: v })} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-body text-[12px] text-secondary/70">sin (hi)</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <SliderControl label="Freq" value={settings.wave3.freq} min={0.5} max={30} step={0.5} unit="" onChange={(v) => set("wave3", { ...settings.wave3, freq: v })} />
              </div>
              <div className="flex-1">
                <SliderControl label="Amp" value={settings.wave3.amp} min={0} max={2} step={0.05} unit="" onChange={(v) => set("wave3", { ...settings.wave3, amp: v })} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({
  original,
  cutout,
  onReset,
}: {
  original: string;
  cutout: string;
  onReset: () => void;
}) {
  const [settings, setSettings] = useState<StickerSettings>(DEFAULT_SETTINGS);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Generate sticker whenever settings change
  useEffect(() => {
    let cancelled = false;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setRegenerating(true);
      try {
        const url = await addStickerOutline(cutout, settings);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setStickerUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        console.error("Failed to generate sticker:", err);
      }
      if (!cancelled) setRegenerating(false);
    }, 100);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [settings, cutout]);

  const handleDownload = useCallback(() => {
    if (!stickerUrl) return;
    const a = document.createElement("a");
    a.href = stickerUrl;
    a.download = "sticker.png";
    a.click();
  }, [stickerUrl]);

  const set = <K extends keyof StickerSettings>(key: K, value: StickerSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div className="w-full max-w-[1100px] flex gap-6 items-start animate-in">
      {/* Left — Controls */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4 sticky top-8">
        {/* Original thumbnail */}
        <div className="flex flex-col gap-2">
          <p className="font-body font-medium text-[14px] text-secondary">
            Original
          </p>
          <div className="rounded-[20px] border border-border overflow-hidden bg-border/30 aspect-video flex items-center justify-center">
            <img
              src={original}
              alt="Original"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>

        {/* Customize panel */}
        <div className="rounded-[20px] border border-border bg-surface p-5 flex flex-col gap-5">
          <p className="font-sans font-semibold text-[16px] text-primary">
            Customize
          </p>

          <SliderControl
            label="Outline thickness"
            value={settings.outlineWidth}
            min={0}
            max={20}
            step={1}
            unit="px"
            onChange={(v) => set("outlineWidth", v)}
          />

          {/* Outline Color */}
          <div className="flex flex-col gap-2.5">
            <label className="font-body text-[14px] text-secondary">
              Outline color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {OUTLINE_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => set("outlineColor", preset.color)}
                  className={`w-7 h-7 rounded-full cursor-pointer transition-all duration-150 ${
                    settings.outlineColor === preset.color
                      ? "ring-2 ring-primary ring-offset-2"
                      : "ring-1 ring-border hover:ring-secondary/40"
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.label}
                />
              ))}
              <div className="relative">
                <input
                  type="color"
                  value={settings.outlineColor}
                  onChange={(e) => set("outlineColor", e.target.value)}
                  className="absolute inset-0 w-7 h-7 opacity-0 cursor-pointer"
                />
                <div
                  className={`w-7 h-7 rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 ${
                    !OUTLINE_PRESETS.some((p) => p.color === settings.outlineColor)
                      ? "ring-2 ring-primary ring-offset-2"
                      : "ring-1 ring-border hover:ring-secondary/40"
                  }`}
                  style={
                    !OUTLINE_PRESETS.some((p) => p.color === settings.outlineColor)
                      ? { backgroundColor: settings.outlineColor }
                      : undefined
                  }
                >
                  {OUTLINE_PRESETS.some((p) => p.color === settings.outlineColor) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Outline Style */}
          <div className="flex flex-col gap-2.5">
            <label className="font-body text-[14px] text-secondary">
              Outline style
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OUTLINE_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    set("outlineStyle", s.value);
                    if (s.value !== "solid") {
                      const d = WAVE_DEFAULTS[s.value];
                      set("wave1", d.wave1);
                      set("wave2", d.wave2);
                      set("wave3", d.wave3);
                      set("masterAmp", d.masterAmp);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-[12px] font-body text-[13px] cursor-pointer transition-all duration-150 ${
                    settings.outlineStyle === s.value
                      ? "bg-primary text-background font-medium"
                      : "bg-border text-secondary hover:text-primary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {settings.outlineStyle !== "solid" && (
            <FineTuneControls settings={settings} set={set} />
          )}

          {/* Shadow Style */}
          <div className="flex flex-col gap-2.5">
            <label className="font-body text-[14px] text-secondary">
              Shadow
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SHADOW_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => set("shadowStyle", s.value)}
                  className={`px-3 py-1.5 rounded-[12px] font-body text-[13px] cursor-pointer transition-all duration-150 ${
                    settings.shadowStyle === s.value
                      ? "bg-primary text-background font-medium"
                      : "bg-border text-secondary hover:text-primary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={!stickerUrl}
            className="flex-1 flex items-center justify-center gap-2 h-[40px] px-5 rounded-[12px] bg-primary text-background font-body font-medium text-[15px] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PNG
          </button>
          <button
            onClick={onReset}
            className="flex items-center justify-center h-[40px] px-5 rounded-[12px] bg-border text-secondary font-body font-medium text-[15px] cursor-pointer hover:bg-border/70 transition-colors"
          >
            Start over
          </button>
        </div>
      </div>

      {/* Right — Large sticker preview */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <p className="font-body font-medium text-[14px] text-secondary">
          Sticker preview
          {regenerating && (
            <span className="ml-2 text-[12px] text-secondary/60">updating...</span>
          )}
        </p>
        <div className="rounded-[20px] border border-border overflow-hidden checkered flex items-center justify-center p-8 min-h-[500px]">
          {stickerUrl ? (
            <img
              src={stickerUrl}
              alt="Sticker"
              className={`max-w-full max-h-[600px] object-contain transition-all duration-200 ${regenerating ? "opacity-40" : "opacity-100"}`}
            />
          ) : (
            <div className="flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-secondary/40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="25 75" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Creates a sticker outline effect using canvas compositing.
 * Supports multiple outline styles and shadow presets.
 */
async function addStickerOutline(
  cutoutUrl: string,
  settings: StickerSettings
): Promise<string> {
  const { outlineWidth, outlineColor, outlineStyle, shadowStyle } = settings;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const effectiveWidth = outlineWidth;
      // For wave styles, the wobble can push the outline up to masterAmp * total wave amp beyond the base width
      const wobbleExtra = outlineStyle !== "solid"
        ? effectiveWidth * settings.masterAmp * (settings.wave1.amp + settings.wave2.amp + settings.wave3.amp)
        : 0;
      const outlinePad = Math.max(effectiveWidth + wobbleExtra + 4, 4);
      const shadowPad = shadowStyle !== "none" ? 30 : 0;

      const canvas = document.createElement("canvas");
      canvas.width = img.width + outlinePad * 2 + shadowPad;
      canvas.height = img.height + outlinePad * 2 + shadowPad;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const drawAt = (ox: number, oy: number) => {
        ctx.drawImage(img, cx - img.width / 2 + ox, cy - img.height / 2 + oy);
      };

      const steps = 72;

      // ── Outline styles ──

      if (outlineStyle === "solid" && effectiveWidth > 0) {
        // Dilation: draw at offsets, fill with color
        for (let i = 0; i < steps; i++) {
          const angle = (2 * Math.PI * i) / steps;
          drawAt(Math.cos(angle) * effectiveWidth, Math.sin(angle) * effectiveWidth);
        }
        for (let r = effectiveWidth - 1; r > 0; r -= 2) {
          for (let i = 0; i < steps; i++) {
            const angle = (2 * Math.PI * i) / steps;
            drawAt(Math.cos(angle) * r, Math.sin(angle) * r);
          }
        }
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = outlineColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
      }

      if (outlineStyle !== "solid" && effectiveWidth > 0) {
        // Wave-based outline: sin + cos + sin(hi), each with freq/amp
        const { wave1, wave2, wave3, masterAmp } = settings;

        const wobbleAt = (angle: number) =>
          (Math.sin(angle * wave1.freq) * wave1.amp +
           Math.cos(angle * wave2.freq) * wave2.amp +
           Math.sin(angle * wave3.freq + 1.5) * wave3.amp) * masterAmp;

        const roughSteps = 72;
        for (let i = 0; i < roughSteps; i++) {
          const angle = (2 * Math.PI * i) / roughSteps;
          const r = effectiveWidth * Math.max(0.05, 1 + wobbleAt(angle));
          drawAt(Math.cos(angle) * r, Math.sin(angle) * r);
        }

        for (let rad = effectiveWidth; rad > 0; rad -= 2) {
          const scale = rad / effectiveWidth;
          for (let i = 0; i < roughSteps; i++) {
            const angle = (2 * Math.PI * i) / roughSteps;
            const r = rad * Math.max(0.05, 1 + wobbleAt(angle) * scale);
            drawAt(Math.cos(angle) * r, Math.sin(angle) * r);
          }
        }

        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = outlineColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
      }

      // ── Shadow presets ──

      if (shadowStyle === "soft") {
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
      } else if (shadowStyle === "hard") {
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 5;
      } else if (shadowStyle === "float") {
        ctx.shadowColor = "rgba(0,0,0,0.18)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 12;
      }

      // Draw the original cutout on top
      drawAt(0, 0);
      ctx.shadowColor = "transparent";

      canvas.toBlob((blob) => {
        if (blob) resolve(URL.createObjectURL(blob));
        else reject(new Error("Failed to create blob"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = cutoutUrl;
  });
}
