import type { ApiError } from "@/lib/http";
import type { SignalKind } from "../rules";
import type { FlagReason, ReportDetail } from "../schema";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      body?.error.code ?? "HTTP_ERROR",
      body?.error.message ?? response.statusText,
    );
  }
  return (await response.json()) as T;
}

export function fetchReport(id: string, signal?: AbortSignal) {
  return request<ReportDetail>(`/api/reports/${id}`, { signal });
}

export type SignalResponse = {
  status: "open" | "resolved";
  stillThereCount: number;
  fixedCount: number;
  mySignal: SignalKind;
  statusChanged: boolean;
};

export function postSignal(id: string, kind: SignalKind) {
  return request<SignalResponse>(`/api/reports/${id}/signals`, {
    method: "POST",
    body: JSON.stringify({ kind }),
  });
}

export function postFlag(id: string, reason: FlagReason) {
  return request<{ hidden: boolean }>(`/api/reports/${id}/flags`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
