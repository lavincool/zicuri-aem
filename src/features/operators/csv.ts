/**
 * Pure CSV export of fleet events (RFC 4180, with a BOM so Excel opens accents
 * correctly). Times are local to the pilot city. No I/O; unit-tested.
 */

export type CsvEvent = {
  deviceId: string;
  deviceName: string;
  level: string;
  startedAt: Date;
  endedAt: Date | null;
  peakCm: number | null;
};

export type CsvLabels = {
  sensor: string;
  sensorId: string;
  level: string;
  start: string;
  end: string;
  durationMinutes: string;
  peakCm: string;
  levels: Record<string, string>;
  ongoing: string;
};

function cell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function eventsCsv(
  events: CsvEvent[],
  labels: CsvLabels,
  options: { timeZone: string; now: Date },
): string {
  // "sv-SE" formats as YYYY-MM-DD HH:mm, which spreadsheets parse as a date.
  const time = new Intl.DateTimeFormat("sv-SE", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const header = [
    labels.sensor,
    labels.sensorId,
    labels.level,
    labels.start,
    labels.end,
    labels.durationMinutes,
    labels.peakCm,
  ];
  const rows = events.map((event) => [
    event.deviceName,
    event.deviceId,
    labels.levels[event.level] ?? event.level,
    time.format(event.startedAt),
    event.endedAt ? time.format(event.endedAt) : labels.ongoing,
    Math.round(
      ((event.endedAt ?? options.now).getTime() - event.startedAt.getTime()) /
        60_000,
    ),
    event.peakCm === null ? null : Number(event.peakCm.toFixed(1)),
  ]);
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
