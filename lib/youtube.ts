import ytdl from "ytdl-core";

export const YOUTUBE_REQUEST_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Upgrade-Insecure-Requests": "1",
  Referer: "https://www.youtube.com/",
} as const;

export type NormalisedYoutubeUrl = {
  canonicalUrl: string;
  videoId: string;
};

export function canonicaliseYoutubeUrl(rawUrl: string): NormalisedYoutubeUrl | null {
  try {
    const videoId = ytdl.getURLVideoID(rawUrl);
    return {
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
    };
  } catch {
    return null;
  }
}

export type YtdlError = Error & { statusCode?: number };

export function mapYtdlError(error: unknown): { status: number; message: string } {
  if (!(error instanceof Error)) {
    return {
      status: 502,
      message: "We could not reach YouTube right now. Please try again shortly.",
    };
  }

  const typedError = error as YtdlError;
  const statusCode = typedError.statusCode ?? 0;
  const message = typedError.message ?? "";

  if (statusCode === 404 || /not (?:find|available)/i.test(message)) {
    return {
      status: 404,
      message: "We couldn't find that video. Double-check the link and try again.",
    };
  }

  if (statusCode === 403 || /private|sign in|age-restricted/i.test(message)) {
    return {
      status: 403,
      message: "This video is private or age-restricted and can't be downloaded.",
    };
  }

  return {
    status: 502,
    message: "YouTube temporarily blocked our request. Give it another try soon.",
  };
}

export function createYtdlRequestOptions(): ytdl.downloadOptions {
  return {
    requestOptions: {
      headers: { ...YOUTUBE_REQUEST_HEADERS },
    },
    lang: "en",
  };
}
