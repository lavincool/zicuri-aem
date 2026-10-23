import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { type Device, devices } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { hashDeviceKey } from "./keys";

/** Resolves `Authorization: Bearer cdk_…` to an active device. */
export async function authenticateDevice(request: Request): Promise<Device> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(cdk_[A-Za-z0-9_-]{20,})$/.exec(header.trim());
  if (!match?.[1]) {
    throw new DomainError(
      "INVALID_KEY",
      401,
      "Missing or malformed device key",
    );
  }
  const [device] = await db()
    .select()
    .from(devices)
    .where(eq(devices.apiKeyHash, hashDeviceKey(match[1])))
    .limit(1);
  if (!device) throw new DomainError("INVALID_KEY", 401, "Unknown device key");
  if (device.status === "retired" || device.status === "maintenance") {
    throw new DomainError("DEVICE_INACTIVE", 403, "Device is not active");
  }
  return device;
}
