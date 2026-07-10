# Semantic code search / RAG tooling (deferred)

**Status:** parked, 2026-07-10. Revisit when the codebase outgrows grep-scale (rough trigger: `src/` well past ~30k lines or recurring "where is the concept X handled" friction during epics).

## Decision

Do not build a vector-search tool for etersim now. At the current scale (~8k lines in `src/`, 72 files, vocabulary enforced by `CONTEXT.md`), lexical search (Grep/ripgrep) resolves both exact and conceptual queries reliably — an embedding index would add infrastructure without measurable retrieval gain. The context burn observed while implementing #80/#81 came from long implementation sessions re-reading files into one context window, not from failed code search; cheaper remedies are subagent fan-out and smaller work packages per session.

## Sketch for when we return

Consciously a learning/portfolio project (evals & context engineering), tested on etersim but designed to be portable to larger projects:

- **Shape:** standalone indexer + search CLI + a Claude Code skill that teaches invoking it; not coupled to etersim code.
- **Embeddings:** local via Ollama — `nomic-embed-text` as baseline (small, Apache 2.0); model behind a swappable `embed(texts) -> vectors` interface so Jina `jina-embeddings-v2-base-code`, Qodo-Embed or Voyage API (`voyage-code-3`, closed/API-only) can be compared.
- **Index:** start with plain JSON + brute-force cosine (fine below ~100k chunks); upgrade path sqlite-vec / LanceDB.
- **Chunking:** AST-boundary chunks for TS (function/class, e.g. via tree-sitter); heading-boundary for Markdown docs. Incremental re-index keyed on file hash.
- **Retrieval:** hybrid — BM25/ripgrep for lexical + embeddings for conceptual, merged.
- **Eval harness is part of the scope, not an add-on:** hand-labelled query→golden-files set over etersim; recall@K / MRR; the headline experiment is *local nomic vs API voyage vs plain grep* on the same query set.
