/**
 * Minimal RFC-4180-ish CSV parser (no external dependency).
 * Supports quoted fields, escaped double quotes ("") and CR/LF line endings.
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let sawAny = false;

  const pushField = (): void => {
    record.push(field);
    field = '';
  };
  const pushRecord = (): void => {
    pushField();
    rows.push(record);
    record = [];
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    sawAny = true;
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\r') {
      // handled together with \n; ignore standalone CR
      if (content[i + 1] === '\n') i++;
      pushRecord();
    } else if (char === '\n') {
      pushRecord();
    } else {
      field += char;
    }
  }
  // Flush trailing field/record if the file did not end with a newline.
  if (field.length > 0 || record.length > 0 || (sawAny && rows.length === 0)) {
    pushRecord();
  }
  // Drop fully empty records (e.g. trailing blank line).
  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

export function normalizeEmail(
  value: string | undefined | null,
): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

/**
 * Normalizes a Mexican phone number to digits only, dropping a leading country
 * code (52 / 521) so that dedup is stable regardless of input formatting.
 */
export function normalizePhone(
  value: string | undefined | null,
): string | null {
  if (!value) return null;
  let digits = value.replace(/[^\d]/g, '');
  if (digits === '') return null;
  if (digits.length === 13 && digits.startsWith('521')) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('52')) {
    digits = digits.slice(2);
  }
  return digits;
}

export function parseTagList(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[;|]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}
