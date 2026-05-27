---
name: redis-agent-memory
description: Build, debug, and reason about applications that use the Redis Agent Memory cloud service from TypeScript via the @redis-iris/agent-memory SDK. Covers the two-tier memory model (sessions + long-term), auto-promotion, ownership conventions, search filters, the SDK's typed surface, and documented empirical behaviors the official docs don't spell out. Trigger when code imports @redis-iris/agent-memory, references AgentMemory / SessionEvent / MemoryRecord types, or discusses session memory, long-term memory, or memory promotion.
---

# Redis Agent Memory (TypeScript)

Smart documentation for the **Redis Cloud Agent Memory** service, accessed via the official Speakeasy-generated TypeScript SDK `@redis-iris/agent-memory`. Combines the official docs (https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/), the SDK's type definitions, and empirical observations from real use.

**Important scope note**: this skill covers the **Redis Cloud** service. There is also an open-source `redis/agent-memory-server` project on GitHub. The two have diverged — **do not read the OSS source to infer cloud behavior**. Stick to the cloud docs, the SDK's `.d.ts` files, and direct empirical probing.

## When to invoke

- Code imports `@redis-iris/agent-memory` or references `AgentMemory`, `SessionEvent`, `MemoryRecord`, `MessageRole`, `MemoryType`, or filter types from that package.
- The user is discussing session memory, long-term memory, auto-promotion, memory recall, or any "Agent Memory" concept in a Redis context.
- The user is choosing between writing session events vs explicit long-term memories.
- The user asks why memory behavior is X (slow extraction, missing fields, classification mistakes — those are documented below).

## 1. What it is

> *"Redis Agent Memory is a memory service for AI Agents available as a REST API and client libraries. It provides the persistent, structured memory layer that intelligent agents need to store, retrieve, and manage contextual data across interactions."*

**Two-tier model:**

- **Session memory** (a.k.a. short-term / working memory) — *"maintains the current conversation state, session history, and session-specific metadata."* Has a configurable TTL. **Within a session, content is append-only** — old events do NOT fall off; the whole session disappears when its TTL expires (empirical, confirmed by inspecting Redis directly: each session is a single JSON document).
- **Long-term memory** — *"stores information extracted from past sessions, including user preferences, learned patterns, and other relevant data."* Stored as vector embeddings + metadata. Searched semantically (cosine similarity) with metadata filters.

**Auto-promotion:**

> *"The promotion from short term memory to long-term memory is automatic. When you store a conversation event in session memory, the Agent Memory Server asynchronously extracts important information using the configured extraction strategy (discrete, summary, preferences, or custom). These extracted memories are then stored as long-term memory entries with vector embeddings and metadata. This process is non-blocking: the extraction and promotion happen in the background using a task worker, so the main agent interaction remains responsive."*

Status: **preview**. *"Features and behavior are subject to change."*

## 2. Quick start

```bash
npm install @redis-iris/agent-memory
```

Pin the version exactly — the SDK is pre-1.0 and breaking changes are expected.

```ts
import { AgentMemory } from '@redis-iris/agent-memory'

export const agentMemory = new AgentMemory({
  serverURL: process.env.MEMORY_API_HOST,
  storeId: process.env.MEMORY_STORE_ID,
  apiKey: process.env.MEMORY_API_KEY
})
```

The SDK reads `AGENT_MEMORY_API_KEY` / `AGENT_MEMORY_STORE_ID` from env by default if those args are omitted. Most apps prefer to pass values explicitly so the source of truth is in the app's own config layer.

REST authentication is `Authorization: Bearer <API_KEY>` — the SDK injects the header for you.

## 3. Always use SDK types — never ad-hoc structural shapes

Import enums and types from `@redis-iris/agent-memory/models`:

```ts
import {
  MessageRole,
  MemoryType,
  type SessionEvent,
  type MemoryRecord
} from '@redis-iris/agent-memory/models'
```

Why:
- The SDK is the source of truth — no drift when the schema changes.
- It "telegraphs" that the SDK is in use at the read/write site.
- The IDE autocompletes additional fields you might want later (e.g. `createdAt`, `systemTimestamp`).

