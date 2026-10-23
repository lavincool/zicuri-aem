import { createStore, del, get, keys, set } from "idb-keyval";
import type { CreatedReport } from "../schema";
import { ApiRequestError } from "./api";
import {
  type PhotoPayload,
  type ReportDraft,
  submitReport,
  uploadPhoto,
} from "./upload";

/**
 * Reports waiting for a connection. Each entry keeps the compressed photo so it can
 * be uploaded later; `clientRequestId` makes replays idempotent on the server.
 */
export type OutboxEntry = {
  draft: ReportDraft;
  photo: PhotoPayload;
  uploadId: string | null;
  queuedAt: number;
};

let store: ReturnType<typeof createStore> | null = null;
function outboxStore() {
  store ??= createStore("cauce-outbox", "reports");
  return store;
}

export async function enqueueReport(entry: OutboxEntry): Promise<void> {
  await set(entry.draft.clientRequestId, entry, outboxStore());
}

export async function outboxSize(): Promise<number> {
  try {
    return (await keys(outboxStore())).length;
  } catch {
    return 0;
  }
}

export type FlushResult = {
  sent: CreatedReport[];
  failed: { draft: ReportDraft; code: string }[];
};

let flushing: Promise<FlushResult> | null = null;

/** Sends every queued report. Network failures stay queued; rejected ones are dropped. */
export function flushOutbox(): Promise<FlushResult> {
  flushing ??= (async () => {
    const result: FlushResult = { sent: [], failed: [] };
    let ids: IDBValidKey[] = [];
    try {
      ids = await keys(outboxStore());
    } catch {
      return result;
    }
    for (const id of ids) {
      const entry = await get<OutboxEntry>(id, outboxStore());
      if (!entry) continue;
      try {
        let uploadId = entry.uploadId;
        if (!uploadId) {
          uploadId = await uploadPhoto(entry.photo, () => {});
          await set(id, { ...entry, uploadId }, outboxStore());
        }
        result.sent.push(await submitReport(entry.draft, uploadId));
        await del(id, outboxStore());
      } catch (error) {
        const status = error instanceof ApiRequestError ? error.status : 0;
        if (status === 0 || status >= 500 || status === 429) break; // still offline: retry later
        // A failed human check is not the report's fault; try again next time.
        if (
          error instanceof ApiRequestError &&
          error.code === "VERIFICATION_FAILED"
        ) {
          break;
        }
        // Expired upload: retry once with a fresh one next time.
        if (
          error instanceof ApiRequestError &&
          error.code === "UPLOAD_NOT_FOUND"
        ) {
          await set(id, { ...entry, uploadId: null }, outboxStore());
          continue;
        }
        result.failed.push({
          draft: entry.draft,
          code: error instanceof ApiRequestError ? error.code : "UNKNOWN",
        });
        await del(id, outboxStore());
      }
    }
    return result;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
