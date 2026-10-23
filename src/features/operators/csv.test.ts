import { expect, test } from "bun:test";
import { eventsCsv } from "./csv";

const labels = {
  sensor: "Sensor",
  sensorId: "ID del sensor",
  level: "Tipo",
  start: "Inicio",
  end: "Fin",
  durationMinutes: "Duración (min)",
  peakCm: "Nivel máximo (cm)",
  levels: { warning: "Alerta", critical: "Crítico", offline: "Sin señal" },
  ongoing: "En curso",
};

test("eventsCsv writes local times, durations and escapes names", () => {
  const csv = eventsCsv(
    [
      {
        deviceId: "dev_1",
        deviceName: 'Calle "6", Centro',
        level: "critical",
        startedAt: new Date("2026-10-04T15:00:00Z"),
        endedAt: new Date("2026-10-04T16:30:00Z"),
        peakCm: 31.26,
      },
      {
        deviceId: "dev_2",
        deviceName: "Dren",
        level: "offline",
        startedAt: new Date("2026-10-23T11:00:00Z"),
        endedAt: null,
        peakCm: null,
      },
    ],
    labels,
    { timeZone: "America/Matamoros", now: new Date("2026-10-23T12:00:00Z") },
  );
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.slice(1).split("\r\n")).toEqual([
    "Sensor,ID del sensor,Tipo,Inicio,Fin,Duración (min),Nivel máximo (cm)",
    '"Calle ""6"", Centro",dev_1,Crítico,2026-10-04 10:00,2026-10-04 11:30,90,31.3',
    "Dren,dev_2,Sin señal,2026-10-23 06:00,En curso,60,",
    "",
  ]);
});
