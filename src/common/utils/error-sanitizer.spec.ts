import { pathWithoutQuery, sanitizeErrorMessage } from './error-sanitizer';

describe('error sanitizer', () => {
  it('redacts tokens and secrets without retaining stack-like newlines', () => {
    const sanitized = sanitizeErrorMessage(
      new Error(
        'Stripe failed token=very-secret-value\nBearer abc.def.ghi sk_test_123456',
      ),
    );

    expect(sanitized).not.toContain('very-secret-value');
    expect(sanitized).not.toContain('abc.def.ghi');
    expect(sanitized).not.toContain('sk_test_123456');
    expect(sanitized).not.toContain('\n');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('redacts email addresses and phone numbers', () => {
    const sanitized = sanitizeErrorMessage(
      'Customer persona@example.com failed for +52 55 1234 5678',
    );

    expect(sanitized).not.toContain('persona@example.com');
    expect(sanitized).not.toContain('+52 55 1234 5678');
    expect(sanitized.match(/\[REDACTED\]/g)).toHaveLength(2);
  });
  it('caps messages and strips query strings from paths', () => {
    expect(sanitizeErrorMessage('x'.repeat(1200))).toHaveLength(1000);
    expect(pathWithoutQuery('/support/admin/errors?unresolved=true')).toBe(
      '/support/admin/errors',
    );
  });
});
