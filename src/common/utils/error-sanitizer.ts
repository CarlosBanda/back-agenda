const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:sk|rk|pk|whsec)_(?:live|test)?_?[A-Za-z0-9]+\b/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:token|authorization|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /(?:\+?\d[\d\s().-]{7,}\d)/g,
];

export function sanitizeErrorMessage(value: unknown, maxLength = 1000): string {
  let message: string;
  if (value instanceof Error) message = value.message;
  else if (typeof value === 'string') message = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    message = String(value);
  else message = 'Unknown error';
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, '[REDACTED]');
  }
  message = message.replace(/[\r\n\t]+/g, ' ').trim();
  return (message || 'Unknown error').slice(0, maxLength);
}

export function pathWithoutQuery(url: string | undefined): string {
  return (url?.split('?')[0] || '/').slice(0, 500);
}
