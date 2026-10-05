# Producción: Agenda

## Estado preparado

- API NestJS y frontend React compilan como imágenes Docker no-root/NGINX.
- La API valida entorno, aplica Helmet, CORS exacto, rate limiting, DTOs estrictos y autorización por propietario/administrador.
- `DB_SYNCHRONIZE=true` está bloqueado en producción; el esquema se administra con migraciones.
- Stripe Billing está integrado mediante Checkout, Customer Portal y webhooks firmados e idempotentes.
- La integración está deshabilitada por defecto (`STRIPE_ENABLED=false`) y la aplicación puede operar sin credenciales hasta su activación.
- Los planes se cobran en MXN y sus Price de Stripe se validan contra monto y periodicidad locales antes de abrir Checkout.
- Las cuotas se aplican en backend cuando `SUBSCRIPTIONS_ENFORCED=true`.
- El registro público sólo permite cuentas CLIENT o BUSINESS; el primer ADMIN se crea con el comando operativo documentado.

## Secuencia de despliegue

1. Crear MySQL administrado con backups automáticos, restauración probada, conexión privada/TLS y usuario de privilegios mínimos.
2. Copiar `.env.example` al secret manager. Generar un `JWT_SECRET` aleatorio de al menos 32 caracteres y configurar orígenes exactos en `CORS_ORIGIN`.
3. Construir y publicar:
   - API: `docker build -t <registry>/agenda-api:<tag> .`
   - Web: `docker build --build-arg VITE_API_URL=https://api.example.com -t <registry>/agenda-web:<tag> .`
4. Ejecutar como release job antes de la nueva API: `npm run migration:run:prod`. Hacer backup antes de migrar una base existente. Las migraciones `1770000002000-CreateBillingEvents`, `1770000003000-HardenBillingConcurrency` y `1770000004000-SupportAndOperations` crean idempotencia/leases de Billing, intentos únicos de Checkout, tickets, errores sanitizados y auditoría administrativa.
5. En una instalación nueva, crear una sola vez el administrador con `npm run admin:create:prod`, inyectando temporalmente `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE` y `ADMIN_PASSWORD`.
6. Configurar Stripe en modo test siguiendo la sección siguiente. Mantener `STRIPE_ENABLED=false` hasta completar Products/Prices, portal, webhook y secretos.
7. Crear los planes desde `/admin/planes`, asociando a cada uno su `price_...` recurrente de Stripe.
8. Mantener `SUBSCRIPTIONS_ENFORCED=false` durante la migración de negocios existentes. Activarlo sólo cuando todos tengan trial o plan vigente.
9. Desplegar API y web detrás de HTTPS. Verificar `/health`, login, creación de negocio, agenda, Checkout de prueba, webhook, portal y límites.
10. Repetir la configuración con recursos y claves live sólo después de aprobar el flujo completo en modo test.

## Stripe Billing — México y MXN

### 1. Cuenta y catálogo

1. Crear/activar la cuenta de Stripe México y completar la información comercial y bancaria solicitada por Stripe.
2. Trabajar primero con **modo test**.
3. En Stripe Dashboard, crear un Product por nivel comercial y un Price recurrente por periodicidad:
   - moneda: `MXN`;
   - tipo: recurrente;
   - intervalo: mensual o anual, una unidad de intervalo;
   - importe: exactamente el mismo configurado en Agenda.
4. Copiar únicamente el identificador público operativo `price_...` al campo **Stripe Price ID** del plan en `/admin/planes`. No copiar claves secretas al panel ni al chat.
5. Los Prices de Stripe son inmutables. Antes de asignar `providerPriceId` todavía puede corregirse el contrato; desde que el plan se vincula a un Price, Agenda bloquea cambios de `providerPriceId`, moneda, monto e intervalo. Para cambiar cualquiera de esos campos se debe crear un Price y un plan nuevos y migrar clientes explícitamente.

La API rechaza Checkout si el plan está inactivo, no está en MXN, no tiene Price, o si el Price no está activo, no es recurrente, no coincide en monto o no corresponde al intervalo mensual/anual. Además, `billing_checkout_attempts` impone un intento abierto por negocio, reutiliza su URL y usa una `idempotencyKey` persistente al llamar a Stripe; esto evita crear dos suscripciones por doble clic, reintento o solicitudes concurrentes. Un intento abandonado conserva su clave para recuperarse sin duplicar la sesión.

### 2. Customer Portal

En **Settings → Billing → Customer portal** de Stripe:

