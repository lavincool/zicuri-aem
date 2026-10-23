/** Expected failures that route handlers map to HTTP responses. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string = code,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
