"""Seed the four demo users (one per role)."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole

DEMO_USERS = [
    {
        "email": "admin@copilot.dev",
        "password": "Admin123!",
        "full_name": "Alice Admin",
        "role": UserRole.ADMIN,
    },
    {
        "email": "engineer@copilot.dev",
        "password": "Engineer123!",
        "full_name": "Eve Engineer",
        "role": UserRole.SUPPORT_ENGINEER,
    },
    {
        "email": "manager@copilot.dev",
        "password": "Manager123!",
        "full_name": "Mike Manager",
        "role": UserRole.INCIDENT_MANAGER,
    },
    {
        "email": "viewer@copilot.dev",
        "password": "Viewer123!",
        "full_name": "Victor Viewer",
        "role": UserRole.VIEWER,
    },
]


def seed_users() -> None:
    db = SessionLocal()
    try:
        created = 0
        for u in DEMO_USERS:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                print(f"  [skip] {u['email']} already exists")
                continue
            user = User(
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
                is_active=True,
            )
            db.add(user)
            created += 1
            print(f"  [+] {u['email']} ({u['role'].value})")
        db.commit()
        print(f"Users seeded: {created} created, {len(DEMO_USERS) - created} skipped")
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding demo users...")
    seed_users()
    print("Done.")
