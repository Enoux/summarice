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
Cross-document highlight and summary retrieval from the global navbar (compact trigger, expanded panel below the header), distinct from the in-document sidebar highlight filter. Fast and Deep library search modes share this panel; the Fast/Deep toggle sits in the filter-chip row.

**Deep library search**:
LLM-assisted cross-document retrieval for fuzzy, descriptive, or multi-hop prompts. It returns ranked navigable document/highlight results with short relevance reasons, using the highlight-anchored library corpus. Runs on explicit submit (Enter), not while typing.

**Summarice AI**:
Product label for enabling **Deep library search** in the global search panel toggle.

_Avoid_: Treating Deep library search as chat, multi-turn conversation, or cited answer generation.

**Search filter chip**:
UI control on fast library search that narrows the results dropdown client-side after a text query returns (not a server retrieval parameter). Disabled while Deep mode is active; chip values are preserved when switching back to Fast.

**Result scope**:
Chip setting on fast library search that controls which result lanes appear: both highlight and document lanes, highlights only, or documents only.

_Avoid_: Typing inline filter tokens (`doc:`, `color:`, `has:note`, `page:`) in the query field — use chips instead.

**Sidebar highlight search**:
Filters highlights already loaded for the open document in the viewer sidebar.

**Direct match**:
A highlight or note hit surfaced in the direct-matches lane of fast library search.

**Cited summary highlight**:
A highlight returned because the current summary cites it and the query matched that summary passage.

_Avoid_: "Summary match" in product copy.

**Related idea**:
A highlight surfaced by semantic similarity in fast library search, not by a direct lexical hit on the query.

**Document match**:
A document-level hit when a summary passage matched but had no local citations to map to highlights.

**Theme**:
A current summary tag that names a recurring idea in a document; surfaced as document-level search metadata.

**Key Entity**:
A current summary entity that names an important person, organization, model, method, or object in a document; surfaced as document-level search metadata.

**Recommended highlight**:
A recent cross-document highlight shown in fast library search before the user enters a query.

**Search result page preview**:
Pointer-hover preview of a PDF page for a fast or deep library search result on `/chat`; distinct from the in-document thumbnail panel.

**Search result selection**:
Choosing a fast or deep library search result immediately collapses the panel (query and filter chips are preserved) and navigates to the result's viewer destination (`/doc/{id}` or `/doc/{id}#highlight-{id}`).

### Flagged ambiguities

Some UI strings still say "note" for the highlight comment field (for example CommentForm placeholder "Optional note…"). Canonical terms are **Comment** (one per highlight) and **Note** (annotation entries).

## Example dialogue

**Dev**: Does sidebar search cover the popup comment?

**Expert**: Yes — that's the **Comment**. It also searches every **Note** on the highlight and the **Highlighted text** for text highlights.

**Dev**: Can I find an area highlight by its AI interpretation?

**Expert**: Yes. Area highlights have no **Highlighted text**, but their **Notes** (including AI) are searchable.

**Dev**: Is Deep search a chat answer?

**Expert**: No — **Deep library search** returns ranked highlights and documents you can open, each with a short reason. It does not generate a cited essay.
