"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type FormatType = "video+audio" | "video-only" | "audio-only";

type VideoFormat = {
  itag: number;
  qualityLabel: string;
  container: string;
  mimeType: string;
  codecs: string;
  type: FormatType;
  hasAudio: boolean;
  hasVideo: boolean;
  fps: number | null;
  bitrate: number | null;
  audioBitrate: number | null;
  audioSampleRate: number | null;
  sizeBytes: number | null;
};

type VideoDetails = {
  title: string;
  author: string;
  lengthSeconds: number | null;
  thumbnailUrl: string;
};

type StatusState =
  | { type: "idle" }
  | { type: "loading"; message: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const typeLabels: Record<FormatType, string> = {
  "video+audio": "Video & audio",
  "video-only": "Video only",
  "audio-only": "Audio only",
};

type FilterValue = "all" | FormatType;

const filterLabels: Record<FilterValue, string> = {
  all: "All formats",
  "video+audio": "Video & audio",
  "video-only": "Video only",
  "audio-only": "Audio only",
};

const filterOrder: FilterValue[] = ["video+audio", "video-only", "audio-only", "all"];

function sortFormatsForDisplay(formats: VideoFormat[]): VideoFormat[] {
  if (formats.length === 0) {
    return [];
  }

  const typeRank: Record<FormatType, number> = {
    "video+audio": 0,
    "video-only": 1,
    "audio-only": 2,
  };

  const resolutionFromLabel = (label: string): number => {
    const match = label.match(/(\d{3,4})p/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const bitrateScore = (bitrate: number | null): number => bitrate ?? 0;

  return [...formats].sort((a, b) => {
    const typeDifference = typeRank[a.type] - typeRank[b.type];
    if (typeDifference !== 0) {
      return typeDifference;
    }

    const resolutionDifference = resolutionFromLabel(b.qualityLabel) - resolutionFromLabel(a.qualityLabel);
    if (resolutionDifference !== 0) {
      return resolutionDifference;
    }

    const fpsDifference = (b.fps ?? 0) - (a.fps ?? 0);
    if (fpsDifference !== 0) {
      return fpsDifference;
    }

    return bitrateScore(b.bitrate) - bitrateScore(a.bitrate);
  });
}

function choosePreferredItag(formats: VideoFormat[]): number | null {
  const sorted = sortFormatsForDisplay(formats);
  if (sorted.length === 0) {
    return null;
  }

  const bestWithAudio = sorted.find((format) => format.type === "video+audio");
  return bestWithAudio?.itag ?? sorted[0].itag;
}

function formatFileSize(size: number | null): string {
  if (!size || Number.isNaN(size)) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let fileSize = size;

  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024;
    index += 1;
  }

  return `${fileSize.toFixed(fileSize < 10 ? 1 : 0)} ${units[index]}`;
}

function formatDuration(lengthSeconds: number | null): string {
  if (!lengthSeconds || Number.isNaN(lengthSeconds)) {
    return "Unknown duration";
  }

  const hours = Math.floor(lengthSeconds / 3600);
  const minutes = Math.floor((lengthSeconds % 3600) / 60);
  const seconds = Math.floor(lengthSeconds % 60);

  const paddedMinutes = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [details, setDetails] = useState<VideoDetails | null>(null);
  const [formats, setFormats] = useState<VideoFormat[]>([]);
  const [selectedItag, setSelectedItag] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("video+audio");

  const sortedFormats = useMemo(() => sortFormatsForDisplay(formats), [formats]);
  const preferredItag = useMemo(() => choosePreferredItag(formats), [formats]);
  const filteredFormats = useMemo(() => {
    if (activeFilter === "all") {
      return sortedFormats;
    }

    return sortedFormats.filter((format) => format.type === activeFilter);
  }, [sortedFormats, activeFilter]);

  useEffect(() => {
    if (filteredFormats.length === 0) {
      setSelectedItag((current) => (current === null ? current : null));
      return;
    }

    const isSelectedStillVisible = filteredFormats.some((format) => format.itag === selectedItag);
    if (!isSelectedStillVisible) {
      setSelectedItag(filteredFormats[0]?.itag ?? null);
    }
  }, [filteredFormats, selectedItag]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setStatus({ type: "error", message: "Paste a YouTube URL to continue." });
      return;
    }

    setStatus({ type: "loading", message: "Fetching available resolutions..." });
    setDetails(null);
    setFormats([]);
    setSelectedItag(null);
    setActiveFilter("video+audio");

    try {
      const response = await fetch("/api/formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load this video. Try a different link.");
      }

      const nextDetails = payload.details as VideoDetails;
      const nextFormats = (payload.formats as VideoFormat[]) ?? [];

      setDetails(nextDetails);
      setFormats(nextFormats);
      const bestItag = choosePreferredItag(nextFormats);
      setSelectedItag(bestItag);
      const bestFormat = nextFormats.find((format) => format.itag === bestItag);
      setActiveFilter(bestFormat?.type ?? "all");
      setStatus({
        type: "success",
        message: `Found ${payload.formats?.length ?? 0} downloadable format${
          (payload.formats?.length ?? 0) === 1 ? "" : "s"
        }. Choose the one that fits your needs.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again shortly.";
      setStatus({ type: "error", message });
    }
  };

  const handleDownload = () => {
    if (!url || !selectedItag || isDownloading) {
      return;
    }

    const params = new URLSearchParams({
      url: url.trim(),
      itag: String(selectedItag),
    });

    setIsDownloading(true);
    setStatus({ type: "success", message: "Preparing your download..." });

    const anchor = document.createElement("a");
    anchor.href = `/api/download?${params.toString()}`;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      setIsDownloading(false);
      setStatus({ type: "success", message: "Your download has started in a new tab or window." });
    }, 1500);
  };

  return (
    <div className="card">
      <header className="card-header">
        <h1>Download YouTube videos on any device</h1>
        <p>
          Paste a YouTube link to preview thumbnails, durations, and every available resolution. Works great on
          phones, tablets, and desktops.
        </p>
      </header>

      <section className="search-section">
        <form className="search-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            aria-label="YouTube video URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            autoComplete="off"
          />
          <button className="primary" type="submit" disabled={status.type === "loading"}>
            {status.type === "loading" ? "Loading..." : "Fetch video"}
          </button>
        </form>
        {status.type !== "idle" && (
          <div className={`status ${status.type === "error" ? "error" : status.type === "success" ? "success" : ""}`}>
            <strong>{status.type === "loading" ? "Hang tight" : status.type === "error" ? "Error" : "Ready"}</strong>
            <span>{status.message}</span>
          </div>
        )}
      </section>

      {details && (
        <section className="video-details" aria-live="polite">
          <img src={details.thumbnailUrl} alt={details.title} width={160} height={90} loading="lazy" />
          <div className="video-meta">
            <h2>{details.title}</h2>
            <span>by {details.author}</span>
            <span>Duration: {formatDuration(details.lengthSeconds)}</span>
          </div>
        </section>
      )}

      {sortedFormats.length > 0 && (
        <section className="format-list" aria-label="Available download formats">
          <div className="filter-controls" role="tablist" aria-label="Filter formats by type">
            {filterOrder.map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`filter-pill${isActive ? " active" : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filterLabels[filter]}
                </button>
              );
            })}
          </div>

          {filteredFormats.length === 0 ? (
            <p className="empty-formats">No formats match this filter. Try another option.</p>
          ) : null}

          {filteredFormats.map((format) => {
            const isSelected = selectedItag === format.itag;
            const displayLabel = format.qualityLabel || format.mimeType || `Format ${format.itag}`;
            const codecTokens = format.codecs
              ? format.codecs.split(",").map((token) => token.trim()).filter(Boolean)
              : [];

            return (
              <div
                key={format.itag}
                className={`format-item${isSelected ? " selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedItag(format.itag)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedItag(format.itag);
                  }
                }}
              >
                <strong>{displayLabel}</strong>
                <div className="format-meta">
                  <span>{typeLabels[format.type]}</span>
                  {format.fps ? <span>{format.fps} fps</span> : null}
                  {format.bitrate ? <span>{Math.round(format.bitrate / 1000)} kbps video</span> : null}
                  {format.audioBitrate ? <span>{format.audioBitrate} kbps audio</span> : null}
                  {format.audioSampleRate
                    ? <span>{(format.audioSampleRate / 1000).toFixed(1)} kHz</span>
                    : null}
                  {format.container ? <span>{format.container.toUpperCase()}</span> : null}
                  {codecTokens.length > 0 ? <span>{codecTokens.join(" + ")}</span> : null}
                  <span>{format.sizeBytes ? formatFileSize(format.sizeBytes) : "Size varies"}</span>
                </div>
              </div>
            );
          })}
          <div className="format-actions">
            <button
              type="button"
              className="primary"
              onClick={handleDownload}
              disabled={!selectedItag || isDownloading}
            >
              {isDownloading ? "Starting download..." : "Download selected format"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSelectedItag(preferredItag)}
              disabled={preferredItag === null || selectedItag === preferredItag}
            >
              Use best quality
            </button>
          </div>
        </section>
      )}

      <section className="notice">
        Downloads use YouTube&apos;s publicly available streams. Selecting a format with both video and audio is best
        for quick downloads. Some 4K or higher options may be video-only—download audio separately if needed and merge
        with your favorite editor.
      </section>
    </div>
  );
}
