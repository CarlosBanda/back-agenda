type Environment = Record<string, unknown>;

function required(env: Environment, key: string): string {
  const value = env[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalString(
  env: Environment,
  key: string,
  fallback: string,
): string {
  const value = env[key];
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function positiveInteger(
  env: Environment,
  key: string,
  fallback?: number,
): number {
  const raw = env[key];
  if ((raw === undefined || raw === '') && fallback !== undefined)
    return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
}

function booleanString(
  env: Environment,
  key: string,
  fallback: 'true' | 'false',
): string {
  const value = optionalString(env, key, fallback).toLowerCase();
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${key} must be either true or false`);
  }
  return value;
}

function validUrl(value: string, key: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return value.replace(/\/$/, '');
  } catch {
    throw new Error(`${key} must be a valid HTTP(S) URL`);
  }
}

export function validateEnvironment(env: Environment): Environment {
  const nodeEnv = optionalString(env, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const jwtSecret = required(env, 'JWT_SECRET');
  if (jwtSecret.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters');

  const corsOrigin = required(env, 'CORS_ORIGIN');
  const dbSynchronize = booleanString(env, 'DB_SYNCHRONIZE', 'false');
  if (nodeEnv === 'production' && dbSynchronize === 'true') {
    throw new Error('DB_SYNCHRONIZE cannot be true in production');
  }

  const stripeEnabled = booleanString(env, 'STRIPE_ENABLED', 'false');
  const frontendUrl = validUrl(
    stripeEnabled === 'true'
      ? required(env, 'FRONTEND_URL')
      : optionalString(env, 'FRONTEND_URL', 'http://localhost:5176/agenda'),
    'FRONTEND_URL',
  );
  const stripeSecretKey =
    stripeEnabled === 'true'
      ? required(env, 'STRIPE_SECRET_KEY')
      : optionalString(env, 'STRIPE_SECRET_KEY', '');
  const stripeWebhookSecret =
    stripeEnabled === 'true'
      ? required(env, 'STRIPE_WEBHOOK_SECRET')
      : optionalString(env, 'STRIPE_WEBHOOK_SECRET', '');

  // WhatsApp reminders. Outbound is only performed when explicitly enabled; the
  // provider requires an HTTP(S) endpoint and token when turned on.
  const whatsappEnabled = booleanString(env, 'WHATSAPP_ENABLED', 'false');
  const whatsappProvider = optionalString(env, 'WHATSAPP_PROVIDER', 'http');
  if (!['http'].includes(whatsappProvider)) {
    throw new Error('WHATSAPP_PROVIDER must be one of: http');
  }
  const whatsappApiUrl = validUrl(
    whatsappEnabled === 'true'
      ? required(env, 'WHATSAPP_API_URL')
      : optionalString(env, 'WHATSAPP_API_URL', 'https://example.com/whatsapp'),
    'WHATSAPP_API_URL',
  );
  if (
    nodeEnv === 'production' &&
    whatsappEnabled === 'true' &&
    new URL(whatsappApiUrl).protocol !== 'https:'
  ) {
    throw new Error('WHATSAPP_API_URL must use HTTPS in production');
  }
  const whatsappToken =
    whatsappEnabled === 'true'
      ? required(env, 'WHATSAPP_TOKEN')
      : optionalString(env, 'WHATSAPP_TOKEN', '');

  return {
    ...env,
    NODE_ENV: nodeEnv,
    PORT: positiveInteger(env, 'PORT', 3000),
    DB_HOST: required(env, 'DB_HOST'),
    DB_PORT: positiveInteger(env, 'DB_PORT', 3306),
    DB_USERNAME: required(env, 'DB_USERNAME'),
    DB_PASSWORD: required(env, 'DB_PASSWORD'),
    DB_NAME: required(env, 'DB_NAME'),
    DB_SYNCHRONIZE: dbSynchronize,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: optionalString(env, 'JWT_EXPIRES_IN', '1d'),
    CORS_ORIGIN: corsOrigin,
    SUBSCRIPTIONS_ENFORCED: booleanString(
      env,
      'SUBSCRIPTIONS_ENFORCED',
      'false',
    ),
    STRIPE_ENABLED: stripeEnabled,
    STRIPE_SECRET_KEY: stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
    STRIPE_AUTOMATIC_TAX: booleanString(env, 'STRIPE_AUTOMATIC_TAX', 'false'),
    STRIPE_COLLECT_TAX_ID: booleanString(env, 'STRIPE_COLLECT_TAX_ID', 'true'),
    FRONTEND_URL: frontendUrl,
    THROTTLE_TTL_MS: positiveInteger(env, 'THROTTLE_TTL_MS', 60000),
    THROTTLE_LIMIT: positiveInteger(env, 'THROTTLE_LIMIT', 100),
    WHATSAPP_ENABLED: whatsappEnabled,
    WHATSAPP_PROVIDER: whatsappProvider,
    WHATSAPP_API_URL: whatsappApiUrl,
    WHATSAPP_TOKEN: whatsappToken,
    WHATSAPP_TIMEOUT_MS: positiveInteger(env, 'WHATSAPP_TIMEOUT_MS', 5000),
    CRM_IMPORT_MAX_ROWS: positiveInteger(env, 'CRM_IMPORT_MAX_ROWS', 1000),
  };
}
