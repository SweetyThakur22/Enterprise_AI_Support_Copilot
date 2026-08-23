"""RAG pipeline — document chunking, embedding, and semantic retrieval."""
import math
import re
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models.kb_chunk import KbChunk
from app.models.kb_document import KbDocument


# ──────────────────────────────────────────────
# Output type
# ──────────────────────────────────────────────

@dataclass
class RetrievedChunk:
    chunk_id: int
    document_id: int
    document_title: str
    content: str
    similarity: float
    chunk_index: int


# ──────────────────────────────────────────────
# Lazy-loaded model (singleton)
# ──────────────────────────────────────────────

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


def embed_text(text: str) -> list[float]:
    """Embed a single string using all-MiniLM-L6-v2."""
    return _get_model().encode(text, normalize_embeddings=True).tolist()


# ──────────────────────────────────────────────
# Text chunking
# ──────────────────────────────────────────────

def chunk_text(content: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split content into overlapping word-count chunks, preserving sentence boundaries."""
    # Split into sentences on period/exclamation/question followed by whitespace or end
    sentences = re.split(r'(?<=[.!?])\s+', content.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks: list[str] = []
    current_words: list[str] = []
    overlap_words: list[str] = []

    for sentence in sentences:
        words = sentence.split()
        current_words.extend(words)
        if len(current_words) >= chunk_size:
            chunk_text_str = ' '.join(current_words)
            chunks.append(chunk_text_str)
            # Keep last `overlap` words for next chunk
            overlap_words = current_words[-overlap:]
            current_words = list(overlap_words)

    # Add remaining words as the final chunk
    if current_words:
        chunk_text_str = ' '.join(current_words)
        if chunks and chunk_text_str == ' '.join(overlap_words):
            pass  # pure overlap leftover — skip
        else:
            chunks.append(chunk_text_str)

    return chunks if chunks else [content.strip()]


# ──────────────────────────────────────────────
# DB operations
# ──────────────────────────────────────────────

def embed_document(db: Session, document_id: int) -> int:
    """Chunk and embed a KB document; delete old chunks first. Returns chunk count."""
    doc = db.query(KbDocument).filter(KbDocument.id == document_id).first()
    if not doc:
        raise ValueError(f"Document {document_id} not found")

    # Remove existing chunks
    db.query(KbChunk).filter(KbChunk.document_id == document_id).delete()
    db.flush()

    chunks = chunk_text(doc.content)
    for i, text in enumerate(chunks):
        embedding = embed_text(text)
        chunk = KbChunk(
            document_id=document_id,
            chunk_index=i,
            content=text,
            embedding=embedding,
        )
        db.add(chunk)

    db.commit()
    return len(chunks)


def embed_all_documents(db: Session) -> dict[int, int]:
    """Embed all KB documents. Returns {document_id: chunk_count}."""
    docs = db.query(KbDocument).all()
    result = {}
    for doc in docs:
        count = embed_document(db, doc.id)
        result[doc.id] = count
    return result


# ──────────────────────────────────────────────
# Cosine similarity (Python fallback for SQLite)
# ──────────────────────────────────────────────

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _retrieve_python(db: Session, query_embedding: list[float], k: int) -> list[RetrievedChunk]:
    """Pure-Python cosine similarity retrieval — used when pgvector unavailable."""
    chunks = db.query(KbChunk).filter(KbChunk.embedding.isnot(None)).all()
    scored: list[tuple[float, KbChunk]] = []
    for chunk in chunks:
        emb = chunk.embedding
        if emb is None:
            continue
        if isinstance(emb, (list, tuple)):
            emb_list = list(emb)
        else:
            emb_list = list(emb)
        sim = _cosine_similarity(query_embedding, emb_list)
        scored.append((sim, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:k]

    results: list[RetrievedChunk] = []
    for sim, chunk in top:
        doc = db.query(KbDocument).filter(KbDocument.id == chunk.document_id).first()
        results.append(RetrievedChunk(
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            document_title=doc.title if doc else "Unknown",
            content=chunk.content,
            similarity=round(sim, 4),
            chunk_index=chunk.chunk_index,
        ))
    return results


def _retrieve_pgvector(db: Session, query_embedding: list[float], k: int) -> list[RetrievedChunk]:
    """pgvector cosine similarity retrieval for PostgreSQL."""
    from sqlalchemy import text
    sql = text("""
        SELECT kc.id, kc.document_id, kc.chunk_index, kc.content,
               1 - (kc.embedding <=> CAST(:emb AS vector)) AS similarity,
               kd.title
        FROM kb_chunks kc
        JOIN kb_documents kd ON kd.id = kc.document_id
        WHERE kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> CAST(:emb AS vector)
        LIMIT :k
    """)
    emb_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
    rows = db.execute(sql, {'emb': emb_str, 'k': k}).fetchall()

    results: list[RetrievedChunk] = []
    for row in rows:
        results.append(RetrievedChunk(
            chunk_id=row.id,
            document_id=row.document_id,
            document_title=row.title,
            content=row.content,
            similarity=round(float(row.similarity), 4),
            chunk_index=row.chunk_index,
        ))
    return results


def retrieve(db: Session, query: str, k: int = 5) -> list[RetrievedChunk]:
    """Retrieve top-k KB chunks most similar to query. Never fabricates results."""
    query_embedding = embed_text(query)
    bind = db.get_bind()
    dialect = bind.dialect.name if bind else 'sqlite'
    if dialect == 'postgresql':
        try:
            return _retrieve_pgvector(db, query_embedding, k)
        except Exception:
            return _retrieve_python(db, query_embedding, k)
    return _retrieve_python(db, query_embedding, k)