- habilitar actualización de método de pago y consulta de facturas;
- habilitar cancelación al final del periodo según la política comercial;
- configurar términos, privacidad, nombre comercial y soporte;
- inicialmente **no habilitar cambios de producto/Price desde el portal**. La aplicación valida que el Price siga correspondiendo al plan guardado; los upgrades/downgrades requieren un flujo explícito antes de habilitarlos.

La página `/planes` muestra **Administrar suscripción** para cuentas BUSINESS con un Customer Stripe existente.

### 3. Webhook

Crear un endpoint de webhook en Stripe Dashboard:

```text
https://api.example.com/billing/webhook
```

Suscribir sólo estos eventos:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

La API:

- verifica `stripe-signature` contra el cuerpo crudo de la petición;
- registra el `event.id` en `billing_events` para impedir doble procesamiento;
- usa un lease de cinco minutos: otro worker recibe 503 mientras está vigente y un reintento recupera automáticamente un claim abandonado tras una caída;
- elimina el claim si el procesamiento falla normalmente, permitiendo el reintento de Stripe;
- recupera el estado actual de la suscripción para tolerar eventos fuera de orden;
- toma el periodo desde `subscription.items.data[*].current_period_start/end`, contrato de `stripe@22.6.0`;
- deriva negocio y plan de metadata firmada y valida el Price asociado.

No se debe proteger esta ruta con JWT: su autenticación es la firma Stripe. Debe ser pública por HTTPS, pero no debe aceptar eventos con firma inválida.

### 4. Secretos y variables

Inyectar desde un secret manager, nunca desde el repositorio, una imagen Docker, un ticket o el chat:

```env
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=<clave secreta test o live>
STRIPE_WEBHOOK_SECRET=<secreto whsec del endpoint correspondiente>
FRONTEND_URL=https://app.example.com/agenda
STRIPE_AUTOMATIC_TAX=false
STRIPE_COLLECT_TAX_ID=true
```

Cuando `STRIPE_ENABLED=true`, la API exige las dos claves y una `FRONTEND_URL` HTTP(S) válida al arrancar. Si está deshabilitado, `/billing/checkout`, `/billing/portal` y `/billing/webhook` responden 503 sin impedir que la aplicación inicie.

No mezclar recursos test/live: una clave test, un `price_...` test y un `whsec_...` test deben usarse juntos; lo mismo aplica en live.

### 5. Prueba local con Stripe CLI

Con la API en `localhost:3000`, el frontend en `http://localhost:5176/agenda` y credenciales test configuradas localmente:

```bash
stripe listen \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted \
  --forward-to localhost:3000/billing/webhook
```

Configurar temporalmente el `whsec_...` mostrado por Stripe CLI como `STRIPE_WEBHOOK_SECRET`, reiniciar la API y completar Checkout con una tarjeta de prueba oficial de Stripe. Confirmar:

- redirección a `/agenda/planes?checkout=success`;
- un único evento procesado por `eventId` aunque se reenvíe;
- suscripción local ACTIVE/TRIAL con customer, subscription y periodo correctos;
- acceso al portal y sincronización de cancelación;
- rechazo de firma incorrecta.

### 6. Impuestos y facturación en México

- `STRIPE_COLLECT_TAX_ID=true` solicita el identificador fiscal compatible en Checkout.
- Activar `STRIPE_AUTOMATIC_TAX=true` sólo después de configurar Stripe Tax y las obligaciones/registraciones aplicables. El valor predeterminado es `false`.
- Los recibos o invoices de Stripe no deben asumirse automáticamente como CFDI válido ante SAT. La emisión/cancelación de CFDI, datos fiscales, IVA, complementos y conciliación requieren definir un proveedor fiscal o proceso contable separado y validarlo con asesoría fiscal mexicana.
- No se fuerza OXXO: Checkout usa métodos compatibles con cobros recurrentes habilitados en la cuenta. OXXO no es el método normal para renovar automáticamente una suscripción.

## Soporte y centro de operaciones

### Acceso y flujo

- Usuarios CLIENT y BUSINESS acceden a `/agenda/soporte` para crear solicitudes, consultar sus folios y conversar con soporte.
- Administradores acceden a `/agenda/admin/operaciones` para tickets, búsqueda/contexto, errores 5xx, eventos Stripe y auditoría.
- Desde el contexto consolidado, un administrador puede abrir proactivamente un ticket para un usuario o para el propietario de un negocio; la asociación solicitante-negocio se valida en backend. Las rutas de solicitante aceptan sólo CLIENT/BUSINESS y las rutas `/support/admin/*` sólo ADMIN.
- Una respuesta pública del administrador mueve el ticket a `WAITING_USER`; la respuesta del solicitante lo reactiva a `OPEN`. Un caso `CLOSED` ya no acepta respuestas públicas, aunque el administrador puede conservar notas internas.
- Las notas marcadas como internas nunca se entregan por los endpoints del solicitante.
- La conversación es dentro de la plataforma. No envía email o WhatsApp hasta configurar una integración de notificaciones independiente.

