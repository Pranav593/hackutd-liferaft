# LIFERAFT — Exact sponsor prompts, provenance and feature-to-requirement map

The challenge prompt wording below comes from **the team's sponsor-sheet screenshots**. This file deliberately avoids inventing any requirements not visible in those screenshots. External API documentation describes provider capabilities, **not necessarily sponsor-specific challenge requirements**.

## NMC² / NorthMark Compute & Cloud

**Full statement visible in team screenshot:**

> Mission: Keep the World Running
>
> Behind every AI model, streaming service, and cloud application is a data center—and a team keeping it running around the clock. A missed warning, an unclear handoff, or the wrong information at the wrong time can turn a small issue into a major disruption.
>
> NMC² challenges you to build a solution that helps data center teams stay one step ahead.

**What Codex must deliver to answer that prompt:** Live compute-node monitoring; meaningful early-warning signals; real verified preservation of training progress; deterministic software failover; incident timeline; safe technician/operator handoff; measured resilience rather than vague claims. Don't claim this is deployed by NMC² or solves all data-center incidents. Explain that Pi 5/laptops are safe small-scale stand-ins for compute nodes.

## NVIDIA / Best Usage of Nemotron Beyond a Chatbot

**Exact track title visible in the team screenshot:** `Best Usage of Nemotron beyond a chatbot.` The screenshot did not include further technical rubric. Implement real hosted **NVIDIA Nemotron** inference, *not another unrelated model*, with actual typed function calls involving incident and checkpoint data. Have it inspect health, incident history, lease epochs, candidate checkpoints and recovery proof; synthesise bounded evidence-based runbooks and post-incident summaries. Persist tool-call trace and show it in UI. Nemotron must remain read-only; job rescue authority rests with the deterministic coordinator.

**What can be verified from public provider docs:** NVIDIA Build shows various hosted Nemotron models with varying support for reasoning and tool calling. Codex must verify currently available model identifier and function-calling response schema when implementing. Source: https://build.nvidia.com/search/models?q=Nemotron . Models can change; do not hardcode an unverified model name.

## Photon / Best Use of Photon API

**Exact title visible in team screenshot:** `Best Use of Photon API (Notion with full info)` with link https://somethinggreat.notion.site/Hackathon-Guidelines-for-Photon-3dce443f36bb803696daf4135f063cd1 . The Notion guideline body could not be verified by public retrieval. **Do not manufacture technical rules for it.** The implementation should be genuinely useful even without additional challenge details.

**What Codex must deliver:** Live actual Photon provider API integration; real outbound emergency notifications and inbound operator replies; `STATUS`, `WHY`, `CHECKPOINT`, `ACK` commands that query active incident data; provider message/event ID mapping, secure sender validation, and observable delivery/ack states. Avoid a screenshot or UI-only mock presented as live integration.

**Official provider documentation verified:** Photon Beta 2.0 API reference https://photon.codes/docs/beta/api-reference ; base `https://api.photon.codes`, paths versioned under `/v1`; project API credentials `pho_sk_...` apply only under `/v1/projects/{projectId}`, not generic account endpoints; iMessage feature support differs between Beta and Stable. Text first, voice optional only if actually provisioned.

## Why one product fits all three without bolt-ons

- NMC² problem: valuable AI work is vulnerable to infrastructure incidents; better coordination and proactive action improve continuity.
- NVIDIA reasoning: use tools to investigate why jobs are at risk and assess safe recovery evidence, and communicate uncertainty rather than emitting static content.
- Photon human workflow: inform the right person with current incident context, support questions/acknowledgement through real conversation, and preserve incident history.
- Hardware: ESP32 button/DS18B20 + Pi OS CPU telemetry show physical-to-software signal path. The **button simulates an incident**; only job movement is truly performed. This is a correct and honest demonstration.

## Scope discipline

The core LIFERAFT design should not randomly add competing LLMs, blockchains or databases merely because those technologies exist. If adding another service could materially improve reliability, Codex may evaluate it only after the core three sponsor integrations are functional and must explain tangible product value. This is an engineering scope rule, not event administration.
