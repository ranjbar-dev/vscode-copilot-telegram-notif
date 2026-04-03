# Changelog: CopilotNotify — Telegram Notifications

**Feature Path:** `specs/queue/copilotnotify-telegram-notifications`  
**Branch:** `amirranjbar/feat/copilotnotify-telegram-notifications`

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
