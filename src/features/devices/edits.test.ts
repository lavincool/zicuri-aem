import { describe, expect, test } from "bun:test";
import {
  auditActionFor,
  type DeviceUpdate,
  deviceUpdateSchema,
  diffDevice,
  invalidFields,
  nextDeviceValues,
  thresholdsChanged,
} from "./edits";

const input: DeviceUpdate = {
  name: "Buenavista · Calle 1",
  siteType: "street_drain",
  status: "active",
  visibility: "public",
  lat: 25.8231,
  lng: -97.5612,
  mountHeightCm: 120,
  warningCm: 10,
  criticalCm: 25,
  reportingIntervalS: 300,
};

describe("deviceUpdateSchema", () => {
  test("accepts a valid edit and trims the name", () => {
    const parsed = deviceUpdateSchema.parse({ ...input, name: "  Calle 1  " });
    expect(parsed.name).toBe("Calle 1");
  });

  test("critical must be above warning", () => {
    const result = deviceUpdateSchema.safeParse({ ...input, criticalCm: 10 });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(invalidFields(result.error)).toEqual(["criticalCm"]);
  });

  test("the sensor must stay in the pilot area", () => {
    const result = deviceUpdateSchema.safeParse({
      ...input,
      lat: 19.43,
      lng: -99.13,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(invalidFields(result.error)).toEqual(["location"]);
  });

  test("operators cannot set a sensor back to pending", () => {
    expect(
      deviceUpdateSchema.safeParse({ ...input, status: "pending" }).success,
    ).toBe(false);
  });
});

describe("nextDeviceValues", () => {
  test("a pending sensor stays pending until its first reading", () => {
    const pending = { ...input, status: "pending" as const };
    expect(nextDeviceValues(pending, input).status).toBe("pending");
    expect(
      nextDeviceValues(pending, { ...input, status: "maintenance" }).status,
    ).toBe("maintenance");
  });
});

describe("diffDevice and auditActionFor", () => {
  test("an unchanged form records nothing", () => {
    expect(diffDevice(input, input)).toEqual({});
  });

  test("single-purpose edits get their own action", () => {
    const status = diffDevice(input, { ...input, status: "maintenance" });
    expect(status).toEqual({ status: { from: "active", to: "maintenance" } });
    expect(auditActionFor(status)).toBe("status_change");

    const visibility = diffDevice(input, { ...input, visibility: "private" });
    expect(auditActionFor(visibility)).toBe("visibility_change");
  });

  test("mixed edits are a plain update", () => {
    const changes = diffDevice(input, {
      ...input,
      visibility: "private",
      criticalCm: 30,
    });
    expect(auditActionFor(changes)).toBe("update");
    expect(thresholdsChanged(changes)).toBe(true);
    expect(
      thresholdsChanged(diffDevice(input, { ...input, name: "Otro" })),
    ).toBe(false);
  });
});
