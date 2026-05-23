# Summarice

A reading workspace for academic PDFs where users highlight passages, annotate them, and generate cited summaries.

## Language

### Highlights and annotations

**Highlight**:
A user-created mark on a PDF, either selected text or a rectangular area.

**Highlighted text**:
The extracted PDF text stored on a text highlight.

_Avoid_: Using this term for area highlights (they have no extracted text).

**Comment**:
A single optional note attached directly to a highlight.

_Avoid_: Calling this a "note" in product copy when you mean an annotation entry.

**Note**:
An annotation entry on a highlight; a highlight may have many notes, including AI interpretation.

_Avoid_: Using "note" for the highlight-level comment field.

### Search

**Fast library search**:
Cross-document highlight and summary retrieval on `/chat`, distinct from the in-document sidebar highlight filter.

**Sidebar highlight search**:
Filters highlights already loaded for the open document in the viewer sidebar.

### Flagged ambiguities

Some UI strings still say "note" for the highlight comment field (for example CommentForm placeholder "Optional note…"). Canonical terms are **Comment** (one per highlight) and **Note** (annotation entries).

## Example dialogue

**Dev**: Does sidebar search cover the popup comment?

**Expert**: Yes — that's the **Comment**. It also searches every **Note** on the highlight and the **Highlighted text** for text highlights.

**Dev**: Can I find an area highlight by its AI interpretation?

**Expert**: Yes. Area highlights have no **Highlighted text**, but their **Notes** (including AI) are searchable.