Specific replacements to make in any code you encounter:

| Ad-hoc shape | SDK form |
|---|---|
| `{ role: string; content: Array<{ text: string }> }` | `SessionEvent` |
| `Array<{ text: string }>` (for memory records) | `MemoryRecord[]` |
| `role === 'USER'` | `role === MessageRole.User` |
| `role: 'ASSISTANT'` | `role: MessageRole.Assistant` |
| `memoryType: 'episodic'` | `memoryType: MemoryType.Episodic` |

The enums are closed types (`ClosedEnum`):

```ts
MessageRole = { User: "USER", Assistant: "ASSISTANT", System: "SYSTEM" }
MemoryType  = { Semantic: "semantic", Episodic: "episodic", Message: "message" }
```

`MessageRole` notably does **not** include a `TOOL` variant — see "Gotchas" below.

## 4. Session memory (short-term)

Sessions hold ordered conversation events. Use them for live chat turns.

### Add an event

```ts
import { MessageRole } from '@redis-iris/agent-memory/models'

await agentMemory.addSessionEvent({
  sessionId,                       // optional — server generates one if omitted
  actorId: 'user-W8GUY',           // free-form, 1-255 chars; the first event's actorId becomes the session's ownerId
  role: MessageRole.User,
  content: [{ text: userMessage }],
  createdAt: new Date(),
  metadata: { client: 'cli-repl' } // optional, free-form JSON
})
```

REST equivalent: `POST /v1/stores/{storeId}/session-memory/events`.

### Read session history

```ts
try {
  const response = await agentMemory.getSessionMemory(sessionId)
  // response.sessionId, response.ownerId, response.events: SessionEvent[]
} catch {
  // 404 on the first turn of a new session is expected — treat as empty history.
}
```

REST equivalent: `GET /v1/stores/{storeId}/session-memory/{sessionId}` (per the SDK; the public REST examples page focuses on POST endpoints).

### Other session operations

The SDK also exposes `getSessionEvent`, `deleteSessionEvent`, `deleteSessionMemory`, `listSessions`. Standard CRUD shapes.

### Key behaviors and gotchas

