"""Embed all KB documents into the kb_chunks table with pgvector embeddings."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.services import rag_service


def main():
    db = SessionLocal()
    try:
        print("Loading sentence-transformers model all-MiniLM-L6-v2...")
        rag_service._get_model()
        print("Model loaded.")

        print("Embedding all KB documents...")
        results = rag_service.embed_all_documents(db)
        total_chunks = sum(results.values())
        print(f"Done. Embedded {len(results)} documents into {total_chunks} chunks.")
        for doc_id, count in results.items():
            print(f"  Document {doc_id}: {count} chunks")

        # Verify retrieval
        print("\nVerifying retrieval with ORA-01652 query...")
        chunks = rag_service.retrieve(db, "ORA-01652 temp tablespace unable to extend", k=3)
        print(f"Retrieved {len(chunks)} chunks:")
        for c in chunks:
            print(f"  [{c.similarity:.4f}] {c.document_title} (chunk {c.chunk_index}): {c.content[:80]}...")

    finally:
        db.close()


if __name__ == "__main__":
    main()
