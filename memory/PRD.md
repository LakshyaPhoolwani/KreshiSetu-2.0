# KrishiSetu — Product Record

## Original problem statement
Build an agricultural marketplace platform for farmers, buyers, FPOs/cooperatives, admins, quality assessors and logistics providers with: farmer/buyer profiles, crop lots, quality verification, market/buyer discovery, deterministic **net-realisation** calculations, sell-now-vs-store analysis, offers, logistics, storage, payments, blockchain audit trail, alerts, WhatsApp, regional-language voice, analytics, and AI decision support. The MVP vertical slice is the guided farmer journey: crop entry → AI collection → market & buyer analysis → net-realisation → sell/store comparison → top 3 recommendations → farmer selects → offer → transaction. The farmer remains the final decision-maker; AI only explains backend-calculated numbers.

## Stack (locked with user this iteration)
- **Backend**: Node.js + Express + Prisma + PostgreSQL 15 (local, on :5432)
- **Deployment**: FastAPI `server.py` retained on :8001 as async reverse proxy → spawns Node backend on :8002, so `/api/*` ingress + `REACT_APP_BACKEND_URL` remain intact (supervisor conf is read-only)
- **Auth**: JWT (access 15m + refresh 7d), bcryptjs hashing, cookies + Authorization Bearer both accepted
- **Financial math**: `decimal.js` end-to-end; `Decimal` fields in Prisma; no floats
- **AI**: GPT-5.4 via Emergent LLM key, strictly grounded in backend calculation context; deterministic fallback if LLM unreachable
- **Frontend**: React 19 + react-router-dom v7 + axios + framer-motion, warm earthy palette (forest #1E5128, sage, terracotta)

## Personas
- **Farmer** (Rajesh Patil, Priya Kadam): wants the fair price after every cost, in a language they trust.
- **Buyer** (FreshCart, Harbor, GreenBasket): posts demand once and gets matched to verified lots.
- **FPO / Cooperative** (Nashik collective): aggregates farmers, compares buyer offers collectively.
- **Admin**: verifies users, monitors transactions, reviews the audit trail.
- **Quality assessor / Logistics provider**: roles reserved in schema; UIs deferred to P2.

## Architecture (this iteration)
- Prisma schema at `/app/node_backend/prisma/schema.prisma` — User + Farmer/Farm/FPO/Buyer/BuyerDemand/Market/MarketPrice/Lot/Recommendation/BuyerMatch/Offer/Transaction/Shipment/Payment/BlockchainEvent/Conversation/Message/Notification/AuditLog.
- Enums for Role, LotStatus, OfferStatus, TransactionStatus, ShipmentStatus, PaymentStatus, RecommendationType.
- Deterministic services: `services/netRealisation.js` (Decimal math + haversine), `services/recommendations.js` (buyer + market options, top-3 + store option, persistence), `services/aiChat.js` (LLM + deterministic fallback).
- API surface:
  - Legacy compat (anonymous, backwards-compatible with old FastAPI shapes): `GET /api/dashboard`, `POST /api/analyze`, `POST /api/offers`, `GET /api/role/:role`, `POST /api/assistant/chat` (SSE), `/api/status`.
  - New authed v1: `/api/v1/auth/{register,login,logout,me,refresh}`, `/api/v1/farmers/me`, `/api/v1/lots`, `/api/v1/markets`, `/api/v1/buyers/demand`, `/api/v1/recommendations/lot/:id`, `/api/v1/offers` (incl. `/:id/accept`, `/:id/reject`), `/api/v1/transactions` (incl. `/:id/shipment/advance`, `/:id/payment/settle`), `/api/v1/dashboard`, `/api/v1/ai/chat`.
- Frontend routes: `/`, `/login`, `/register`, `/app` (role-based dashboard), `/app/sell`, `/app/lots`, `/app/lots/:id`, `/app/transactions`, `/app/demands`, `/app/matches`, `/app/offers`, `/app/farmers`, `/app/users`.

## Implemented — 2026-02
- **Full backend migration** from FastAPI/Mongo demo to Node/Express/Prisma/PostgreSQL with real persistence.
- **JWT auth + RBAC** with seeded demo users per role (see `/app/memory/test_credentials.md`).
- **Farmer flow (P0)**: create lot → auto-compute top 3 recommendations + store-vs-sell → view breakdown → create offer → accept → transaction lifecycle → mock shipment advance → mock payment settle → audit events.
- **Deterministic net-realisation engine** (Decimal): revenue − transport − commission − packaging − spoilage − storage − other, with quality multipliers and confidence scoring.
- **Buyer flow (P0)**: register/login, post demand, see matches, offers list.
- **FPO overview (P0)**: farmers list, aggregated lots.
- **Admin overview (P0)**: totals + recent transactions.
- **AI Sathi (P0)**: `/api/v1/ai/chat` + legacy SSE, uses backend analysis as strict context, never invents numbers.
- **Landing (P0)**: marketing hero pulls live legacy `/api/dashboard` so demo values displayed on the landing card are actually computed.
- **Server-side ownership enforcement** for lot detail, recommendations recompute, direct recommendations endpoint, and AI chat with `lotId`.
- **Legacy compatibility layer** so anonymous demo endpoints continue to work identically (old shapes preserved).

## Prioritized backlog
### P1 — trust & adoption
- Multi-lot offer negotiation UI (counter-offer flow), quality attestation upload + lot passport, dispute workflow.
- Real logistics/route provider (Google Maps distance/travel time).
- Storage facility inventory + per-crop spoilage calibration.
- Real Razorpay test integration behind the payment provider abstraction.
- FPO buyer-offer comparison across member lots; farmer onboarding flow.
- WhatsApp Cloud API delivery + notification preferences.

### P2 — intelligence & scale
- Predicted-vs-actual outcome tracking.
- Historical price charts + forecast ranges + confidence calibration.
- Bhashini ASR/TTS/translation/OCR.
- Real EVM testnet recording behind blockchain provider abstraction (ethers) — only when RPC/key are configured.
- Admin analytics, anomaly review, rating and dispute resolution reporting.

### P3 — polish
- Live e-NAM/Agmarknet integration once credentials/data contract confirmed.
- Voice-first Sathi drawer with realtime dictation + TTS in Hindi.
- Multi-tenant FPO admin.

## Next tasks
1. Wire Google Maps for real distance/travel time (behind service adapter).
2. Replace mock payment with Razorpay test provider.
3. Ship live blockchain provider (ethers) with clear on/off switch.
4. Add quality attestation upload + lot passport view.
5. FPO offer-comparison workspace.
