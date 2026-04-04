# Changelog: CopilotNotify — Telegram Notifications

**Feature Path:** `specs/done/copilotnotify-telegram-notifications`  
**Branch:** `amirranjbar/feat/copilotnotify-telegram-notifications`

---

## 2026-04-04 — Targeted review fixes: FR-14, FR-20, Section 7 package.json requirement

**Request:** Apply three targeted fixes identified during spec review.  
**Reason:** Post-revise review pass found: FR-14 referenced a Copilot LLM request boundary (inaccurate); FR-20 did not clarify what advances the cooldown timer; package.json `contributes.configuration` obligation was only implied by an assumption, not stated as an explicit requirement.  
**Route:** In-place revision of `specs/done/copilotnotify-telegram-notifications/spec.md`.  
**Archived From:** None.

**Artifacts Updated:**
- `specs/done/copilotnotify-telegram-notifications/spec.md` — targeted fixes (see below)
- `specs/done/copilotnotify-telegram-notifications/changelog.md` — this entry

**Updated Sections:**
- Section 6.1 FR-14: Reworded to state that the start timestamp is recorded at handler entry, before any async operations begin, removing the inaccurate "before invoking the Copilot LLM request" phrasing.
- Section 6.1 FR-20: Expanded to explicitly state that the cooldown timer advances only when a notification is successfully dispatched to Telegram; suppressed notifications (by outcome filter or cooldown) do not advance the timer.
- Section 7 (Phase 2 configuration schema): Added an explicit implementation requirement block mandating that all Phase 2 settings be declared in `package.json` under `contributes.configuration` with correct `type`, `default`, and `description` fields.
- Section 11 Assumption 5: Updated to reference the new Section 7 explicit requirement instead of treating `package.json` registration as a mere assumption.

**Notes:**
- No stories, edge cases, or success criteria changed; all other spec content left intact.
- Fix count: 3

---

## 2026-04-04 — Related-revise: Phase 2 enriched notifications + feasible Phase 3 repo work

**Request:** Revise spec to cover Phase 2 enriched notifications and feasible Phase 3 repository foundation work while preserving Phase 1 delivered baseline.  
**Reason:** Related-revise of same feature. Phase 1 implementation complete. Scope expanded to Phase 2 + Phase 3 repo items per SDD orchestrator brief (2026-04-04).  
**Route:** related-revise (not a new sibling spec); continuing on branch `amirranjbar/feat/copilotnotify-telegram-notifications`.  
**Archived From:** None (in-place revision of `specs/done/copilotnotify-telegram-notifications/spec.md`).

**Artifacts Updated:**
- `specs/done/copilotnotify-telegram-notifications/spec.md` — full revision
- `specs/done/copilotnotify-telegram-notifications/changelog.md` — this entry + header path fix

**Updated Sections:** All sections revised. Summary of changes:
- Title updated to reflect Phase 2+3 scope
- Status updated to "Active — Phase 1 delivered; Phase 2 + feasible Phase 3 in progress"
- Section 1 (Overview): Added Phase 2+3 scope summary and architecture note clarifying participant-scope detection
- Section 2 (Scope): Restructured into 4 subsections — Phase 1 Delivered Baseline, Phase 2 Active, Phase 3 Repo Work, and explicit Out of Scope table
- Section 3 (Constraints): Updated C-01 to note duration/outcome are participant-turn metadata; C-03 updated to permit duration/outcome/workspace as enrichments
- Section 4 (User Stories): Phase labels added to US-01–US-06; added Phase 2 stories US-07–US-11 (duration, outcome, filtering, cooldown, format); Phase 3 stories US-12–US-16 (README, CHANGELOG, LICENSE, CI, issue templates); Defect Fix DF-01 (tsconfig node types)
- Section 5 (Edge Cases): Expanded to 19 cases; EC-13–EC-19 are new Phase 2/3 cases
- Section 6 (Requirements): FR-14–FR-24 (Phase 2), FR-25 (defect fix), FR-26–FR-30 (Phase 3)
- Section 7 (Config Schema): Split by phase; Phase 2 adds notifyOnSuccess, notifyOnFailure, cooldownSeconds, messageFormat; includeTaskSummary explicitly eliminated
- Section 8 (Implementation Intent): participant.ts and notifier.ts responsibilities updated for Phase 2
- Section 9 (Success Criteria): Expanded to 23 criteria (SC-11–SC-18 Phase 2, SC-19–SC-23 Phase 3)
- Section 10 (Known Limitations): Updated to reflect Phase 2 participant-scope precision (7 limitations)
- Section 11 (Assumptions): Added assumptions 5 and 6 for Phase 2
- Section 12 (Constitution Compliance): Added row for duration/outcome as participant-turn metadata
- Section 13 (Resolved Conflicts): Removed — Phase 1 artifact no longer relevant
- Stale `specs/queue/` path reference in changelog header fixed

**Notes:**
- Constitution continues to govern all phases; privacy constraint eliminates `includeTaskSummary` permanently
- "success" and "failure" in outcome filtering are scoped to participant cancellation state only — no LLM quality detection
- Duration is wall-clock elapsed time of participant handler; no prompt content or token count involved
- Phase 3 items are repository-local only; no publisher/Marketplace/account tasks
- Carried defect fix: tsconfig missing `@types/node` causing `assert` type errors in test files

---

## 2026-04-03 — Initial spec creation

**Request:** Create Phase 1 MVP specification for CopilotNotify Telegram notification extension.  
**Reason:** New feature, no prior spec. Fresh route selected after confirming no existing specs in queue, doing, or done.  
**Archived From:** None.

**Artifacts Created:**
- `specs/queue/copilotnotify-telegram-notifications/spec.md`
- `specs/queue/copilotnotify-telegram-notifications/changelog.md`

**Updated Sections:** All sections (initial creation).

**Notes:**
- Synthesized from PDR.md, memory/constitution.md, .github/copilot-instructions.md, Step 1 scope/detection/privacy decisions, and Step 2 research findings.
- Scope locked to Phase 1 MVP (v0.1.0) only. Phase 2–4 items explicitly listed as out of scope.
- Constitution takes precedence over PDR in all conflicts (bot token storage, message content, HTTP client, `notifyOnSuccess`/`notifyOnFailure` settings deferred to Phase 2).
- Detection strategy: custom VS Code chat participant only. Passive Copilot observation is not possible with public APIs and is explicitly out of scope.
- Task-completion boundary defined as the custom participant handler resolving after response streaming completes.
- Privacy constraint formalized: notification payload contains generic label, workspace name, and timestamp only. No prompt text, code, or diff content permitted.
- 4 PRD/constitution conflicts identified and resolved in favor of constitution (see spec.md Section 13).
- 1 consistency issue noted and resolved: `notifyOnSuccess`/`notifyOnFailure` appearing in `.github/copilot-instructions.md` as Phase 1 settings conflicted with Step 2 research findings; deferred to Phase 2.
- 6 user stories, 13 functional requirements, 5 non-functional requirements, 12 edge cases, 10 success criteria written.