- **`actorId` is `string`, 1-255 chars.** Per the SDK's JSDoc: *"Unique actor identifier. Can represent a user, agent, or any participant."* It is **not** an enum — no `'USER'` / `'AGENT'` constraint.
- **The first event's `actorId` becomes the session's `ownerId`** permanently. From `GetSessionMemoryResponseContent.ownerId` JSDoc: *"The owner of the session, set from the actorId of the first event."* This is service-side behavior surfaced by the SDK; the REST examples page doesn't spell it out.
- **`actorId` is NOT filterable** anywhere else. There is no `actorIdFilter` type and no read endpoint accepts an `actorId` predicate. After the first event, the field is stored-and-returned metadata but is not a query axis.
- **`role` is a closed enum** — `USER | ASSISTANT | SYSTEM`. There is no `TOOL` role. LangChain agents that produce tool-call messages cannot be persisted faithfully without serializing the tool dance into the freeform `metadata` field. For most chat patterns, save only the user input + final assistant text and skip the tool-call internals.
- **Session events have client-supplied `createdAt` (timestamp of the event) and server-set `systemTimestamp` (ingestion time).** They can differ. Use `createdAt` when you mean "when the event happened."
- **Session metadata field is `any`** — totally free-form JSON. No documented behavior tied to it.
- **The `metadata` slot on session events does NOT travel to auto-promoted long-term memories.** The auto-extractor produces its own records; hints in session metadata don't propagate (empirical — auto-promoted memories come back with empty `namespace` and `topics`).
- **No in-session compaction or summarization.** The session's underlying storage in Redis is a single JSON document. Events accumulate indefinitely; the whole document disappears when the TTL fires. For long-lived sessions, *in-session* growth is the client's problem — no `compactSessionMemory` / `summarizeSession` op exists, despite "summary" appearing in the extraction-strategy list (that's about long-term extraction, not in-session collapse).
- **404 on `getSessionMemory` is expected for new sessions.** Catch and treat as empty history.

## 5. Long-term memory

Vector-embedded records with rich metadata.

### Create memories explicitly

```ts
import { ulid } from 'ulid'
import { MemoryType } from '@redis-iris/agent-memory/models'

await agentMemory.bulkCreateLongTermMemories({
  memories: [
    {
      id: ulid(),                      // client-provided; idempotent on duplicate id
      text: 'On 2026-05-26T15:42:00Z, a receiver tuned to 14.250000 MHz USB heard: ...',
      memoryType: MemoryType.Episodic,
      ownerId: 'earshot-listener',
      sessionId: 'optional-link-back',
      namespace: 'optional-grouping',
      topics: ['optional', 'tags']
    }
  ]
})
```

REST equivalent: `POST /v1/stores/{storeId}/long-term-memory/`.

### Search semantically

```ts
const response = await agentMemory.searchLongTermMemory({
  text: 'user preferences',
  limit: 10,                                  // default 10, max 100
  similarityThreshold: 0.5,                   // optional, normalized cosine, 0-1
  filter: {
    ownerId: { eq: 'user-W8GUY' },
    memoryType: { in: ['semantic', 'episodic'] },
    createdAt: { gte: new Date('2026-01-01') }
  },
  filterOp: 'all'                             // 'all' (AND) or 'any' (OR) across filter conditions
})
// response.items: MemoryRecord[]
// response.nextPageToken: string | undefined
```

REST equivalent: `POST /v1/stores/{storeId}/long-term-memory/search`.

### Other long-term operations

The SDK also exposes `getLongTermMemory`, `updateLongTermMemory`, `bulkDeleteLongTermMemories`. Standard shapes.

### Search filter reference (from the official docs)

| Filter | Type | Operators |
|---|---|---|
| `sessionId` | string | `eq`, `ne`, `in`, `all` |
| `ownerId` | string | `eq`, `ne`, `in`, `all` |
| `namespace` | string | `eq`, `ne`, `in`, `all` |
| `topics` | string | `eq`, `ne`, `in`, `all` |
| `memoryType` | string | `eq`, `ne`, `in`, `all` |
| `createdAt` | ISO 8601 | `eq`, `gt`, `lt`, `gte`, `lte` |

**Filter operators:**
- `eq` — equal to value
- `ne` — not equal to value
- `in` — any of a list
- `all` — matches all of a list (only meaningful for `topics`)
- `gt` / `lt` / `gte` / `lte` — comparison (only for `createdAt`)

**Constraint:** *"For all values, you must set only one of these operators"* — i.e. one operator per filter field per query.

**`filterOp`:** `'all'` (AND) or `'any'` (OR) joins the predicates across different fields. Default depends on the SDK; pass it explicitly when you care.

### Memory types (semantic / episodic / message)

The cloud docs name three types but do not define them:

- `MemoryType.Semantic` — `"semantic"`
- `MemoryType.Episodic` — `"episodic"`
- `MemoryType.Message` — `"message"`

The names align with standard agent-memory terminology:

- **message** — raw chat history (conversational turns preserved verbatim)
- **episodic** — a memory with a timestamp; what happened, when
- **semantic** — a fact or piece of knowledge, time/context stripped

**However**: the auto-extractor's classification choices are unreliable. Empirically, a clear preference statement (`"User is a fan of APRS"`) was filed as **episodic**, not semantic. Treat the auto-classifier as opaque; if `memoryType` matters for downstream behavior, set it explicitly via `bulkCreateLongTermMemories`.

**Memory types are filter-only**, not a ranking knob. Search uses one vector-similarity path with one threshold across all types. There is no documented type-specific ranking (e.g. episodic doesn't get a recency boost). `createdAt` is also filter-only; if you want recency-weighted ranking, do it client-side after the search returns.

### Key behaviors and gotchas

- **`createdAt` / `updatedAt` on memory records are SERVER-managed.** Not on `CreateMemoryRecord`. Not on `UpdateLongTermMemoryRequestContent`. The server stamps them at write/update time. **You cannot backfill a long-term memory with the time the underlying event actually occurred** — `createdAt` will reflect insertion time. Workaround: put the meaningful timestamp into the `text` so semantic search can match against it.
- **`namespace` and `topics` are settable on explicit `bulkCreateLongTermMemories` but auto-promotion produces records with both fields empty** (empirical). Don't design filters that depend on auto-promotion tagging anything.
- **No `actorId` / "memory creator" filter.** Discrimination between sources (e.g. listener-written vs auto-promoted-from-chat) is via `ownerId` — different sources use different ownerIds.
- **Auto-promotion is async and slow.** *"happen in the background using a task worker"* — empirically, "many turns" delayed. For deterministic timing or controlled metadata, use explicit `bulkCreateLongTermMemories`.
- **Underlying Redis storage**: long-term memories are Hashes (one per memory). Session memory is a single JSON document per session. Useful to know when probing via RedisInsight / `redis-cli`.

## 6. Ownership model — `actorId` vs `ownerId`

These are easy to confuse. Two related but distinct concepts:

- **`actorId`** lives on **session events**. It identifies *who/what produced this event* (the user, the assistant, another agent). Free-form 1-255 char string. The first event's actorId becomes the session's ownerId; otherwise, it's stored metadata not used by any read/filter operation.
- **`ownerId`** lives on **sessions and on long-term memory records**. It identifies *who owns the record*. Filterable on long-term memory search (`OwnerIdFilter` supports `eq`, `ne`, `in`, `all`).

Suggested patterns:

- **Per-user chatbots**: pass the user's stable identifier (callsign, internal user id) as both `actorId` (on the user's events) and implicitly as the session's `ownerId` (via the first-event rule). On long-term memory writes about the user, set `ownerId` to the same id.
- **Multiple producer roles** sharing one memory store: give each role its own conceptual `ownerId` value (e.g. `'app-listener'`, `'app-curator'`). Then filter on `ownerId` to slice memories by which agent wrote them.

## 7. Extraction strategies — known unknown

The overview page mentions four extraction strategies — **discrete, summary, preferences, custom** — that govern what gets auto-promoted. **None are defined in the docs.** The configuration knob for the strategy is **not exposed in the Redis Cloud control panel or REST API surface** (verified empirically). For now, the strategy in use on your store is opaque, and you cannot influence it.

Practical consequence: if you need controlled extraction behavior, **don't rely on auto-promotion** — write explicit long-term memories from your application code.

## 8. Anti-patterns / things NOT to do

- **Do not read `redis/agent-memory-server` (the OSS repo) to infer cloud behavior.** The cloud service and the OSS server have diverged; OSS source is not a reliable signal about what the cloud does. Stick to: (1) the SDK's `.d.ts` files, (2) the official docs, (3) empirical probing.
- **Do not hand-roll a fetch client.** Use the SDK — Speakeasy generates it from the service's OpenAPI spec, so it's the canonical surface. Pin the exact version (no caret) because the SDK is pre-1.0.
- **Do not trust the auto-extractor's `memoryType` classification.** It miscategorizes. Set the type explicitly when it matters.
- **Do not assume `namespace` or `topics` will be present on auto-promoted memories.** They won't be.
- **Do not rely on session compaction.** There isn't any in-session compaction — the JSON document just grows. Cap client-side if sessions are long-lived.
- **Do not put a `TOOL` role on a session event.** The enum doesn't include it; the event will fail validation. Tool-call dance internals can be stored in `metadata` if needed, but most apps just persist user input + final assistant text.
- **Do not set `createdAt` / `updatedAt` on a long-term memory write.** Those fields are server-managed; the SDK doesn't accept them on create/update.
- **Do not put markdown or JSON in the long-term memory `text` field expecting structured retrieval.** Semantic search embeds the text — prose embeds well, JSON syntax embeds poorly. If you have structured data to preserve, format the text as natural-language prose that *describes* the data; the model reads the memory naturally on recall.

## 9. SDK operation surface (reference)

All operations on `AgentMemory`:

**Sessions:**
- `addSessionEvent(request)`
- `getSessionMemory(sessionId)`
- `getSessionEvent(sessionId, eventId)`
- `deleteSessionEvent(sessionId, eventId)`
- `deleteSessionMemory(sessionId)`
- `listSessions(request?)`

**Long-term memory:**
- `bulkCreateLongTermMemories({ memories })`
- `getLongTermMemory(memoryId)`
- `updateLongTermMemory(memoryId, request)`
- `bulkDeleteLongTermMemories({ memoryIds })`
- `searchLongTermMemory(request)`

**Health:**
- `health()`

There is **no** "assemble context" / "memory window" / "combined session + relevant long-term memory" operation. If you want long-term memory in the prompt alongside session history, do two calls in parallel and compose client-side.

## 10. Common code patterns (from real use)

### Chat turn: pre-fetch preferences + history, respond, save both turns

```ts
import {
  MessageRole,
  type SessionEvent,
  type MemoryRecord
} from '@redis-iris/agent-memory/models'

async function fetchSessionHistory(sessionId: string): Promise<SessionEvent[]> {
  try {
    const response = await agentMemory.getSessionMemory(sessionId)
    return response.events
  } catch {
    return [] // 404 on first turn is expected
  }
}

async function fetchUserPreferences(username: string): Promise<MemoryRecord[]> {
  try {
    const response = await agentMemory.searchLongTermMemory({
      text: 'The user has preferences, interests, opinions, and personal facts known about them.',
      limit: 5,
      filter: { ownerId: { eq: username } }
    })
    return response.items ?? []
  } catch (err) {
    console.error('preference recall failed:', err)
    return []
  }
}

async function saveTurn(sessionId: string, username: string, userMessage: string, replyText: string): Promise<void> {
  const createdAt = new Date()
  await agentMemory.addSessionEvent({
    sessionId,
    actorId: username,
    role: MessageRole.User,
    content: [{ text: userMessage }],
    createdAt
  })
  await agentMemory.addSessionEvent({
    sessionId,
    actorId: 'app-assistant',
    role: MessageRole.Assistant,
    content: [{ text: replyText }],
    createdAt
  })
}
```

### Explicit long-term write

```ts
import { ulid } from 'ulid'
import { MemoryType } from '@redis-iris/agent-memory/models'

await agentMemory.bulkCreateLongTermMemories({
  memories: [
    {
      id: ulid(),
      text: description,             // natural-language prose, not JSON
      memoryType: MemoryType.Episodic,
      ownerId: 'app-producer-name'
    }
  ]
})
```

### Tool-callable search

```ts
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

const schema = z.object({
  query: z.string().describe('Focused semantic query — topic, name, term. Not the raw user message.')
})

export const searchTool = tool(
  async ({ query }) => {
    const response = await agentMemory.searchLongTermMemory({
      text: query,
      limit: 10,
      filter: { ownerId: { eq: 'app-producer-name' } }
    })
    const items = response.items ?? []
    if (items.length === 0) return 'No matches.'
    return items.map((item, i) => `${i + 1}. ${item.text}`).join('\n\n')
  },
  { name: 'searchMemories', description: '...', schema }
)
```

## 11. Where to look when this skill isn't enough

In priority order:

1. **The installed SDK's `.d.ts` files** — `node_modules/@redis-iris/agent-memory/dist/commonjs/models/` for request/response shapes and filter types; `dist/commonjs/sdk/sdk.d.ts` for the AgentMemory class itself. Authoritative for endpoint shapes.
2. **The REST API examples page** — https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/api-examples/ — endpoint paths, example payloads, filter reference table.
3. **The service overview page** — https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/ — conceptual model, two-tier description, auto-promotion behavior.
4. **The REST API reference** — https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/api-reference/ — full endpoint spec. Note: this page is client-side-rendered; basic `curl` or non-JS WebFetch returns only the page shell. Open it in a browser or find the underlying OpenAPI JSON.
5. **The npm package page** — https://www.npmjs.com/package/@redis-iris/agent-memory
6. **Empirical probing** — RedisInsight or `redis-cli` against the underlying store; write controlled session events / long-term memories and observe what comes back. Reliable when docs are ambiguous.

**Do NOT use**: the open-source `redis/agent-memory-server` GitHub repo. Cloud and OSS have diverged; OSS findings will mislead about cloud behavior.
