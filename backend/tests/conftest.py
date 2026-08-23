"""Shared pytest fixtures."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole

TEST_DB_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    # Reset rate limiter storage between tests
    try:
        from app.core.limiter import limiter
        limiter._storage.reset()
    except Exception:
        pass


@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    user = User(
        email="admin@test.com",
        hashed_password=hash_password("Admin123!"),
        full_name="Test Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def engineer_user(db):
    user = User(
        email="engineer@test.com",
        hashed_password=hash_password("Engineer123!"),
        full_name="Test Engineer",
        role=UserRole.SUPPORT_ENGINEER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def viewer_user(db):
    user = User(
        email="viewer@test.com",
        hashed_password=hash_password("Viewer123!"),
        full_name="Test Viewer",
        role=UserRole.VIEWER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(client, admin_user):
    res = client.post("/auth/login", json={"email": "admin@test.com", "password": "Admin123!"})
    return res.json()["access_token"]


@pytest.fixture
def engineer_token(client, engineer_user):
    res = client.post("/auth/login", json={"email": "engineer@test.com", "password": "Engineer123!"})
    return res.json()["access_token"]


@pytest.fixture
def viewer_token(client, viewer_user):
    res = client.post("/auth/login", json={"email": "viewer@test.com", "password": "Viewer123!"})
    return res.json()["access_token"]


@pytest.fixture
def manager_user(db):
    user = User(
        email="manager@test.com",
        hashed_password=hash_password("Manager123!"),
        full_name="Test Manager",
        role=UserRole.INCIDENT_MANAGER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def manager_token(client, manager_user):
    res = client.post("/auth/login", json={"email": "manager@test.com", "password": "Manager123!"})
    return res.json()["access_token"]