### Datos almacenados y excluidos

El módulo almacena únicamente:

- asunto, descripción, conversación, negocio relacionado, estado, prioridad, asignación y fechas del ticket;
- ruta sin query string, método, estado HTTP, nombre/mensaje sanitizado y `requestId` para errores 5xx;
- administrador, acción, ruta sin query, recurso, resultado y `requestId` para auditoría;
- ID/tipo/estado/intentos/error sanitizado y negocio relacionado para webhooks Stripe.

No almacena en soporte/observabilidad:

- cuerpos o query strings de peticiones;
- cabeceras Authorization, JWT, contraseñas, claves API o secretos de webhook;
- payload completo de Stripe, datos completos de tarjeta ni URLs de Checkout;
- stack traces en la base operativa.

La sanitización redacta patrones de tokens, claves Stripe, JWT, correos y teléfonos antes de persistir mensajes técnicos. Aun así, los usuarios y agentes deben evitar escribir secretos en tickets; la interfaz lo advierte expresamente.

### Atención operativa

1. Localizar el ticket por folio o buscar usuario/negocio por nombre, correo, teléfono o ID.
2. Consultar sólo el contexto necesario: citas recientes, negocio, plan, suscripción y eventos relacionados.
3. Correlacionar errores, auditoría y Billing con `requestId`, `businessId` o IDs de proveedor.
4. Usar nota interna para hipótesis técnicas y respuesta pública únicamente para información destinada al usuario.
5. Marcar errores resueltos sólo después de verificar la corrección; este cambio no borra el registro.
6. Para eventos Stripe fallidos, corregir la causa y dejar que Stripe reintente. El claim libera su lease tras fallo y conserva el diagnóstico sanitizado.

### Privacidad y retención

El acceso administrativo queda auditado, incluyendo lecturas. Debe limitarse a personal autorizado y revisarse periódicamente conforme al aviso de privacidad y obligaciones aplicables en México.

Política inicial recomendada, sujeta a aprobación legal/operativa:

- tickets y mensajes: mientras el caso esté activo y hasta 24 meses después del cierre;
- errores resueltos: 90 días;
- auditoría administrativa: 12 meses;
- eventos Billing procesados: 12 meses;
- eventos fallidos, disputas o evidencias vinculadas a una aclaración: conservar hasta cerrar la investigación y cumplir obligaciones contables/legales.

No se habilita borrado automático porque sería irreversible. Antes de programarlo se debe aprobar la política, respaldar/exportar lo necesario y ejecutar la purga como job separado, acotado por estado y fecha. Las solicitudes de acceso, corrección o supresión deben validarse antes de afectar registros que deban conservarse por seguridad, facturación o requisitos legales.

### Observabilidad externa opcional

`PlatformError` proporciona un registro local sanitizado y correlacionado. Sentry/OpenTelemetry sigue siendo opcional para alertas y trazas avanzadas. Si se habilita, configurar scrubbing de PII, muestreo, región/retención y no transmitir bodies, tokens ni datos de pago sin evaluación y autorización explícitas.

## Otras integraciones necesarias

### Notificaciones

Actualmente el sistema registra `EMAIL_PENDING` y `WHATSAPP_PENDING`; no envía mensajes. Elegir un proveedor real (por ejemplo SES/Postmark/Resend para email y Meta/Twilio para WhatsApp) y añadir cola/outbox, reintentos e idempotencia. El cron no debe correr sin coordinación en todas las réplicas.

### Infraestructura operativa

- MySQL administrado con backups, restauración y alertas.
- Secret manager para DB, JWT y Stripe.
- Dominio, DNS, TLS y balanceador/reverse proxy.
- Logs centralizados, métricas y alertas; Sentry u OpenTelemetry para errores/trazas.
- Alertas de Stripe para webhooks fallidos, pagos atrasados y disputas.
- Almacenamiento de objetos/CDN si se habilita carga de imágenes; hoy sólo se guardan URLs.

## Decisiones operativas pendientes

