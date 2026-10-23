import type { CreatedReport, UploadTicket } from "../schema";
import { ApiRequestError } from "./api";

/** PUT with upload progress (fetch has no upload progress events). */
function putWithProgress(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new ApiRequestError(xhr.status, "UPLOAD_FAILED", xhr.statusText),
          );
    xhr.onerror = () =>
      reject(new ApiRequestError(0, "NETWORK", "Network error"));
    xhr.send(body);
  });
}

const RETRY_DELAYS_MS = [1000, 3000, 9000];

/** Retries transient failures (network, 5xx) with backoff; client errors fail fast. */
export async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await task();
    } catch (error) {
      const status = error instanceof ApiRequestError ? error.status : 0;
      const retryable = status === 0 || status >= 500 || status === 429;
      const delay = RETRY_DELAYS_MS[attempt];
      if (!retryable || delay === undefined) throw error;
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "Network error");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiRequestError(
      response.status,
      data?.error?.code ?? "HTTP_ERROR",
      data?.error?.message ?? response.statusText,
    );
  }
  return (await response.json()) as T;
}

export type PhotoPayload = {
  full: Blob;
  thumb: Blob;
  contentType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
};

/** Gets presigned URLs, then uploads photo and thumbnail straight to storage. */
export async function uploadPhoto(
  photo: PhotoPayload,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const ticket = await withRetry(() =>
    postJson<UploadTicket>("/api/uploads", {
      contentType: photo.contentType,
      bytes: photo.full.size,
      thumbBytes: photo.thumb.size,
      width: photo.width,
      height: photo.height,
    }),
  );
  const total = photo.full.size + photo.thumb.size;
  let thumbLoaded = 0;
  let fullLoaded = 0;
  const report = () =>
    onProgress(Math.min(1, (thumbLoaded + fullLoaded) / total));
  await withRetry(() =>
    putWithProgress(
      ticket.thumb.url,
      photo.thumb,
      ticket.thumb.headers,
      (n) => {
        thumbLoaded = n;
        report();
      },
    ),
  );
  await withRetry(() =>
    putWithProgress(ticket.full.url, photo.full, ticket.full.headers, (n) => {
      fullLoaded = n;
      report();
    }),
  );
  onProgress(1);
  return ticket.uploadId;
}

export type ReportDraft = {
  clientRequestId: string;
  category: string;
  severityDetail: string | null;
  waterDepthCm: number | null;
  note: string | null;
  location: {
    lat: number;
    lng: number;
    accuracyM: number | null;
    source: "gps" | "exif" | "manual";
  };
  photo: { width: number; height: number; color: string | null };
};

export function submitReport(
  draft: ReportDraft,
  uploadId: string,
): Promise<CreatedReport> {
  return withRetry(() =>
    postJson<CreatedReport>("/api/reports", { ...draft, uploadId }),
  );
}
