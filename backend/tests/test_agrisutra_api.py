"""Regression coverage for AgriSutra dashboard, analysis, offers, roles, and assistant APIs."""
import json
import os

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL is not configured", allow_module_level=True)
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def api():
    return requests.Session()


def test_dashboard_has_consistent_recommendation(api):
    response = api.get(f"{BASE_URL}/api/dashboard", timeout=20)
    assert response.status_code == 200
    data = response.json()
    assert data["farmer"]["crop"] == "Onion"
    assert data["analysis"]["recommended"]["net"] == max(
        option["net"] for option in data["analysis"]["options"]
    )
    assert data["analysis"]["sell_now_net"] == data["analysis"]["recommended"]["net"]


def test_analyze_quantity_changes_values_and_preserves_cost_fields(api):
    response = api.post(
        f"{BASE_URL}/api/analyze",
        json={"crop": "Onion", "quantity": 20, "location": "Nashik", "quality": "Grade A", "timeline": "Within 7 days"},
        timeout=20,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["input"]["quantity"] == 20
    assert len(data["options"]) == 3
    assert all(option["revenue"] > option["transport"] for option in data["options"])


def test_offer_creation_returns_simulated_offer(api):
    response = api.post(f"{BASE_URL}/api/offers", json={"option_id": "m1"}, timeout=20)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Offer sent"
    assert data["option_id"] == "m1"
    assert data["id"].startswith("OF-")


@pytest.mark.parametrize("role,expected", [("buyer", "3 matching lots"), ("fpo", "42 farmers onboarded"), ("admin", "128 verified users")])
def test_role_dashboard_returns_role_specific_items(api, role, expected):
    response = api.get(f"{BASE_URL}/api/role/{role}", timeout=20)
    assert response.status_code == 200
    assert expected in response.json()["items"]


def test_assistant_chat_returns_sse_done_and_text(api):
    response = api.post(
        f"{BASE_URL}/api/assistant/chat",
        json={"message": "Explain my best option", "context": {"quantity": 12}},
        timeout=60,
    )
    assert response.status_code == 200
    assert "data: [DONE]" in response.text
    events = [line[6:] for line in response.text.splitlines() if line.startswith("data: {")]
    assert events
    assert any(json.loads(event).get("text") for event in events)