"""KrishiSetu backend regression tests (Node/Express/Prisma via FastAPI proxy)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://farmer-best-deal.preview.emergentagent.com").rstrip("/")

FARMER_EMAIL = "rajesh@krishisetu.dev"
FARMER_PW = "farmer123"
BUYER_EMAIL = "freshcart@krishisetu.dev"
BUYER_PW = "buyer123"
ADMIN_EMAIL = "admin@krishisetu.dev"
ADMIN_PW = "admin123"


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": email, "password": pw}, timeout=30)
    return r


@pytest.fixture(scope="session")
def farmer_tokens():
    r = _login(FARMER_EMAIL, FARMER_PW)
    assert r.status_code == 200, f"farmer login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def buyer_tokens():
    r = _login(BUYER_EMAIL, BUYER_PW)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def admin_tokens():
    r = _login(ADMIN_EMAIL, ADMIN_PW)
    assert r.status_code == 200
    return r.json()


def _h(tokens):
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


# ---------- Health / Legacy ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d.get("status") == "ok"
    assert d.get("db") == "up"
    assert d.get("service") == "krishisetu-node"


def test_legacy_dashboard():
    r = requests.get(f"{BASE_URL}/api/dashboard", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "farmer" in d and "analysis" in d


def test_legacy_analyze():
    payload = {"crop": "Onion", "quantity": 120, "quality": "Grade A", "location": "Nashik", "timeline": "immediate"}
    r = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "options" in d or "topThree" in d or "recommended" in d
    # Store or recommended present
    assert any(k in d for k in ("store", "storeOption"))


def test_legacy_offers():
    # Need an option_id from analyze
    payload = {"crop": "Onion", "quantity": 120, "quality": "Grade A", "location": "Nashik", "timeline": "immediate"}
    a = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=30).json()
    opts = a.get("options") or a.get("topThree") or []
    assert len(opts) >= 1
    opt_id = opts[0].get("id") or opts[0].get("recommendationId") or opts[0].get("optionId")
    r = requests.post(f"{BASE_URL}/api/offers", json={"option_id": opt_id, "farmer": "Rajesh"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    assert "id" in d and "status" in d


def test_legacy_assistant_sse():
    with requests.post(f"{BASE_URL}/api/assistant/chat", json={"message": "hello"}, stream=True, timeout=45) as r:
        assert r.status_code == 200
        body = b""
        for chunk in r.iter_content(chunk_size=256):
            body += chunk
            if b"[DONE]" in body:
                break
        assert b"data:" in body
        assert b"[DONE]" in body


# ---------- Auth ----------
def test_register_and_duplicate():
    email = f"TEST_{int(time.time())}@example.com"
    payload = {"email": email, "password": "TestPass123!", "name": "Test User", "role": "FARMER", "phone": "9999999999"}
    r = requests.post(f"{BASE_URL}/api/v1/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    assert "accessToken" in d
    # Duplicate
    r2 = requests.post(f"{BASE_URL}/api/v1/auth/register", json=payload, timeout=30)
    assert r2.status_code == 409


def test_login_wrong_password():
    r = _login(FARMER_EMAIL, "wrongpass")
    assert r.status_code == 401


def test_auth_me_and_refresh(farmer_tokens):
    r = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=_h(farmer_tokens), timeout=30)
    assert r.status_code == 200
    assert r.json().get("user", r.json()).get("email") == FARMER_EMAIL or r.json().get("email") == FARMER_EMAIL

    r2 = requests.get(f"{BASE_URL}/api/v1/auth/me", timeout=30)
    assert r2.status_code == 401

    rt = farmer_tokens.get("refreshToken")
    r3 = requests.post(f"{BASE_URL}/api/v1/auth/refresh", json={"refreshToken": rt}, timeout=30)
    assert r3.status_code == 200
    assert "accessToken" in r3.json()


# ---------- Farmer dashboard & lots ----------
def test_farmer_dashboard(farmer_tokens):
    r = requests.get(f"{BASE_URL}/api/v1/dashboard", headers=_h(farmer_tokens), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for key in ("farmer", "stats", "lots", "analysis"):
        assert key in d, f"missing {key}"
    assert d.get("activeLot", {}).get("code") == "LOT-2409-0001" or d.get("activeLot", {}).get("lotCode") == "LOT-2409-0001"
    top = d["analysis"].get("topThree") or d["analysis"].get("options") or []
    assert len(top) == 3
    assert "storeOption" in d["analysis"]


def test_farmer_lots_list(farmer_tokens):
    r = requests.get(f"{BASE_URL}/api/v1/lots", headers=_h(farmer_tokens), timeout=30)
    assert r.status_code == 200
    d = r.json()
    lots = d if isinstance(d, list) else d.get("lots", [])
    assert len(lots) >= 1


def test_farmer_lot_detail_and_403(farmer_tokens, buyer_tokens):
    r = requests.get(f"{BASE_URL}/api/v1/lots", headers=_h(farmer_tokens), timeout=30).json()
    lots = r if isinstance(r, list) else r.get("lots", [])
    lot_id = lots[0].get("id")
    d = requests.get(f"{BASE_URL}/api/v1/lots/{lot_id}", headers=_h(farmer_tokens), timeout=30)
    assert d.status_code == 200
    body = d.json()
    lot = body.get("lot", body)
    # recommendations/offers/transactions expected
    assert any(k in body for k in ("recommendations", "offers", "transactions")) or any(k in lot for k in ("recommendations", "offers"))

    # buyer trying farmer's lot -> 403
    r2 = requests.get(f"{BASE_URL}/api/v1/lots/{lot_id}", headers=_h(buyer_tokens), timeout=30)
    assert r2.status_code in (401, 403)


def test_create_lot_and_recompute(farmer_tokens):
    payload = {
        "crop": "Tomato",
        "quantityQuintals": 40,
        "quality": "Grade B",
        "pickupLocation": "Pune",
        "timeline": "immediate",
    }
    r = requests.post(f"{BASE_URL}/api/v1/lots", headers=_h(farmer_tokens), json=payload, timeout=45)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    lot = body.get("lot", body)
    lot_id = lot.get("id")
    recs = body.get("recommendations", {})
    top = recs.get("topThree") or body.get("topThree") or []
    assert len(top) >= 1

    r2 = requests.post(f"{BASE_URL}/api/v1/lots/{lot_id}/recommendations", headers=_h(farmer_tokens), timeout=45)
    assert r2.status_code == 200
    d = r2.json()
    top2 = d.get("topThree") or d.get("recommendations", {}).get("topThree", [])
    assert len(top2) >= 1
    assert "storeOption" in d or "storeOption" in d.get("recommendations", {})

    r3 = requests.get(f"{BASE_URL}/api/v1/recommendations/lot/{lot_id}", headers=_h(farmer_tokens), timeout=45)
    assert r3.status_code == 200
    dd = r3.json()
    # Check breakdown fields exist
    top3 = dd.get("topThree") or dd.get("recommendations", {}).get("topThree") or []
    if top3:
        br = top3[0].get("breakdown") or top3[0]
        for f in ("grossRevenue", "transportCost", "commissionCost", "netRealisation"):
            assert f in br, f"missing breakdown field {f}"


# ---------- Markets ----------
def test_markets(farmer_tokens):
    r = requests.get(f"{BASE_URL}/api/v1/markets", headers=_h(farmer_tokens), timeout=30)
    assert r.status_code == 200
    d = r.json()
    mkts = d if isinstance(d, list) else d.get("markets", [])
    assert len(mkts) >= 4
    r2 = requests.get(f"{BASE_URL}/api/v1/markets/prices?crop=Onion", headers=_h(farmer_tokens), timeout=30)
    assert r2.status_code == 200


# ---------- Buyer demand & offers ----------
def test_buyer_demand(buyer_tokens):
    payload = {"crop": "Onion", "quantityQuintals": 50, "minQuality": "Grade A", "location": "Nashik", "pricePerQuintal": 2500, "requiredBy": "2026-03-01"}
    r = requests.post(f"{BASE_URL}/api/v1/buyers/demand", headers=_h(buyer_tokens), json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    r2 = requests.get(f"{BASE_URL}/api/v1/buyers/demand", headers=_h(buyer_tokens), timeout=30)
    assert r2.status_code == 200


def test_rbac(farmer_tokens, buyer_tokens):
    # Buyer cannot create lot
    r = requests.post(f"{BASE_URL}/api/v1/lots", headers=_h(buyer_tokens), json={"crop": "Onion", "quantityQuintals": 10, "quality": "Grade A", "pickupLocation": "Nashik", "timeline": "immediate"}, timeout=30)
    assert r.status_code == 403
    # Farmer cannot create demand
    r2 = requests.post(f"{BASE_URL}/api/v1/buyers/demand", headers=_h(farmer_tokens), json={"crop": "Onion", "quantityQuintals": 10, "minQuality": "Grade A", "location": "Nashik", "pricePerQuintal": 2500, "requiredBy": "2026-03-01"}, timeout=30)
    assert r2.status_code == 403


# ---------- Offer accept flow ----------
def test_offer_accept_flow(farmer_tokens, buyer_tokens):
    # Get farmer's seeded lot
    lots = requests.get(f"{BASE_URL}/api/v1/lots", headers=_h(farmer_tokens), timeout=30).json()
    lots = lots if isinstance(lots, list) else lots.get("lots", [])
    seeded = next((l for l in lots if (l.get("code") or l.get("lotCode")) == "LOT-2409-0001"), lots[0])
    lot_id = seeded["id"]

    # Get buyer's demand
    demands = requests.get(f"{BASE_URL}/api/v1/buyers/demand", headers=_h(buyer_tokens), timeout=30).json()
    demands = demands if isinstance(demands, list) else demands.get("demands", [])
    if not demands:
        pytest.skip("no buyer demand available")
    demand_id = demands[0]["id"]

    # Farmer creates offer with demandId
    r = requests.post(f"{BASE_URL}/api/v1/offers", headers=_h(farmer_tokens), json={"lotId": lot_id, "demandId": demand_id}, timeout=45)
    assert r.status_code in (200, 201), r.text
    offer = r.json().get("offer", r.json())
    offer_id = offer.get("id")
    assert offer_id

    # Accept
    r2 = requests.post(f"{BASE_URL}/api/v1/offers/{offer_id}/accept", headers=_h(farmer_tokens), timeout=45)
    assert r2.status_code == 200, r2.text
    resp = r2.json()
    tx = resp.get("transaction") or resp.get("tx") or {}
    tx_id = tx.get("id") if isinstance(tx, dict) else None

    # Transactions list
    r3 = requests.get(f"{BASE_URL}/api/v1/transactions", headers=_h(farmer_tokens), timeout=30)
    assert r3.status_code == 200
    txs = r3.json() if isinstance(r3.json(), list) else r3.json().get("transactions", [])
    assert len(txs) >= 1
    if not tx_id:
        tx_id = txs[0]["id"]

    # Advance shipment thrice
    for _ in range(4):
        rr = requests.post(f"{BASE_URL}/api/v1/transactions/{tx_id}/shipment/advance", headers=_h(farmer_tokens), timeout=30)
        if rr.status_code != 200:
            break
    # Settle payment
    rp = requests.post(f"{BASE_URL}/api/v1/transactions/{tx_id}/payment/settle", headers=_h(farmer_tokens), timeout=30)
    assert rp.status_code == 200, rp.text
    payload = rp.json()
    ref = str(payload)
    assert "MOCK-PAY" in ref or payload.get("payment", {}).get("reference", "").startswith("MOCK-PAY")


# ---------- AI chat ----------
def test_ai_chat(farmer_tokens):
    r = requests.post(f"{BASE_URL}/api/v1/ai/chat", headers=_h(farmer_tokens), json={"message": "Compare sell now vs store for me"}, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "reply" in d
    # Should mention a market name and net realisation (₹ or rupee number)
    reply = d["reply"].lower()
    assert any(m in reply for m in ("lasalgaon", "pune", "vashi", "nashik"))
