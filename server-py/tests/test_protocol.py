from app.shared.protocol import PayloadType, UserState


def test_user_state_enum_values_match_protocol_contract():
    assert UserState.IDLE.value == "idle"
    assert UserState.SEARCHING.value == "searching"
    assert UserState.CONNECTED.value == "connected"


def test_payload_type_values_cover_active_live_events():
    active_payload_values = {payload_type.value for payload_type in PayloadType}

    assert active_payload_values == {
        "message",
        "user-info",
        "error",
        "queue",
        "match",
        "disconnect",
        "typing",
    }
