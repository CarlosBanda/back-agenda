import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sanitizeErrorMessage } from '../../common/utils/error-sanitizer';

export interface WhatsAppMessage {
  to: string;
  message: string;
  idempotencyKey: string;
}

export interface WhatsAppSendResult {
  providerMessageId: string | null;
}

/**
 * Configurable WhatsApp sender. Outbound is ONLY performed when
 * `WHATSAPP_ENABLED=true`. The default provider ('http') posts to an external
 * HTTP endpoint using global fetch (no extra dependency). Recipient numbers,
 * message bodies and tokens are never logged.
 */
@Injectable()
export class WhatsAppProviderService {
  private readonly logger = new Logger(WhatsAppProviderService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('WHATSAPP_ENABLED', 'false') === 'true';
  }

  async send(payload: WhatsAppMessage): Promise<WhatsAppSendResult> {
    if (!this.isEnabled()) {
      // Hard guard: never send when disabled, regardless of caller.
      throw new Error('WhatsApp provider is disabled');
    }
    const provider = this.config.get<string>('WHATSAPP_PROVIDER', 'http');
    if (provider !== 'http') {
      throw new Error(`Unsupported WhatsApp provider: ${provider}`);
    }
    return this.sendViaHttp(payload);
  }

  private async sendViaHttp(
    payload: WhatsAppMessage,
  ): Promise<WhatsAppSendResult> {
    const url = this.config.get<string>('WHATSAPP_API_URL', '');
    const token = this.config.get<string>('WHATSAPP_TOKEN', '');
    if (!url || !token) {
      throw new Error('WhatsApp provider is not configured');
    }
    const timeoutMs = Number(
      this.config.get<string>('WHATSAPP_TIMEOUT_MS', '5000'),
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': payload.idempotencyKey,
        },
        body: JSON.stringify({
          to: payload.to,
          message: payload.message,
          idempotencyKey: payload.idempotencyKey,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // Do not include the body: it may echo recipient/message data.
        throw new Error(`Provider responded with status ${response.status}`);
      }
      const providerMessageId = await this.extractMessageId(response);
      return { providerMessageId };
    } catch (error) {
      // Re-throw a sanitized error so nothing sensitive propagates upward.
      throw new Error(sanitizeErrorMessage(error, 300));
    } finally {
      clearTimeout(timer);
    }
  }

  private async extractMessageId(response: Response): Promise<string | null> {
    try {
      const data: unknown = await response.json();
      if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const id = record.id ?? record.messageId ?? record.message_id;
        if (typeof id === 'string') return id;
        if (typeof id === 'number') return String(id);
      }
    } catch {
      // Body was not JSON; a 2xx without a parsable id is still a success.
      this.logger.debug('WhatsApp provider returned a non-JSON success body');
    }
    return null;
  }
}
