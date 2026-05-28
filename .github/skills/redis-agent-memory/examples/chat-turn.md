# Run a full chat turn

**Use this when you want to handle one user turn end-to-end**: fetch prior session history, call the model, and save both sides of the exchange.

This pattern is the orchestration shape — fetch on entry, call model, save on exit. For adding *recalled long-term memories* to the prompt, compose with [enrich-context](./enrich-context.md); for the save side in isolation, see [store-chat-history](./store-chat-history.md).

```ts
import {
  MessageRole,
  type SessionEvent
} from '@redis-iris/agent-memory/models'

async function handleTurn(sessionId: string, username: string, userMessage: string): Promise<string> {
  const history = await fetchSessionHistory(sessionId)
  const messages = composePrompt(history, userMessage)
  const replyText = await callModel(messages)
  await saveTurn(sessionId, username, userMessage, replyText)
  return replyText
}

async function fetchSessionHistory(sessionId: string): Promise<SessionEvent[]> {
  try {
    const response = await agentMemory.getSessionMemory(sessionId)
    return response.events
  } catch {
    return [] // 404 on first turn is expected
  }
}

function composePrompt(history: SessionEvent[], userMessage: string) {
  return [
    ...history.map(e => ({ role: e.role, content: e.content.map(c => c.text).join('') })),
    { role: 'user', content: userMessage }
  ]
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

## Adding recall

To inject relevant long-term memories into the prompt, parallelize history fetch with a recall call (see [enrich-context](./enrich-context.md) for `fetchRelevantMemories`):

```ts
const [history, recalled] = await Promise.all([
  fetchSessionHistory(sessionId),
  fetchRelevantMemories(username)
])

const messages = composePromptWithRecall(history, recalled, userMessage)
```

Run the fetches in parallel — they're independent.

## Notes

- **First user event's `actorId` becomes the session's `ownerId`.** Passing `username` here gives you a stable per-user ownership without an explicit ownership call.
- **The assistant's `actorId` is your choice** — pick a stable producer name (e.g. `'app-assistant'`) so you can later distinguish assistant events from user events in the session.
- **`createdAt` on both events.** Stamping the user and assistant events with the same `createdAt` lets you reconstruct exchanges cleanly later.

Related references: [getSessionMemory](../references/get-session-memory.md), [addSessionEvent](../references/add-session-event.md).
