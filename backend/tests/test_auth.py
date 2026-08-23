"""Auth endpoint tests."""


def test_login_success(client, engineer_user):
    res = client.post("/auth/login", json={"email": "engineer@test.com", "password": "Engineer123!"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "engineer@test.com"
    assert data["user"]["role"] == "SUPPORT_ENGINEER"
    assert "hashed_password" not in data["user"]


def test_login_wrong_password(client, engineer_user):
    res = client.post("/auth/login", json={"email": "engineer@test.com", "password": "wrongpassword"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post("/auth/login", json={"email": "nobody@test.com", "password": "Test123!"})
    assert res.status_code == 401


def test_protected_without_token(client):
    res = client.get("/auth/me")
    # HTTPBearer returns 403 when Authorization header is absent
    assert res.status_code in (401, 403)


def test_me_returns_current_user(client, engineer_token):
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "engineer@test.com"
    assert "hashed_password" not in data


def test_refresh_returns_new_token(client, engineer_token):
    res = client.post("/auth/refresh", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_viewer_cannot_analyze(client, viewer_token):
    res = client.post(
        "/incidents/INC-10492/analyze",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    # Incidents route not yet implemented → 404 is acceptable; 403 is also acceptable
    # What must NOT happen is 200 (access granted)
    assert res.status_code in (403, 404, 422)


def test_register_requires_admin(client, engineer_token):
    res = client.post(
        "/auth/register",
        json={"email": "new@test.com", "password": "New123!", "full_name": "New User"},
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert res.status_code == 403


def test_register_as_admin(client, admin_token):
    res = client.post(
        "/auth/register",
        json={"email": "new@test.com", "password": "NewPass123!", "full_name": "New User", "role": "VIEWER"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    assert res.json()["email"] == "new@test.com"


def test_duplicate_register(client, admin_token, engineer_user):
    res = client.post(
        "/auth/register",
        json={"email": "engineer@test.com", "password": "DupPass123!", "full_name": "Dup"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 409
