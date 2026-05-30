"""Citation engine — extract [N] references from answers and map to source chunks."""
import re
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from rag.retriever import ScoredChunk


@dataclass
class Citation:
    index: int
    chunk_id: UUID
    document_id: UUID
    document_title: str
    document_filename: str
    page_number: Optional[int]
    excerpt: str


class CitationEngine:
    CITATION_PATTERN = re.compile(r'\[(\d+)\]')
    EXCERPT_LENGTH = 250

    def extract_citations(
        self,
        answer: str,
        chunks: list[ScoredChunk],
    ) -> tuple[str, list[Citation]]:
        """
        Find [N] references in the answer, map to source chunks.
        Returns (answer, citations_list).
        """
        referenced_indices = set(
            int(m) for m in self.CITATION_PATTERN.findall(answer)
        )

        citations = []
        for idx in sorted(referenced_indices):
            if 1 <= idx <= len(chunks):
                chunk = chunks[idx - 1]
                excerpt = chunk.content[:self.EXCERPT_LENGTH]
                if len(chunk.content) > self.EXCERPT_LENGTH:
                    excerpt += "..."
                citations.append(Citation(
                    index=idx,
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    document_title=chunk.document_title,
                    document_filename=chunk.file_name,
                    page_number=chunk.page_number,
                    excerpt=excerpt,
                ))

        return answer, citations
