export type Place = {
  colonia: string | null;
  municipality: string | null;
  state: string | null;
};

/**
 * Short place name for a report: "Colonia, Municipio", else "Municipio, Estado".
 * Null when reverse geocoding found nothing; callers fall back to a generic label.
 */
export function placeLabel({
  colonia,
  municipality,
  state,
}: Place): string | null {
  if (colonia) {
    return municipality && municipality !== colonia
      ? `${colonia}, ${municipality}`
      : colonia;
  }
  if (municipality) {
    return state && state !== municipality
      ? `${municipality}, ${state}`
      : municipality;
  }
  return state;
}
