"""KrishiSetu iteration 3 tests: quality assessor, logistics provider, market ticker, RBAC."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

CREDS = {
    "farmer": ("rajesh@krishisetu.dev", "farmer123"),
    "buyer": ("freshcart@krishisetu.dev", "buyer123"),
    "fpo": ("fpo@krishisetu.dev", "fpo123"),
    "admin": ("admin@krishisetu.dev", "admin123"),
    "quality": ("quality@krishisetu.dev", "quality123"),
    "logistics": ("logistics@krishisetu.dev", "logistics123"),
}


def _login(email, pw):
    return requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": email, "password": pw}, timeout=30)


@pytest.fixture(scope="session")
def tokens():
    out = {}
    for role, (e, p) in CREDS.items():
        r = _login(e, p)
        assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
        out[role] = r.json()
    return out


def _h(t):
    return {"Authorization": f"Bearer {t['accessToken']}"}


# ---------- Market ticker (anonymous) ----------
def test_market_ticker_anonymous():
    r = requests.get(f"{BASE_URL}/api/market-ticker", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("demo") is True
    assert "items" in d and isinstance(d["items"], list) and len(d["items"]) >= 1
    assert "notice" in d
    it = d["items"][0]
    for k in ("crop", "market", "pricePerQuintal"):
        assert k in it, f"missing {k} in ticker item"
    assert it.get("isDemo") is True


def test_market_ticker_filter():
    r = requests.get(f"{BASE_URL}/api/market-ticker?crop=Onion", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for it in d["items"]:
        assert it["crop"].lower() == "onion"


# ---------- New role logins ----------
def test_new_users_login(tokens):
    assert tokens["quality"]["user"]["role"] == "QUALITY_ASSESSOR"
    assert tokens["logistics"]["user"]["role"] == "LOGISTICS_PROVIDER"


def test_existing_users_login(tokens):
    for k in ("farmer", "buyer", "fpo", "admin"):
        assert "accessToken" in tokens[k]


# ---------- Quality dashboard/queue/attest ----------
def test_quality_dashboard(tokens):
    r = requests.get(f"{BASE_URL}/api/v1/dashboard", headers=_h(tokens["quality"]), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "stats" in d
    stats = d["stats"]
    for k in ("awaitingAttestation", "totalInQueue", "attestedByMe"):
        assert k in stats
    assert "queue" in d


def test_quality_queue_rbac(tokens):
    r = requests.get(f"{BASE_URL}/api/v1/quality/queue", headers=_h(tokens["quality"]), timeout=30)
    assert r.status_code == 200
    d = r.json()
    items = d if isinstance(d, list) else d.get("lots") or d.get("queue") or []
    assert isinstance(items, list)
    # farmer -> 403
    r2 = requests.get(f"{BASE_URL}/api/v1/quality/queue", headers=_h(tokens["farmer"]), timeout=30)
    assert r2.status_code == 403


def test_quality_attest_flow(tokens):
    q = requests.get(f"{BASE_URL}/api/v1/quality/queue", headers=_h(tokens["quality"]), timeout=30).json()
    items = q if isinstance(q, list) else q.get("lots") or q.get("queue") or []
    if not items:
        pytest.skip("no lots in quality queue")
    lot = items[0]
    lot_id = lot.get("id")
    payload = {"quality": "Grade A", "qualityConfidence": 97, "notes": "TEST attestation"}
    r = requests.post(f"{BASE_URL}/api/v1/quality/lots/{lot_id}/attest", headers=_h(tokens["quality"]), json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    updated = body.get("lot", body)
    assert (updated.get("quality") == "Grade A") or (updated.get("qualityConfidence") in (97, 97.0))
    # farmer 403
    r2 = requests.post(f"{BASE_URL}/api/v1/quality/lots/{lot_id}/attest", headers=_h(tokens["farmer"]), json=payload, timeout=30)
    assert r2.status_code == 403


def test_quality_history(tokens):
    r = requests.get(f"{BASE_URL}/api/v1/quality/history", headers=_h(tokens["quality"]), timeout=30)
    assert r.status_code == 200
    d = r.json()
    items = d if isinstance(d, list) else d.get("history") or d.get("logs") or []
    assert isinstance(items, list)


# ---------- Logistics dashboard/queue ----------
def test_logistics_dashboard(tokens):
    r = requests.get(f"{BASE_URL}/api/v1/dashboard", headers=_h(tokens["logistics"]), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "stats" in d
    for k in ("pending", "inTransit", "assigned"):
        assert k in d["stats"]
    assert "shipments" in d


def test_logistics_queue_rbac(tokens):
    r = requests.get(f"{BASE_URL}/api/v1/logistics/queue", headers=_h(tokens["logistics"]), timeout=30)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/v1/logistics/queue", headers=_h(tokens["farmer"]), timeout=30)
    assert r2.status_code == 403


# ---------- Logistics status update: need to create a shipment via offer accept ----------
def _get_or_create_shipment(tokens):
    # Try to fetch existing pending shipment
    q = requests.get(f"{BASE_URL}/api/v1/logistics/queue", headers=_h(tokens["logistics"]), timeout=30).json()
    ships = q if isinstance(q, list) else q.get("shipments") or q.get("queue") or []
    if ships:
        return ships[0].get("id")
    # Create: farmer accepts offer on buyer's demand
    lots = requests.get(f"{BASE_URL}/api/v1/lots", headers=_h(tokens["farmer"]), timeout=30).json()
    lots = lots if isinstance(lots, list) else lots.get("lots", [])
    lot_id = lots[0]["id"]
    demands = requests.get(f"{BASE_URL}/api/v1/buyers/demand", headers=_h(tokens["buyer"]), timeout=30).json()
    demands = demands if isinstance(demands, list) else demands.get("demands", [])
    if not demands:
        # create a demand
        requests.post(f"{BASE_URL}/api/v1/buyers/demand", headers=_h(tokens["buyer"]),
                      json={"crop": "Onion", "quantityQuintals": 50, "minQuality": "Grade A",
                            "location": "Nashik", "pricePerQuintal": 2500, "requiredBy": "2026-06-01"}, timeout=30)
        demands = requests.get(f"{BASE_URL}/api/v1/buyers/demand", headers=_h(tokens["buyer"]), timeout=30).json()
        demands = demands if isinstance(demands, list) else demands.get("demands", [])
    demand_id = demands[0]["id"]
    off = requests.post(f"{BASE_URL}/api/v1/offers", headers=_h(tokens["farmer"]),
                       json={"lotId": lot_id, "demandId": demand_id}, timeout=45).json()
    off = off.get("offer", off)
    oid = off.get("id")
    if not oid:
        return None
    acc = requests.post(f"{BASE_URL}/api/v1/offers/{oid}/accept", headers=_h(tokens["farmer"]), timeout=45).json()
    # Refetch logistics queue
    q2 = requests.get(f"{BASE_URL}/api/v1/logistics/queue", headers=_h(tokens["logistics"]), timeout=30).json()
    ships = q2 if isinstance(q2, list) else q2.get("shipments") or q2.get("queue") or []
    return ships[0].get("id") if ships else None


def test_logistics_status_update(tokens):
    sid = _get_or_create_shipment(tokens)
    if not sid:
        pytest.skip("could not create shipment")
    # RBAC: buyer/farmer 403
    r_bad = requests.post(f"{BASE_URL}/api/v1/logistics/shipments/{sid}/status",
                          headers=_h(tokens["buyer"]), json={"status": "ASSIGNED"}, timeout=30)
    assert r_bad.status_code == 403
    r_bad2 = requests.post(f"{BASE_URL}/api/v1/logistics/shipments/{sid}/status",
                           headers=_h(tokens["farmer"]), json={"status": "ASSIGNED"}, timeout=30)
    assert r_bad2.status_code == 403
    # Logistics advance
    r = requests.post(f"{BASE_URL}/api/v1/logistics/shipments/{sid}/status",
                      headers=_h(tokens["logistics"]), json={"status": "ASSIGNED"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    ship = body.get("shipment", body)
    assert ship.get("status") == "ASSIGNED"


# ---------- Regression: legacy dashboard + ownership fix ----------
def test_legacy_dashboard_regression():
    r = requests.get(f"{BASE_URL}/api/dashboard", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "farmer" in d and "analysis" in d
    top = d["analysis"].get("topThree") or d["analysis"].get("options") or []
    assert len(top) >= 1


def test_ownership_fix_regression(tokens):
    # Create a fresh lot the buyer has no offer on
    payload = {"crop": "Potato", "quantityQuintals": 30, "quality": "Grade B",
               "pickupLocation": "Pune", "timeline": "immediate"}
    cr = requests.post(f"{BASE_URL}/api/v1/lots", headers=_h(tokens["farmer"]), json=payload, timeout=45).json()
    lot = cr.get("lot", cr)
    lot_id = lot["id"]
    # buyer without offer -> 403
    r_b = requests.get(f"{BASE_URL}/api/v1/lots/{lot_id}", headers=_h(tokens["buyer"]), timeout=30)
    assert r_b.status_code == 403, f"expected 403 for buyer without offer, got {r_b.status_code}"
    # admin -> 200
    r_a = requests.get(f"{BASE_URL}/api/v1/lots/{lot_id}", headers=_h(tokens["admin"]), timeout=30)
    assert r_a.status_code == 200
    # owning farmer -> 200
    r_f = requests.get(f"{BASE_URL}/api/v1/lots/{lot_id}", headers=_h(tokens["farmer"]), timeout=30)
    assert r_f.status_code == 200


# ---------- AI chat still works ----------
def test_ai_chat_regression(tokens):
    lots = requests.get(f"{BASE_URL}/api/v1/lots", headers=_h(tokens["farmer"]), timeout=30).json()
    lots = lots if isinstance(lots, list) else lots.get("lots", [])
    lot_id = lots[0]["id"]
    r = requests.post(f"{BASE_URL}/api/v1/ai/chat", headers=_h(tokens["farmer"]),
                     json={"message": "What's my best deal?", "lotId": lot_id}, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "reply" in d
