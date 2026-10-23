import { customAlphabet } from "nanoid";

/** No 0/O/1/l/i: easy to read aloud and type from a share link. */
const READABLE = "23456789abcdefghjkmnpqrstuvwxyz";

export const reportId = customAlphabet(READABLE, 10);

const opaque = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  16,
);

/** Prefixed IDs such as `upl_…`, `dev_…`, `sig_…`. */
export function prefixedId(prefix: string): string {
  return `${prefix}_${opaque()}`;
}
