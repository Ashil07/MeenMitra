# MeenMitra — Project Instructions for Claude Code

## 1. Project Overview

MeenMitra is a hackathon MVP for early disease and water-quality alerts for small aquaculture farms in coastal Karnataka, India.

The proposed system helps farmers understand potential overnight pond oxygen risk, inspect water-quality conditions, receive actionable alerts in Kannada and English, and report observations.

The project demonstrates a proposed hybrid architecture:
1. Farmer and pond inputs.
2. Weather features.
3. Physics-inspired baseline oxygen-risk model.
4. ML correction layer.
5. Water-quality and symptom rules.
6. Safe/Watch/Danger risk classification.
7. WhatsApp/SMS/voice alert delivery.
8. Farmer feedback and per-pond calibration.
9. Cooperative monitoring and outbreak reporting.

This is an MVP. The application must clearly distinguish working software, simulations, experiments and future production capabilities.

## 2. Non-Negotiable Rules

- Inspect the existing repository before editing anything.
- Read this file and all applicable nested project instructions.
- Preserve useful existing code and avoid unnecessary rewrites.
- Never claim that a simulated prediction is a validated real-world forecast.
- Never fabricate dataset statistics, model metrics, observations or delivery receipts.
- Never claim a real message or call was sent when the mock provider was used.
- Never expose secrets or commit credentials.
- Never silently swallow errors.
- Never create nonfunctional buttons, fake navigation or misleading status indicators.
- Never disable tests or weaken validation merely to obtain a passing build.
- Never change shared API contracts without coordination.
- Never overwrite another developer's work without inspecting and understanding it.
- Do not introduce unnecessary dependencies, services or infrastructure.
- Do not make unrequested destructive Git, database or deployment changes.

## 3. Contributor and Git Identity Policy

Claude is a coding assistant, not a human project contributor.

- Do not add Claude, an AI assistant, an AI agent or a bot to the project's contributor list.
- Do not add AI/bot attribution to README files, contributor tables or project metadata.
- Do not create commits using an AI/Claude/bot author or committer identity.
- Do not append `Co-authored-by` trailers identifying Claude, an AI assistant or a bot.
- Do not alter Git author or committer configuration.
- Do not rewrite existing Git history.
- Do not push, publish, open pull requests or modify repository settings without explicit authorization.

Leave commit creation and human contributor attribution to the human developer. Do not claim to be a human contributor or falsely claim human authorship.

## 4. Team Ownership and File Boundaries

Two developers work on this repository.

### Developer A: Frontend

Owns:
- Next.js routes, pages and layouts.
- React components and frontend styles.
- Frontend design system and responsive UI.
- Frontend API client and TypeScript API types.
- Charts, forms, navigation and user interactions.
- Frontend tests and documentation.

### Developer B: Backend and ML

Owns:
- FastAPI application and routes.
- Backend schemas and API contracts.
- Prediction and water-quality rules engines.
- Demo fixtures and local persistence.
- Dataset ingestion and validation.
- ML preprocessing, training and evaluation.
- Alert simulation and acknowledgement services.
- Backend tests and documentation.

### Shared rules

- Agree on the API contract before integrating.
- The backend owner publishes schemas and sample responses.
- The frontend owner consumes the published schemas.
- Frontend mock fixtures must be separate from backend business logic.
- Do not edit files owned by the other developer unless necessary and coordinated.
- Shared configuration, root documentation and dependencies require coordination.
- When a shared file must change, make the smallest safe change and communicate it.
- Do not create two competing implementations of the same business rule.

## 5. Technology and Architecture

Preferred architecture:

- Frontend: Next.js, TypeScript and Tailwind CSS.
- Backend: Python and FastAPI.
- Data science: pandas, NumPy and scikit-learn; XGBoost if appropriate.
- Charts: use the existing chart library where available.
- Storage: use an existing database if practical; otherwise select a simple, documented local option.
- Weather: Open-Meteo integration is optional for the MVP and must have a working demo fallback.
- Messaging: provider-independent adapter with a mock implementation enabled by default.

Inspect the actual repository before choosing versions or adding packages. Existing working architecture takes precedence over unnecessary rewrites.

Keep routes, schemas, business logic, integrations and data access in separate modules.

## 6. API Contract

Use `/api/v1` for versioned API routes.

Proposed endpoints:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/ponds`
- `POST /api/v1/ponds`
- `GET /api/v1/ponds/{pond_id}`
- `PATCH /api/v1/ponds/{pond_id}` where appropriate
- `POST /api/v1/ponds/{pond_id}/forecast`
- `POST /api/v1/ponds/{pond_id}/water-check`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/{alert_id}/simulate-send`
- `POST /api/v1/alerts/{alert_id}/acknowledge`
- `GET /api/v1/ml/status`
- `GET /api/v1/approach`

These are the intended contracts, not permission to assume an endpoint already exists. Inspect existing implementation, finalize schemas with both developers, and document any justified changes.

Use consistent IDs, timestamps, validation, response formats and error handling.

## 7. Forecast Engine and Safety

The demo forecast must be deterministic for the same inputs and configuration.

It should explain how weather and pond characteristics influence the relative risk score and hourly forecast.

