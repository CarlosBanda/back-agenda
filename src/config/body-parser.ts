import type { NestExpressApplication } from '@nestjs/platform-express';

export const API_BODY_LIMIT = '2mb';

/**
 * Registers parsers explicitly so JSON imports up to 1 MB fit after JSON
 * encoding while preserving req.rawBody for signed webhooks.
 */
export function configureBodyParsers(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: API_BODY_LIMIT });
  app.useBodyParser('urlencoded', {
    extended: true,
    limit: API_BODY_LIMIT,
  });
}
