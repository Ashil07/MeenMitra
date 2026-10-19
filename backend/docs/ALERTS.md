# Alert delivery

Code: [app/providers/base.py](../app/providers/base.py) (interface),
[app/providers/mock.py](../app/providers/mock.py) (default and only implementation),
[app/services/alerts.py](../app/services/alerts.py), templates in
[app/config_data/alert_templates.json](../app/config_data/alert_templates.json).

## Flow

1. A forecast or water check with status `watch`/`danger` creates an alert (`pending`) with English
   and Kannada title, message and voice script. Pass `create_alert: false` to suppress it.
2. `POST /alerts/{id}/simulate-send` asks the provider to deliver on each channel (WhatsApp, SMS,
   voice) and records one `DeliveryAttempt` per channel: masked recipient, localized text,
   attempt number, timestamp, simulated status, provider name/mode, error and `retry_allowed`.
3. Alert status becomes `sent` if the latest attempt on any channel was delivered, else `failed`.
   A delivered channel is never re-sent. A failed channel can be retried up to 3 attempts.
4. `POST /alerts/{id}/acknowledge` records the response (`seen` / `action_taken` / `need_help`),
   channel, note and timestamp. Status becomes `acknowledged`, and no further sends are allowed.

## Mock provider guarantees

* No network or telephony code; it only decides an outcome from the request (tests block socket
  connections during sends to prove this).
* Outcomes: `simulated_delivered`; `simulated_failed` with `simulated_failure` (when requested via
  `simulate_failure_channels`) or `no_recipient` (pond has no phone on record).
* Every attempt carries `simulated: true` and `external_request_made: false`.
* Seed phone numbers use the invalid `+91 00000…` range.

## Templates

English and Kannada drafts for forecast watch/danger and water-check watch/danger. **The Kannada
text is an unreviewed draft** (`template_review_status: unreviewed_draft`). A competent Kannada
speaker familiar with local fishing vocabulary must review it before it is presented as
production-ready.

## Before enabling any real provider

A real adapter must implement `AlertProvider.send` and be selected by configuration, with
credentials only in environment variables or a secret store. All of the following must be
resolved first, with explicit human approval:

* **WhatsApp**: a WhatsApp Business Platform account (directly or via a provider), a verified
  business, and pre-approved message templates in each language for business-initiated messages.
  Farmers must opt in.
* **SMS (India)**: DLT registration under TRAI's commercial-communication regulations (entity,
  sender header and content templates) through an operator; transactional vs promotional
  classification; DND handling.
* **Voice**: provider setup, calling-hour restrictions, DND/consent rules, and recorded or
  synthesised Kannada audio reviewed for clarity.
* **Consent and privacy**: documented farmer consent per channel and an easy opt-out; handling of
  phone numbers under India's Digital Personal Data Protection Act, 2023; retention limits.
* **Cost and reliability**: per-message and per-minute pricing, budgets, rate limits,
  delivery-receipt webhooks (signature-verified), retries and idempotency.
* **Safety**: a test mode that can only reach allow-listed numbers, and monitoring for failed deliveries.

None of this is implemented, and no real message has been sent by this project.
