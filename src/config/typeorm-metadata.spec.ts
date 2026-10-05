import { getMetadataArgsStorage } from 'typeorm';
import { BillingCheckoutAttempt } from '../modules/billing/entities/billing-checkout-attempt.entity';
import { BillingEvent } from '../modules/billing/entities/billing-event.entity';
import { Plan } from '../modules/subscriptions/entities/plan.entity';
import { Subscription } from '../modules/subscriptions/entities/subscription.entity';
import { AdminAuditLog } from '../modules/support/entities/admin-audit-log.entity';
import { PlatformError } from '../modules/support/entities/platform-error.entity';
import { SupportCase } from '../modules/support/entities/support-case.entity';
import { Appointment } from '../modules/appointments/entities/appointment.entity';
import { Client } from '../modules/crm/entities/client.entity';
import { WhatsappReminderAttempt } from '../modules/reminders/entities/whatsapp-reminder-attempt.entity';

describe('MySQL entity metadata', () => {
  it.each([
    [AdminAuditLog, 'targetType', 'varchar'],
    [AdminAuditLog, 'targetId', 'varchar'],
    [PlatformError, 'resolvedById', 'int'],
    [SupportCase, 'businessId', 'int'],
    [SupportCase, 'assignedAdminId', 'int'],
    [BillingEvent, 'businessId', 'int'],
    [BillingCheckoutAttempt, 'stripeSessionId', 'varchar'],
    [Plan, 'providerPriceId', 'varchar'],
    [Subscription, 'providerSubscriptionId', 'varchar'],
    [Subscription, 'providerCustomerId', 'varchar'],
    [Appointment, 'clientId', 'int'],
    [Appointment, 'clientRecordId', 'int'],
    [Appointment, 'depositAmount', 'decimal'],
    [Appointment, 'depositPaidAmount', 'decimal'],
    [Appointment, 'depositPaidAt', 'datetime'],
    [Appointment, 'depositMethod', 'varchar'],
    [Appointment, 'depositNote', 'varchar'],
    [Client, 'phone', 'varchar'],
    [Client, 'email', 'varchar'],
    [Client, 'notes', 'text'],
    [Client, 'linkedUserId', 'int'],
    [WhatsappReminderAttempt, 'providerMessageId', 'varchar'],
    [WhatsappReminderAttempt, 'sanitizedError', 'varchar'],
  ] as const)(
    '%s.%s declares an explicit %s type',
    (entity, propertyName, expectedType) => {
      const column = getMetadataArgsStorage().columns.find(
        (candidate) =>
          candidate.target === entity &&
          candidate.propertyName === propertyName,
      );

      expect(column).toBeDefined();
      expect(column?.options.nullable).toBe(true);
      expect(column?.options.type).toBe(expectedType);
    },
  );
});
