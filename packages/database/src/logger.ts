function generateIncidentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ERR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `ERR-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'anonkey',
  'servicekey',
  'authorization',
  'cookie',
]);

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return '[REDACTED]';
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map((v) =>
        typeof v === 'object' && v !== null ? sanitizeObject(v as Record<string, unknown>) : v
      );
    }
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = sanitizeValue(k, v);
  }
  return result;
}

export interface OperationalLogger {
  info: (event: string, meta?: Record<string, unknown>) => void;
  warn: (event: string, meta?: Record<string, unknown>) => void;
  error: (event: string, err?: unknown, meta?: Record<string, unknown>) => string;
}

export function createOperationalLogger(component: string): OperationalLogger {
  return {
    info(event: string, meta?: Record<string, unknown>) {
      const sanitizedMeta = meta ? sanitizeObject(meta) : undefined;
      console.info(
        JSON.stringify({
          level: 'INFO',
          timestamp: new Date().toISOString(),
          component,
          event,
          ...sanitizedMeta,
        })
      );
    },
    warn(event: string, meta?: Record<string, unknown>) {
      const sanitizedMeta = meta ? sanitizeObject(meta) : undefined;
      console.warn(
        JSON.stringify({
          level: 'WARN',
          timestamp: new Date().toISOString(),
          component,
          event,
          ...sanitizedMeta,
        })
      );
    },
    error(event: string, err?: unknown, meta?: Record<string, unknown>): string {
      const incidentId = generateIncidentId();
      const errorMessage = err instanceof Error ? err.message : String(err || 'Unknown error');
      const sanitizedMeta = meta ? sanitizeObject(meta) : undefined;

      console.error(
        JSON.stringify({
          level: 'ERROR',
          incidentId,
          timestamp: new Date().toISOString(),
          component,
          event,
          error: errorMessage,
          ...sanitizedMeta,
        })
      );

      return incidentId;
    },
  };
}
