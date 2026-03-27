from __future__ import annotations


def _register(client):
    return client.post(
        "/api/auth/register",
        json={
            "email": "user@test.dev",
            "password": "CorrectHorseBatteryStaple!23",
            "display_name": "Traveler",
            "interests": ["music", "travel"],
            "captcha": {
                "lot_number": "lot-register",
                "captcha_output": "captcha-output",
                "pass_token": "pass-token",
                "gen_time": "2026-03-27T12:00:00Z",
            },
        },
    )


def _verify(client, email="user@test.dev") -> None:
    fake_sender = client.app.state.container.auth_service._email_sender
    code = [m for m in fake_sender.sent_messages if m.get("type") == "verification"][-1]["code"]
    verify_resp = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert verify_resp.status_code == 200


def test_get_account_profile_requires_authentication(client):
    response = client.get("/api/account/profile")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def test_get_and_update_account_profile(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    _verify(client)

    profile_response = client.get("/api/account/profile")
    assert profile_response.status_code == 200
    assert profile_response.json() == {
        "display_name": "Traveler",
        "interests": ["music", "travel"],
    }

    update_response = client.patch(
        "/api/account/profile",
        json={"display_name": "Nomad", "interests": ["books", "music", "books"]},
    )
    assert update_response.status_code == 200
    assert update_response.json() == {
        "display_name": "Nomad",
        "interests": ["books", "music"],
    }

    refreshed_profile = client.get("/api/account/profile")
    assert refreshed_profile.status_code == 200
    assert refreshed_profile.json() == {
        "display_name": "Nomad",
        "interests": ["books", "music"],
    }
