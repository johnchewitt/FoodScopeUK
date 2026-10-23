export type DataErrorKind = "network" | "timeout" | "http" | "parse" | "validation" | "not_found";

/** Typed data-loading error with a plain-English cause for the UI (SH-05). */
export class DataLoadError extends Error {
  readonly kind: DataErrorKind;
  readonly resource: string;
  readonly details: string[];

  constructor(kind: DataErrorKind, resource: string, message: string, details: string[] = []) {
    super(message);
    this.name = "DataLoadError";
    this.kind = kind;
    this.resource = resource;
    this.details = details;
  }
}

export function describeDataError(error: unknown): string {
  if (error instanceof DataLoadError) {
    switch (error.kind) {
      case "timeout":
        return `${error.resource} took too long to load. Check your connection and try again.`;
      case "network":
        return `${error.resource} could not be reached. Check your connection and try again.`;
      case "http":
        return `${error.resource} returned an error (${error.message}).`;
      case "parse":
        return `${error.resource} is not valid JSON.`;
      case "validation":
        return `${error.resource} does not match its published schema, so it was not used.`;
      case "not_found":
        return `${error.resource} is not listed in the data manifest.`;
    }
  }
  return error instanceof Error ? error.message : "Unknown error.";
}