Requirements:
- Explicit simulation/provenance metadata.
- Clear distinction between observed, forecast and synthetic values.
- Documented model assumptions.
- Safe/Watch/Danger classification.
- Explainable risk factors.
- Missing-data handling.
- No unsupported claims of predictive accuracy.
- No fabricated measured dissolved-oxygen values.
- No guaranteed oxygen-crash times.
- No automatic claims that an intervention will prevent fish mortality.

If the system lacks a suitable calibrated model, output a relative demo risk index rather than presenting a scientifically validated dissolved-oxygen concentration.

Water-quality thresholds must have documented units, assumptions and sources. Unvalidated thresholds must be labelled demonstration settings.

Disease diagnosis and medication advice must be referred to a qualified fisheries professional.

## 8. Dataset and ML Integrity

Investigate the sources referenced in the MeenMitra proposal:

- Kaggle Sensor Based Aquaponics Fish Pond Dataset.
- Mendeley aquaculture water-quality dataset.
- Kaggle Freshwater Fish Disease Aquaculture in South Asia dataset.
- Open-Meteo historical and forecast weather data.

Verify the actual source, licence, schema, units, target labels and availability before using any dataset.

Requirements:
- Document dataset provenance and acquisition steps.
- Do not commit large datasets or sensitive files.
- Separate disease classification from dissolved-oxygen prediction.
- Validate schema and missing values.
- Define features and targets explicitly.
- Avoid leakage across time-dependent or grouped data.
- Use an appropriate split and evaluation method.
- Generate metrics from actual model evaluations.
- Store model metadata and evaluation results when available.
- Use synthetic data only for testing and demo scaffolding.
- Report unavailable datasets and unsuccessful training honestly.

Never invent model accuracy, dataset sizes or training results.

## 9. Alert Provider Policy

The mock provider is the default.

It must simulate:
- WhatsApp messages.
- SMS notifications.
- Voice-call events.
- Delivery status and timestamps.
- Farmer acknowledgements.
- Failed attempts and retry states where appropriate.

No mock action may contact a real phone number.

Keep external providers behind interfaces so they can be integrated later without rewriting the product.

Never store provider credentials in source code. Real delivery requires explicit human approval, valid configuration, suitable consent and compliance checks.

## 10. Frontend Quality

The frontend must be a polished, responsive product experience.

Required screens include:
- Dashboard.
- Pond list and pond details.
- Pond registration and editing.
- Forecast explorer.
- Water-quality check.
- Alert centre.
- Cooperative monitoring.
- Technical approach explorer.
- Dataset and ML status.

Every visible control must have a defined action. Forms must validate inputs. Charts must reflect actual API or explicitly labelled demo data.

Include:
- Loading states.
- Empty states.
- Error and retry states.
- Success feedback.
- Accessible labels and keyboard navigation.
- Mobile layouts.
- Clear demo-mode indicators.
- Consistent design tokens and typography.

Do not present demo data as live farm data.

## 11. Security and Configuration

- Commit an `.env.example`, never real credentials.
- Keep secrets in environment variables.
- Validate API inputs.
- Configure CORS explicitly.
- Do not expose sensitive farmer information in public dashboards.
- Do not share individual farmer identities in simulated outbreak alerts.
- Use safe defaults and minimal permissions.
- Document external-service setup separately from local demo setup.

## 12. Testing and Quality Gates

Before declaring work complete, run the relevant checks that the repository supports.

Frontend:
- Lint.
- Typecheck.
- Unit/component tests.
- Production build.

Backend:
- Automated tests.
- Request/response validation tests.
- Forecast and rules-engine tests.
- ML-status and missing-data tests.
- Mock alert and acknowledgement tests.
- Startup without external credentials.

Integration:
- Frontend can use the published API contract.
- Demo mode works without paid services.
- Error states render correctly.
- Simulated notifications do not reach external services.
- Seed data is reproducible.
- Documentation matches the actual implementation.

Do not claim a check passed unless it was executed and passed. Report blocked checks explicitly.

## 13. Documentation

Maintain:
- Root README with project overview and quick start.
- `CLAUDE.md` with shared development instructions.
- `.env.example` with placeholders only.
- Backend API documentation and example payloads.
- Dataset provenance and setup instructions.
- ML methodology and evaluation limitations.
- Demo instructions and sample scenarios.
- Known limitations and future production requirements.

Keep documentation consistent with the actual code.

## 14. Definition of Done

The MVP is ready for demonstration when:

1. The frontend is visually polished and responsive.
2. Pond registration and management work.
3. A user can run a demo forecast and inspect the hourly curve.
4. The water-quality rules engine produces explainable results.
5. The technical-approach page explains the complete proposed pipeline.
6. Dataset and ML status reflect real execution state.
7. Alerts can be simulated and acknowledged.
8. The cooperative dashboard shows meaningful seeded data.
9. The project runs locally without paid credentials.
10. Automated checks pass or remaining failures are documented.
11. A new developer can follow the README and run the demo.
12. No unvalidated model or simulated alert is misrepresented as production functionality.

Prioritize a coherent, demonstrable end-to-end MVP over unnecessary complexity.