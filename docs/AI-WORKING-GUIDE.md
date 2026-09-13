# AI Working Guide: Efficient Changes and Lessons Learned

Version 1.0 — September 13, 2026

## Purpose: guidance, not doctrine

Help Chris and the assistant reach correct, verified results with less repeated discovery, rework, and supervision. Optimize total effort, not simply the number of tool calls.

Apply relevant advice with judgment. Current explicit user instructions and applicable platform, safety, and project requirements take precedence. Lessons are evidence, not authority to deploy, delete, expand access, bypass protections, or do unrelated work. A one-time workaround is not a permanent rule.

## One guide; one lessons log per project

When Chris adopts this guide for project work, reuse an existing equivalent log or create `AI-LESSONS.md` in an appropriate project documentation location, outside publicly served website content. Identify its location once. Preserve existing files and instructions.

Keep this guide reusable and stable; put site-specific experience in that site's log. Propose broadly useful improvements to Chris rather than automatically editing global instructions or copying lessons between sites.

If persistent files are unavailable, return a saveable Markdown update and explain that limitation. Never claim information was saved or will be available to another chat without evidence.

## Before each change request

Do this once at the start of a change—not before every tool call:

1. Establish the outcome, affected site/environment, scope, what must remain unchanged, and how completion will be verified. Infer routine details; ask when missing information materially affects the result.
2. Read applicable project instructions. Consult the log's short current summary and search for relevant lessons. Do not load an entire growing history by default.
3. Inspect current working state. Reuse applicable implementation, documented commands, and recent evidence. Verify changeable facts such as the deployment target before consequential actions.
4. Choose the smallest complete approach. Explain material assumptions or necessary scope expansion briefly.

If no relevant lesson exists, proceed. If a lesson conflicts with current evidence, prefer the evidence and correct the lesson rather than forcing the old approach.

## Working efficiently

- **Read narrowly:** Start with the affected feature and its interfaces; expand for a real dependency, failure, or risk. Prefer targeted searches over large output dumps.
- **Reuse verified setup:** Follow documented runtime, package-manager, directory, and tool choices. Check applicability; do not rediscover known setup or blindly replay another machine's commands.
- **Diagnose failures:** Distinguish code faults from unavailable tools, credentials, network trouble, or execution restrictions. Retry for a reason. Use normal approval mechanisms, never security bypasses.
- **Coordinate work:** Keep one authoritative request and one writer/release owner for overlapping changes. Parallelize independent work when worthwhile. This guide does not authorize new chats or schedule changes.
- **Settle visual choices early:** Offer a small set of labeled alternatives when useful. Preserve approved assets and map them clearly to their intended locations.
- **Test proportionately:** Use focused checks during development; complete required release checks once changes settle. Repeat broader checks when changes, failures, or unresolved concerns justify it. Permissions, authentication, migrations, and data changes warrant stronger verification.
- **Publish deliberately:** Follow one primary approved release path. Avoid duplicate manual and automatic deployments unless deliberately required. Verify actual publication.
- **Communicate clearly:** Report meaningful progress, assumptions, and blockers concisely, following applicable update requirements. Distinguish local, staging, and production evidence. Do not confuse a scheduled check with a successful check.
- **Stop when done:** After the requested outcome and required checks pass, hand off the result. Do not add unrelated polish, audits, refactors, or features.

## Brief after-action review

After meaningful work, a failed attempt, or a user correction, briefly review observable results using evidence already gathered:

- What caused avoidable delay, confusion, repeated work, or an incorrect result?
- What approach actually worked better?
- Would knowing this change the next similar task?
- Is it already recorded, environment-specific, or still only a hypothesis?

Add or update a lesson only when useful. Record successful approaches as well as mistakes. Usually zero to three short entries are sufficient; never invent lessons to meet a quota. Routine success, empty queue checks, and “nothing new learned” need no entry.

This is not another full audit or a narration of internal reasoning. It supplements testing, does not prove correctness, and does not authorize extra implementation work. A useful observation from an unfinished task must not imply that task succeeded.

## Lessons log structure

Use three sections:

1. **Project context:** Site/repository identity and links to existing setup, testing, and release instructions. Avoid duplicating the runbook.
2. **Current quick reference:** Roughly ten or fewer high-value applicable lessons, linked to their evidence entries.
3. **Lessons:** Short dated entries, newest first, with stable IDs.

Use this template, normally 60–120 words per entry:

```markdown
### L-YYYYMMDD-01 — Short, searchable title
- Scope/tags: Project, environment, feature, or task type.
- Status: Verified / tentative / superseded.
- Observation: What happened and the avoidable cost or successful approach.
- Evidence: Test, command result, file, commit, or user correction; date/environment.
- Next time: Concrete action likely to save effort.
- Limits: When this advice does not apply or needs rechecking.
```

Record commands only when verified, with their directory and prerequisites. Exclude secrets, tokens, private account details, customer data, and sensitive outputs. Link to approved internal evidence instead of copying private contents. Do not invent measured time savings.

## Keep lessons trustworthy and lightweight

Merge duplicates. Keep hypotheses tentative. Mark outdated entries superseded and link to replacements. When the log becomes cumbersome, archive older entries without discarding evidence; retain the short summary. Preserve concurrent edits by rereading the affected section before saving.

Do not automatically promote observations into mandatory instructions. Recommend cross-project guidance only when evidence supports generalizing it.

After several tasks, look for fewer repeated setup failures, less unnecessary rereading, fewer correction cycles, and reliable completion. Consider task complexity when comparing time. Shorten or retire advice that costs more to maintain than it saves.

Finish with the result, location, relevant verification, and any genuine outstanding issue. Keep retrospective detail in the log; mention new lessons to Chris only when useful.

## How Chris can introduce this guide

> Use the attached AI Working Guide for this site. Before changes, consult relevant project lessons. Create or reuse the persistent project log and record only useful, evidence-backed lessons after meaningful work. Treat this as adaptable guidance, preserve existing requirements, and do not expand the task. My current request is: [request].

For Codex repositories, Chris can authorize a short pointer to this guide and the log in the existing `AGENTS.md`; do not replace that file. For other chats, supply the guide and current project log together when needed. An attachment does not automatically become shared memory across all chats.

Reference: [OpenAI Codex best practices](https://learn.chatgpt.com/guides/best-practices), reviewed September 13, 2026. Its advice on concise guidance and retrospectives informed this design; the project-specific log format is our proposed working convention.
