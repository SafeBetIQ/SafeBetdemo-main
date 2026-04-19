export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  level: LogLevel;
  message: string;
  service: string;
  timestamp: string;
  requestId?: string;
  casinoId?: string;
  playerId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, service: string, message: string, meta: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    level,
    message,
    service,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  // CloudWatch Logs ingests stdout as structured JSON when the Lambda runtime
  // is configured with JSON logging. console.log is the correct transport here.
  console.log(JSON.stringify(entry));
}

export function createLogger(service: string, requestId?: string) {
  const base = requestId ? { requestId } : {};

  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      emit('DEBUG', service, message, { ...base, ...meta }),

    info: (message: string, meta?: Record<string, unknown>) =>
      emit('INFO', service, message, { ...base, ...meta }),

    warn: (message: string, meta?: Record<string, unknown>) =>
      emit('WARN', service, message, { ...base, ...meta }),

    error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
      const errMeta =
        error instanceof Error
          ? { errorMessage: error.message, stack: error.stack }
          : { rawError: String(error) };
      emit('ERROR', service, message, { ...base, ...errMeta, ...meta });
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