- Política comercial de trial, gracia, reintentos, cancelación, reembolsos y disputas.
- Proveedor/proceso de CFDI y conciliación fiscal.
- Zona horaria por negocio; el dominio actual guarda fecha/hora sin zona por establecimiento.
- Estrategia de upgrade/downgrade antes de habilitar cambio de Price en Customer Portal.
- Sesiones: hoy se usa JWT Bearer en `localStorage`; para mayor endurecimiento, migrar a access token corto y refresh token rotado en cookie `HttpOnly`, `Secure`, `SameSite`.
- Confirmar si una cuenta BUSINESS puede gestionar varios establecimientos o debe limitarse por plan.

## Validación sin credenciales

La integración puede compilarse y probar sus reglas con `STRIPE_ENABLED=false`; no es posible certificar un Checkout/webhook real sin cuenta, recursos y claves Stripe. La validación live debe realizarse en el entorno del propietario sin compartir secretos.


## MVP de operación: agenda, CRM, políticas, recordatorios y onboarding

Este bloque documenta los cinco módulos añadidos sobre el núcleo existente. Todos
respetan JWT, roles y propiedad del negocio (`assertCanManage`): un `BUSINESS`
sólo opera sus negocios; `ADMIN` puede operar cualquiera. No se registran cuerpos,
tokens ni PII, y los errores técnicos se sanitizan antes de persistirse.

### Migración

`1770000005000-AgendaCrmOperations` (posterior a `1770000004000`) es idempotente
(`CREATE TABLE IF NOT EXISTS`, `hasColumn`) y:

- crea `clients`, `client_tags`, `client_tag_links`, `client_notes`,
  `business_policies`, `reminder_settings`, `whatsapp_reminder_attempts` y
  `onboarding_states`;
- amplía `appointments`: añade `NO_SHOW` al enum `status`, hace `clientId`
  nullable (para citas de clientes CRM importados sin cuenta de usuario), y agrega
  `clientRecordId` (FK a `clients`, `ON DELETE SET NULL`) más el tracking manual de
  anticipo (`depositStatus`, `depositAmount`, `depositPaidAmount`, `depositPaidAt`,
  `depositMethod`, `depositNote`).

Las columnas nullable de tipo unión declaran su tipo SQL explícito en la entidad
(`type: 'int' | 'varchar' | 'decimal' | 'datetime' | 'text'`) para evitar
`DataTypeNotSupportedError`; `typeorm-metadata.spec.ts` lo verifica.

### Agenda (`/agenda`, BUSINESS/ADMIN)

- `GET /agenda/businesses/:businessId?from=&to=&staffId=&status=` — rango de citas
  (máximo 62 días, `to >= from`), ordenado por fecha y hora.
- `GET /agenda/businesses/:businessId/day?date=&staffId=` — día.
- `GET /agenda/businesses/:businessId/week?date=&staffId=` — semana lunes–domingo
  que contiene `date`.
- `PATCH /agenda/appointments/:id/quick-action` `{ action: CONFIRM|COMPLETE|CANCEL|NO_SHOW }`
  — acciones rápidas sobre las transiciones de estado válidas.
- `PATCH /agenda/appointments/:id/deposit` `{ status, amount?, paidAmount?, method?, note? }`
  — tracking manual del anticipo.
- `POST /agenda/appointments/:id/deposit/apply-policy` — recalcula el anticipo
  requerido desde la política del negocio y el precio del servicio, salvo que ya
  esté pagado o reembolsado. Al crear una cita, el monto requerido se aplica
  automáticamente como `PENDING`; **esto no cobra al cliente**: efectivo o
  transferencia se registran manualmente. Un pago sólo puede conservarse como
  `PAID` o pasar a `REFUNDED`, para no borrar su rastro.

### CRM (`/crm`, BUSINESS/ADMIN)

Clientes por negocio (`MANUAL`, `IMPORTED`, `LINKED`), con dedup por negocio en
teléfono y correo (normalizados; el teléfono descarta el código de país 52/521).

- Clientes: `POST/GET /crm/businesses/:businessId/clients`,
  `GET/PATCH/DELETE /crm/clients/:id`.
- Vinculación a usuario: `POST /crm/clients/:id/link` `{ userId }`,
  `POST /crm/clients/:id/unlink`. Sólo permite cuentas `CLIENT` activas cuyo
  teléfono o correo normalizado coincida con la ficha CRM; no admite vincular
  IDs arbitrarios.
- Historial y métricas: `GET /crm/clients/:id/history`,
  `GET /crm/clients/:id/metrics`, `GET /crm/businesses/:businessId/metrics`.
