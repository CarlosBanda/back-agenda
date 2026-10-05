import {
  normalizeEmail,
  normalizePhone,
  parseCsv,
  parseTagList,
} from './csv.util';

describe('csv util', () => {
  it('parses quoted fields, escaped quotes and CRLF endings', () => {
    const rows = parseCsv(
      'name,phone,notes\r\n"Doe, Jane",5551234567,"Said ""hi"""\r\nJohn,5559876543,ok\r\n',
    );
    expect(rows).toEqual([
      ['name', 'phone', 'notes'],
      ['Doe, Jane', '5551234567', 'Said "hi"'],
      ['John', '5559876543', 'ok'],
    ]);
  });

  it('flushes a trailing record without newline and drops blank lines', () => {
    const rows = parseCsv('a,b\n\nc,d');
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('normalizes Mexican phone numbers by dropping the country code', () => {
    expect(normalizePhone('+52 55 1234 5678')).toBe('5512345678');
    expect(normalizePhone('521 55 1234 5678')).toBe('5512345678');
    expect(normalizePhone('(55) 1234-5678')).toBe('5512345678');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it('normalizes emails to trimmed lowercase', () => {
    expect(normalizeEmail('  Persona@Example.COM ')).toBe(
      'persona@example.com',
    );
    expect(normalizeEmail('')).toBeNull();
  });

  it('splits tag lists on ; and |', () => {
    expect(parseTagList('vip; recurrente | nuevo')).toEqual([
      'vip',
      'recurrente',
      'nuevo',
    ]);
    expect(parseTagList('')).toEqual([]);
  });
});
