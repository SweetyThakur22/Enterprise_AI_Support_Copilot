"""Run all seed scripts in correct dependency order."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from data.seed_users import seed_users
from data.seed_incidents import seed_incidents
from data.seed_kb_documents import seed_kb_documents


def main() -> None:
    print("=" * 60)
    print("Enterprise AI Copilot — Database Seeder")
    print("=" * 60)

    print("\n[1/3] Seeding users...")
    seed_users()

    print("\n[2/3] Seeding incidents...")
    seed_incidents()

    print("\n[3/3] Seeding knowledge base documents...")
    seed_kb_documents()

    print("\n" + "=" * 60)
    print("Seeding complete.")
    print("Next step: run 'python data/embed_kb.py' to generate embeddings")
    print("=" * 60)


if __name__ == "__main__":
    main()