- Notas: `POST/GET /crm/clients/:id/notes`.
- Etiquetas: `POST/GET /crm/businesses/:businessId/tags`,
  `POST /crm/clients/:id/tags` `{ tagIds }`, `DELETE /crm/clients/:id/tags/:tagId`.
- Importación CSV (texto en JSON, sin dependencia nueva):
  `POST /crm/businesses/:businessId/clients/import`
  `{ content, hasHeader?, defaultTagIds? }`. Acepta hasta 1 MB de texto JSON
  (parser HTTP configurado a 2 MB para cubrir el encoding), valida el límite
  `CRM_IMPORT_MAX_ROWS`, nombre, teléfono mexicano, correo, notas y etiquetas;
  normaliza y deduplica dentro del archivo y contra la base, crea etiquetas
  referenciadas y **nunca crea usuarios ni contraseñas**. Devuelve
  `{ totalRows, created, duplicatesInFile, duplicatesInDb, invalid, tagsCreated, errors[] }`.

### Políticas (`/policies`, BUSINESS/ADMIN)

- `GET /policies/businesses/:businessId` — política administrable de
  anticipo/cancelación (o un valor por defecto en MXN si aún no existe).
- `GET /public/policies/businesses/:businessId` — proyección pública sin PII para
  mostrar condiciones antes de confirmar una reserva.
- `PUT /policies/businesses/:businessId` `{ depositType, depositValue, currency,
  cancellationWindowHours, cancellationFeeType, cancellationFeeValue, policyText }`.
  `depositType`/`cancellationFeeType` ∈ `NONE|FIXED|PERCENT`, los porcentajes no
  exceden 100 y la única moneda admitida es MXN. Stripe queda pendiente; el
  cobro/seguimiento del anticipo es manual sobre la cita.

### Recordatorios WhatsApp (`/reminders`, BUSINESS/ADMIN)

Deshabilitados por defecto y **sin outbound salvo habilitación explícita**: se
requiere `WHATSAPP_ENABLED=true` a nivel plataforma **y** `whatsappEnabled=true`
por negocio. El proveedor `http` usa `fetch` global (sin dependencia nueva) con
timeout, sanitiza errores y nunca registra destinatario, mensaje ni token.

- `GET/PUT /reminders/businesses/:businessId/settings`
  `{ whatsappEnabled, hoursBefore, messageTemplate }`.
- `GET /reminders/businesses/:businessId/attempts` — intentos persistidos.
- `POST /reminders/appointments/:id/send` — envío manual respetando el gating.

Cada intento reclama atómicamente la clave
`appt:{id}:{date}:{startTime}:{hoursBefore}` antes del outbound, mediante índice
`UNIQUE` y estado `PENDING`; sólo el worker propietario envía. La misma clave se
transmite al proveedor en `Idempotency-Key` y en el cuerpo para reducir dobles
entregas tras timeouts. Estados: `PENDING|SENT|FAILED|SKIPPED`. Las plantillas
aceptan `{cliente}`, `{negocio}`, `{fecha}` y `{hora}` (también `{date}`/`{time}`
por compatibilidad). El cron horario sólo escanea si el flag global está activo;
si está deshabilitado no hay tráfico saliente alguno.

### Onboarding (`/onboarding`, BUSINESS/ADMIN)

- `GET /onboarding/businesses/:businessId` — estado (`PENDING|IN_PROGRESS|COMPLETED`)
  y checklist.
- `PATCH /onboarding/businesses/:businessId` — actualiza pasos; el estado se recalcula.
- `POST /onboarding/businesses/:businessId/import-clients`
  `{ content, hasHeader?, defaultTagIds? }` — delega la importación CSV al CRM,
  marca el paso `clientsImported` y devuelve
  `{ import: ImportResult, onboarding: OnboardingState }`.

### Variables de entorno añadidas

```env
WHATSAPP_ENABLED=false          # ninguna salida mientras sea false
WHATSAPP_PROVIDER=http          # adaptador genérico sobre fetch
WHATSAPP_API_URL=               # requerido; HTTPS obligatorio en producción
WHATSAPP_TOKEN=                 # requerido si ENABLED=true; nunca se registra
WHATSAPP_TIMEOUT_MS=5000
CRM_IMPORT_MAX_ROWS=1000        # límite de filas por importación
```

Compatibilidad: los endpoints previos (`/appointments`, etc.) no cambian su
contrato. `POST /appointments/business` acepta además `clientRecordId` y hace
`clientId` opcional (exactamente uno de los dos), sin afectar a los clientes
existentes que siguen enviando `clientId`.
