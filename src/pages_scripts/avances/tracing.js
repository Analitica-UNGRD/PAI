const TRACE_STORAGE_KEY = 'pai_avances_trace_log';

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '"[unserializable]"';
  }
}

export function recordAvanceTrace(eventType, details = {}) {
  const entry = {
    eventType,
    timestamp: new Date().toISOString(),
    details
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const current = window.localStorage.getItem(TRACE_STORAGE_KEY);
      const parsed = current ? JSON.parse(current) : [];
      parsed.unshift(entry);
      window.localStorage.setItem(TRACE_STORAGE_KEY, safeStringify(parsed.slice(0, 50)));
    } catch (error) {
      console.warn('[WARN] No fue posible persistir la traza local de avances:', error);
    }
  }

  console.info('[TRACE][Avances]', entry);
  return entry;
}

export function readLocalAvanceTrace() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const stored = window.localStorage.getItem(TRACE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('[WARN] No fue posible leer la traza local de avances:', error);
    return [];
  }
}
