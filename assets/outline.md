# Earshot — Livestream Outline

Talking-point outline for a livestream demo of [Earshot](../README.md) — a multi-agent demo of [Redis Agent Memory](https://redis.io/) that gets rebuilt live by GitHub Copilot using a custom skill for the `@redis-iris/agent-memory` SDK.

If you found this file by browsing the repo: this isn't documentation of the project itself — that's the [README](../README.md) and the [architecture diagram](../docs/architecture.md). This is the speaker's running order.

1. **Intro — the Redis Iris vision** (stock diagrams)
2. **Redis Agent Memory specifically — how it works** (stock diagram)
3. **Set up a store in [app.redislabs.com](https://app.redislabs.com/)**
4. **TS client exists → why I wrote the skill**
5. **Show the skill in the IDE**
6. **What I built — Earshot** ([architecture diagram](../docs/architecture.md))
7. **Demo**
   - Chatbot runs, but doesn't remember anything
   - Rebuild session memory → chatbot remembers the current conversation
   - Rebuild the listener's long-term write → radio harvesting starts
   - Rebuild the `searchTranscripts` tool → chatbot answers about what it just heard
   - Rebuild preference recall → preferences quietly auto-promoted in the background surface
8. **Peek under the hood — what it looks like in Redis** (RedisInsight: session as a JSON doc, long-term memories as Hashes)
9. **Celebrate — CTAs**
   - [Free Redis tier](https://redis.io/try-free/)
   - This repo
   - The skill itself, in [.github/skills/redis-agent-memory/](../.github/skills/redis-agent-memory/)
