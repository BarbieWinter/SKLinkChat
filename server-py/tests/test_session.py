def test_create_session_returns_non_empty_session_id(client):
    response = client.post("/api/session")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"session_id"}
    assert isinstance(body["session_id"], str)
    assert body["session_id"].strip() != ""


def test_create_session_returns_distinct_ids_across_calls(client):
    first_response = client.post("/api/session")
    second_response = client.post("/api/session")

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    first_session_id = first_response.json()["session_id"]
    second_session_id = second_response.json()["session_id"]

    assert isinstance(first_session_id, str)
    assert isinstance(second_session_id, str)
    assert first_session_id.strip() != ""
    assert second_session_id.strip() != ""
    assert first_session_id != second_session_id
