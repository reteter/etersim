# Knowing is not binding — three failures from one session

Written at the owner's request at s14 close, *"so nothing gets lost."*

s14 resolved three sweep findings. Underneath them sat the same mechanism three times, in
three different disguises, and it is worth separating from the findings themselves — because
the findings are closed and the mechanism is not.

> **A system does not act on what it knows. It acts on what obliges it.**

Each section below is a case where the project **already held the correct knowledge**, in
writing, before the failure — and the knowledge changed nothing.

## 1. The remedy existed, dated five days earlier

Sweep **F5**: three Professor findings were parked in a design note behind prose triggers
("when #174/#177 are picked up", "post-E3 hygiene pass"). All three triggers fired. Nobody
noticed for five days. `HeadquartersPanel.tsx`, whose parked item was a hygiene cleave, **grew
from 493 to 605 lines while waiting** — the debt the pass was meant to retire compounded at
23% instead.

What makes this a systems failure rather than an oversight is what was already written:

- **#304**, dated 2026-07-19, states the remedy exactly: *"This issue holds the deferred half,
  **with its trigger**, so the deferral is a decision with a home rather than a note that
  decays."*
- **HANDOFF §Watch** had logged the symptom: *"Parked-in-a-lot-with-no-exit … **None have
  issues.** Sweep when planning M4."*

So the diagnosis and the cure were both on record, in two separate documents, correct and
unambiguous. The findings still rotted. Nothing in the repo converted either statement into
an obligation on anyone.

**What changed it:** a law with a detector — *a trigger is a promise, and promises live in the
issue tracker* (`WORKFLOW.md` §Documentation law, #327). Not because it is wiser than #304's
sentence. Because it is greppable, and because the design-notes index now has to ask the
question before a note may be marked HIST.

**The transferable point:** an insight recorded as prose is *information*. An insight recorded
with a detector and an owner is a *feedback loop*. Only the second one has gain. This project
is unusually good at producing the first and had almost no machinery for the second.

## 2. Fresh context is a risk factor, not a safeguard

Sweep **F10**: `PRD.md` cited **ADR-0004** as the authority for *"3D, direct combat"*. That ADR
is *Local persistence, no backend in v1* and contains neither.

The natural assumption — and the one F10 itself recorded — was **drift**: a decision that moved
while its citation stayed behind. The history says otherwise. `git show 37b5643:docs/PRD.md` —
the repository's **foundation commit** — already carries the identical six-item list crediting
ADR-0004, and **ADR-0004 was written in that same commit**, covering four of the six. The only
later edit changed *"Out of v1"* to *"Out of scope"*.

**The citation was never true.** It was written by an author who had both documents open, in
one sitting, with the whole design fresh in mind.

That is the uncomfortable part. We treat freshness as a proxy for correctness — *"I just wrote
both, of course they agree"* — when freshness is precisely the condition under which
verification feels redundant and therefore gets skipped. The cost of checking was never lower
than in that commit. It was skipped **because** it was cheap and obvious.

Generalised: **the moments when a cross-reference is cheapest to verify are the moments it is
least likely to be verified.** Every citation in this repo written during a single authoring
burst deserves the same suspicion as one written a year apart — arguably more.

## 3. Stating a defect does not confer immunity

The sharpest case, because it is self-inflicted and same-day.

Earlier in s14 the register `world-model-implications.md` was written. Its §Honest limits
contains this sentence, authored deliberately:

> **Pre-registered implications are forward-looking text** — the one kind that rots. W6/W7/W8
> must be attached to the M4 grill brief as acceptance criteria, **or this section quietly
> becomes another parking lot, which is the exact defect sweep finding F5 records.**

The note then closed with a §Next section containing **three promises in prose** — attach
W6/W7/W8, automate W9, hand W1/W2/W5 to #234 — with no issues behind any of them.

Hours after naming the trap, in the same document, the author walked into it.

**What caught it** was not the warning. The warning had already been read, written and
believed. It was the law adopted later that afternoon, whose detector made the §Next section
inspectable: *does every trigger here name an issue?* It did not. Discharged to **#324**,
**#325** and a comment on **#234**.

**The transferable point:** self-knowledge is not a control. A stated vulnerability with no
detector attached is a *prediction*, and predictions do not enforce themselves — which is the
same finding the register itself makes about the difference between a comparison and a check.

## What the three share

| | Knowledge present | Why it failed | What worked |
| --- | --- | --- | --- |
| **1** | #304's remedy, HANDOFF's symptom | recorded as prose, obliging nobody | law + greppable detector |
| **2** | both documents in one author's hands | verification felt redundant | mechanical citation check (Pass A) |
| **3** | the defect named in the same file | a warning is not a control | law's detector applied to the file |

The pattern is not that people forget. In all three the knowledge was **present, correct and
recently handled**. What was missing was a mechanism that *had to consult it*.

This is also why the sweep has been productive out of proportion to its cleverness: it is not
smarter than the documents, it is simply the first process here **obliged** to read two of
them together.

## Honest limits

- **Three cases from one session is an anecdote**, and all three were found by a method
  designed to find that shape — so the sample is selected. Hold the mechanism loosely; the
  cases are solid, the frequency claim is not.
- **Detectors have a cost that this note does not price.** Every law with a detector is
  another thing to run and another thing that can rot. Three landed in s14 (anchored counts,
  the behavior-preserving exemption, trigger-is-a-promise) and none is automated yet — the
  first standing check is #324, and #326's acceptance criteria require the trigger detector
  to hold once its audit closes. A law whose detector is "somebody greps" is only one
  generation better than prose.
- **This note is subject to its own case 3.** Naming the pattern does not protect it. It
  carries no triggers by construction, which is the only defence available to it.
