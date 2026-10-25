// Minimal logger contract so shared code doesn't depend on a specific logger.
// pino loggers satisfy this interface.
export interface Logger {
  debug(obj: object | string, msg?: string): void;
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
}
