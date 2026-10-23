import { NextResponse } from "next/server";
import type { z } from "zod";

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
) {
  return NextResponse.json<ApiError>(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status, headers },
  );
}

export function zodDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
