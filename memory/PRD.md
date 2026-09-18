# AgriSutra MVP Product Record

## Original problem statement
Build an agricultural marketplace platform for farmers, buyers, FPOs/cooperatives, and admins. The complete vision includes farmer and buyer profiles, crop lots, quality verification, market and buyer discovery, net-realisation calculations, sell-now versus store analysis, offers, logistics, storage, payments, audit/provenance, alerts, WhatsApp, regional language and voice interaction, analytics, and AI decision support. The MVP vertical slice is: collect crop details, calculate controlled market and buyer options, subtract all relevant costs, compare sell now versus store, show transparent top recommendations, let the farmer choose, create an offer, and simulate the connected transaction timeline. The farmer remains the final decision-maker and AI explains backend-calculated numbers rather than inventing them.

## Personas
- **Farmer:** Rajesh Patil; wants a simple, trustworthy answer about where and when to sell.
- **Buyer:** procurement user comparing verified lots and offers.
- **FPO / Cooperative:** aggregates farmers and manages collective lots.
- **Admin / Verifier:** monitors verification, transactions, disputes, and audit completeness.

## Architecture decisions
- React 19 dashboard with role selector for Farmer, Buyer, FPO, and Admin workspaces.
- FastAPI backend under `/api`, using the existing MongoDB environment and response-safe Pydantic models.
- Controlled demo datasets for markets, buyer demand, transport, storage, commission, packaging, and spoilage; endpoints are integration-ready.
- Deterministic net-realisation engine: revenue minus transport, storage, commission, packaging, expected loss, and other relevant costs.
- GPT-5.4 assistant through the server-side universal LLM key; assistant receives calculated context and explains it. Browser Web Speech API provides Hindi/English voice input where supported.
- Simulated offer creation is connected to the backend endpoint. Shipment, payment, blockchain, WhatsApp, and external government data remain demo states.
- Warm earthy interface: Outfit headings, DM Sans body, forest green, sage, terracotta, responsive sidebar and cardless content bands.

## Core requirements (static)
1. Farmer can enter crop, quantity, location, quality, and timeline.
2. The system ranks market options using expected net realisation, not headline price.
3. Every recommendation shows a transparent cost breakdown.
4. Sell-now and store-and-sell are compared with storage and expected spoilage included.
5. Farmer explicitly selects an option before an offer is created.
6. Buyer, FPO, and Admin role views are available from the first screen.
7. English/Hindi switching and text/voice assistant controls are visible.
8. AI never autonomously sells produce.

## Implemented — 2026-09-18
- Built role-based AgriSutra dashboard with Farmer, Buyer, FPO, and Admin views.
- Built guided farmer selling journey with controlled analysis endpoint and responsive comparison results.
- Added transparent market, buyer, transport, commission, packaging, storage, and loss calculations.
- Added sell-now versus store comparison and top recommendation confidence indicator.
- Added GPT-5.4 streaming Sathi chat endpoint with backend context and graceful fallback.
- Added Hindi UI toggle, Hindi voice locale, browser voice input control, and voice-ready visual state.
- Added offer modal, backend offer creation, and simulated next-step confirmation.
- Added visual alerts, lot journey timeline, verification/trust cues, and mobile responsive layout.
- Verified frontend production build, backend compilation, dashboard/analyze/offer APIs, and automated end-to-end flows.

## Prioritized backlog
### P0 — next for a production pilot
- Persist farmers, buyers, lots, offers, and transactions in MongoDB instead of controlled response fixtures.
- Add real authentication and permissions for the four roles.
- Connect verified market and demand feeds after credentials and data contracts are confirmed.
- Replace simulated shipment and payment milestones with provider-backed workflows.

### P1 — trust and adoption
- Add quality inspection upload, attestation records, lot passport, and dispute workflow.
- Add logistics route provider and real transport quotes.
- Add storage facility inventory and spoilage calibration by crop and location.
- Add actual WhatsApp Cloud API delivery and notification preferences.
- Add FPO aggregation, farmer onboarding, and buyer offer comparison screens.

### P2 — intelligence and scale
- Add outcome tracking with predicted-versus-actual realisation.
- Add historical price charts, forecasting ranges, and confidence calibration.
- Add regional language translation, speech-to-text, text-to-speech, and OCR provider integrations.
- Add EVM testnet audit recording after the transaction data model is persisted.
- Add admin analytics, anomaly review, ratings, and dispute resolution reporting.

## Next tasks
1. Introduce persisted domain models and role-aware auth.
2. Add real market/demand integration behind the existing analysis contract.
3. Complete shipment/payment state transitions and transaction history.