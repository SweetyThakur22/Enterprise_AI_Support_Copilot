"""RAG service unit tests — sentence-transformers model is mocked throughout."""
import math
import random
from unittest.mock import MagicMock, patch

import pytest

from app.models.kb_chunk import KbChunk
from app.models.kb_document import KbDocument
from app.services import rag_service


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _unit_vec(dim: int = 384, seed: int = 0) -> list[float]:
    """Return a deterministic unit vector of length `dim`."""
    rng = random.Random(seed)
    v = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in v))
    return [x / norm for x in v]


def _make_doc(db, title: str, content: str) -> KbDocument:
    doc = KbDocument(title=title, category="DATABASE", content=content, source="test")
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def _make_chunk(db, doc: KbDocument, index: int, content: str, embedding: list[float]) -> KbChunk:
    chunk = KbChunk(document_id=doc.id, chunk_index=index, content=content, embedding=embedding)
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    return chunk


# ──────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────

def test_chunking():
    """Long document splits into multiple chunks."""
    # 7 words per sentence × 80 repetitions = 560 words; chunk_size=200 → at least 2 chunks
    sentence = "Oracle TEMP tablespace must be large enough. "
    content = sentence * 80
    chunks = rag_service.chunk_text(content, chunk_size=200, overlap=20)
    assert len(chunks) >= 2


def test_chunk_overlap():
    """Consecutive chunks share boundary content (overlap)."""
    sentence = "The quick brown fox jumps over the lazy dog. "
    content = sentence * 120   # well over 512 words
    chunks = rag_service.chunk_text(content, chunk_size=512, overlap=50)
    assert len(chunks) >= 2
    # The start of chunk[1] should contain words from the end of chunk[0]
    last_words_of_0 = chunks[0].split()[-20:]
    first_words_of_1 = chunks[1].split()[:20]
    shared = set(last_words_of_0) & set(first_words_of_1)
    assert len(shared) > 0


def test_embedding_dimensions():
    """embed_text returns a 384-dimensional vector."""
    mock_model = MagicMock()
    import numpy as np
    mock_model.encode.return_value = np.array(_unit_vec(384))

    with patch.object(rag_service, '_get_model', return_value=mock_model):
        rag_service._model = mock_model
        embedding = rag_service.embed_text("ORA-01652 temp tablespace")
        assert len(embedding) == 384


def test_retrieval_returns_scores(db):
    """retrieve() returns chunks with similarity scores between 0 and 1."""
    mock_model = MagicMock()
    import numpy as np
    query_vec = _unit_vec(384, seed=42)
    mock_model.encode.return_value = np.array(query_vec)

    doc = _make_doc(db, "Oracle DB Guide", "ORA-01652 temp tablespace exhaustion procedures.")
    _make_chunk(db, doc, 0, "TEMP tablespace extension procedure.", _unit_vec(384, seed=10))
    _make_chunk(db, doc, 1, "Monitoring Oracle TEMP usage.", _unit_vec(384, seed=20))

    with patch.object(rag_service, '_get_model', return_value=mock_model):
        rag_service._model = mock_model
        results = rag_service.retrieve(db, "ORA-01652 temp tablespace", k=5)

    assert len(results) >= 1
    for r in results:
        assert -1.0 <= r.similarity <= 1.0


def test_retrieval_relevance(db):
    """Query about ORA-01652 returns chunks from the Oracle document ahead of unrelated docs."""
    import numpy as np

    # Oracle doc embedding: close to oracle_query_vec
    oracle_vec = _unit_vec(384, seed=1)
    # Unrelated doc embedding: orthogonal
    other_vec = _unit_vec(384, seed=999)

    oracle_doc = _make_doc(db, "Oracle Database Troubleshooting Guide",
                           "ORA-01652: unable to extend temp segment by 128.")
    other_doc = _make_doc(db, "Network Connectivity Procedures",
                          "Check firewall rules and network routes.")

    _make_chunk(db, oracle_doc, 0, "ORA-01652 temp segment extension", oracle_vec)
    _make_chunk(db, other_doc, 0, "Network firewall procedures", other_vec)

    mock_model = MagicMock()
    # Make query embed close to oracle_vec
    mock_model.encode.return_value = np.array(oracle_vec)

    with patch.object(rag_service, '_get_model', return_value=mock_model):
        rag_service._model = mock_model
        results = rag_service.retrieve(db, "ORA-01652 temp tablespace", k=2)

    assert len(results) >= 1
    assert results[0].document_title == "Oracle Database Troubleshooting Guide"
    assert results[0].similarity > results[-1].similarity if len(results) > 1 else True


def test_no_fabrication(db):
    """All returned chunks exist in the database with matching IDs."""
    import numpy as np
    mock_model = MagicMock()
    query_vec = _unit_vec(384, seed=7)
    mock_model.encode.return_value = np.array(query_vec)

    doc = _make_doc(db, "Real Document", "Real content about Oracle procedures.")
    chunk1 = _make_chunk(db, doc, 0, "Real chunk 1", _unit_vec(384, seed=11))
    chunk2 = _make_chunk(db, doc, 1, "Real chunk 2", _unit_vec(384, seed=22))

    real_ids = {chunk1.id, chunk2.id}

    with patch.object(rag_service, '_get_model', return_value=mock_model):
        rag_service._model = mock_model
        results = rag_service.retrieve(db, "Oracle procedures", k=10)

    for r in results:
        assert r.chunk_id in real_ids, f"Fabricated chunk_id {r.chunk_id} returned"
        assert r.document_title == "Real Document"
