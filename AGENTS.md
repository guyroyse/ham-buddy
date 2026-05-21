# AGENTS.md

Ham-buddy is an agent that controls a Yaesu FT-991 ham radio, listens to its received audio, transcribes what it hears, stores transcripts in agent memory, and answers questions about what was said on the air.

## Stack

| Concern       | Choice                                                              | Status  |
| ------------- | ------------------------------------------------------------------- | ------- |
| Runtime       | Node 24, TypeScript (ESM), `tsx` to run                             | done    |
| Audio capture | `ffmpeg \| sox` shell pipeline, sox segments on silence             | done    |
| STT           | OpenAI Whisper API + gpt-4o-mini correction pass                    | done    |
| Listener      | `listen()` async generator combining capture + transcribe + rig tag | done    |
| Radio         | Yaesu FT-991 via hamlib's `rigctld` (spawned subprocess + TCP)      | done    |
| Memory        | Redis Agent Memory REST API (private preview)                       | not yet |
| Agent         | LangGraph.js + OpenAI                                               | not yet |
| UI            | Ink TUI                                                             | not yet |

## External tools required

Via Homebrew on macOS:

```
brew install ffmpeg sox hamlib
```

- `ffmpeg` + `sox` — audio capture pipeline.
- `hamlib` — provides `rigctld`, which the Rig class spawns as a child process. See "Why rigctld instead of node-serialport" below.

## Setup

```
cp .env.example .env       # then fill in OpenAI key, RIG_PORT, RIG_MODEL, etc.
npm install
npm run audio:devices      # list avfoundation audio inputs to pick one
npm run rig:devices        # list serial ports to pick one for RIG_PORT
npm run audio:test         # smoke test the audio capture pipeline
npm run rig:test           # smoke test rig control (interactive — type `freq <MHz>` / `mode <NAME>`)
npm run listen:test        # full pipeline: capture + transcribe + rig metadata
```

## File layout

```
src/
  capture/
    capture.sh       bash pipeline: ffmpeg captures raw PCM (s16le, 16 kHz mono)
                     from avfoundation, pipes to sox which segments on silence
                     via the silence effect + :newfile :restart chain.
    capture.ts       async generator wrapper: spawns capture.sh, watches the
                     session directory, yields WAV paths as sox closes each take.
                     Reads device + outputDir from config.
    transcribe.ts    transcribe(wavPath): Whisper-1 transcription with ham-vocab
                     prompt biasing, then a gpt-4o-mini cleanup pass with a
                     longer ham-vocab system prompt and JSON-free output.
                     Returns the corrected text. Reads OpenAI key from config.
    listen.ts        listen(rig): async generator yielding Transcript
                     {text, audioPath, capturedAt, frequency, mode, band} for
                     each utterance. Snapshots rig state at WAV-close time
                     (before transcription, which can take seconds). Owns an
                     internal AbortController so callers don't pass a signal.
  rig/
    rig.ts           Rig class. Holds frequency / mode / band, polls rigctld
                     every 100 ms via two queries (+f, +m). Public API:
                     static connect() / close() / get+set frequency / get+set
                     mode / get band. Reads port/baud/model from config.
    rigctld-socket.ts  RigCtlD_Socket. Spawns rigctld as a child process and
                     speaks its line-based TCP protocol. Public API: send(),
                     readLine(), close(). Transactions serialize via an
                     internal chain — send() awaits its turn, and readLine()
                     releases the chain when it sees the RPRT terminator.
                     Callers prefix commands with `+` to guarantee RPRT
                     termination.
    bands.ts         Band enum + bandFor(frequency) — derives the ham band
                     from a Hz value. The FT-991A has no read-side band
                     query, so we infer band from frequency.
    modes.ts         Mode enum whose values are hamlib's mode strings (USB,
                     LSB, CW, FM, AM, RTTY, PKTLSB, PKTUSB, etc.). Both sent
                     to and received from rigctld verbatim.
  config.ts          dotenv-loaded config. Exposes openai.apiKey,
                     memory.{host, apiKey, storeId}, rig.{port, baud, model},
                     audio.{device, outputDir}. Required-but-missing vars are
                     surfaced at the call site (e.g. Rig.connect throws if
                     RIG_PORT is empty).
  scripts/
    audio-devices.ts    `npm run audio:devices`   — list avfoundation audio inputs
    audio-test.ts       `npm run audio:test`      — print each captured WAV path
    transcribe-test.ts  `npm run transcribe:test` — capture + transcribe each utterance
    rig-devices.ts      `npm run rig:devices`     — list serial ports + manufacturer info
    rig-test.ts         `npm run rig:test`        — interactive REPL: set freq/mode + live state
    listen-test.ts      `npm run listen:test`     — capture + transcribe + rig-state, print each Transcript
captures/            session output, one timestamped subdirectory per run (gitignored)
```

## Runtime data flow

Two pipelines that meet in `listen()`:

- **Audio**: `capture.sh` (long-lived ffmpeg | sox) → `captureUtterances()` yields WAV paths → `transcribe(path)` returns cleaned text.
- **Rig**: `Rig.connect()` spawns `rigctld` and opens a TCP socket via `RigCtlD_Socket` → `Rig` polls `+f` and `+m` every 100 ms, keeping `frequency` / `mode` / `band` fresh on the instance.

`listen(rig)` is the join: for each WAV path from `captureUtterances`, snapshot `rig.frequency`/`rig.mode`/`rig.band` immediately (before the slow transcribe call), then await `transcribe()`, then `yield` a `Transcript` with all of that bundled. Consumers do `for await (const transcript of listen(rig))`.

## Architecture notes

### Audio capture

One long-lived bash pipeline. ffmpeg streams raw PCM (s16le, 16 kHz mono — matches Whisper's internal input rate, no point sampling higher) to sox, which uses the `silence` effect with `:newfile :restart` to write one WAV per take. Each session creates its own timestamped subdirectory under `captures/`. Sox auto-numbers files within it (`utterance.wav`, `utterance001.wav`, ...).

`captureUtterances()` is an async generator. It yields a WAV path _when the next file is opened_ — that's when sox has just closed the previous one, so it's safe to read. The in-progress file at abort time is never yielded (it's empty: sox is sitting in skip-silence mode waiting for the next take).

### Why a bash pipeline instead of two Node-spawned processes?

We tried one persistent ffmpeg piped to many spawned sox processes (one per utterance). After the first take, subsequent sox processes mysteriously saw EOF on stdin after ~80 ms with no clear cause — extensive diagnosis (event listeners on the source stream, manual byte forwarding, sox `-V3`) showed sox cleanly consumed a small burst and exited, but nothing in our code was closing the pipe. Sox's own `:newfile :restart` chain sidesteps the whole problem: one sox process for the whole session, segmentation handled internally.

### Signal handling in `capture.sh`

Bash doesn't forward signals to a foreground pipeline by default. The script installs a `trap` that kills the whole job group on `EXIT`/`INT`/`TERM` so ffmpeg + sox die cleanly when Node aborts.

### Why rigctld instead of node-serialport?

We first tried talking to the FT-991 directly via the `serialport` npm package on macOS. It consistently failed in a way that took several hours to root-cause: `port.isOpen` returned `true`, writes "succeeded" with no error and drain confirmed, but the rig never sent anything back. `rigctl` on the same port/baud worked fine.

Root cause: `node-serialport` on macOS has a long-standing IOSSIOSPEED/tcsetattr ordering bug (see issues #1077, #2699). The OS-X-specific `IOSSIOSPEED` ioctl is the only way to actually set baud on these Silicon Labs CP210x driver paths; standard `tcsetattr` silently leaves the port at 9600. node-serialport's open path calls `tcsetattr` after `IOSSIOSPEED` in some refactorings, which wipes out the custom baud — so the port stays physically at 9600 even when we ask for 38400. `stty` exhibits the same problem and isn't a usable workaround.

Hamlib's `rigctld` does the IOSSIOSPEED ordering correctly. Rather than patch around the serialport bug, we spawn `rigctld` as a child process at `Rig.connect()` time and talk to it over TCP. Extra process to manage, but the line protocol is simpler than CAT framing and hamlib handles all the rig-specific quirks.

### `rigctld` lifecycle

`Rig.connect()` → `RigCtlD_Socket.open()` → `spawn('rigctld', ['-m', model, '-r', port, '-s', baud, '-t', 4532])`. The TCP connect retries with 100 ms backoff up to 5 seconds while rigctld is starting up.

`rig.close()` calls `socket.close()`, which `end()`s the TCP socket and `process.kill()`s the child. No PID files or external daemons — each Node process owns its own rigctld instance.

### Rigctld protocol notes

The protocol is one command per line. Commands prefixed with `+` get extended/labeled output terminated by `RPRT N` (where N=0 on success, negative on error). Without the prefix, responses are bare values with no terminator, which is harder to parse safely — so we always use `+` from the Rig class.

`RigCtlD_Socket` serializes transactions through an internal chain: `send()` awaits any prior in-flight transaction, writes the command, and remembers the chain-release callback. `readLine()` returns lines as they arrive; when it sees one starting with `RPRT`, it releases the chain so the next `send()` can proceed. Callers _must_ read until `RPRT` for each `send()` or the chain stays locked.

### FT-991 specifics

- The rig enumerates as two USB-serial devices (Silicon Labs CP210x). Convention: the lower-numbered (`-0`) suffix is typically the Enhanced / CAT port; the higher (`-1`) is the Standard / RTS-for-PTT port. Confirm via `npm run rig:devices` + trial.
- AI (Auto-Information) mode is unreliable on the FT-991 — the rig doesn't broadcast unsolicited state changes when the VFO is turned. We poll explicitly (every 100 ms) instead of subscribing.
- The rig's built-in soundcard is a separate USB audio device, unrelated to either serial port. List it with `npm run audio:devices`.

## TypeScript style

- **Top-down function order**: exported / main function first, helpers below. Function declarations hoist, so this works without forward-reference issues.
- **`function foo()` declarations** for named module-level functions, not `const foo = () => ...`. Arrow functions are fine inline for callbacks.
- **Full words for variable names**, not abbreviations or single letters: `frequency` not `hz`, `mode` not `m`, `megahertz` not `mhz`, `command` not `cmd`, `previousLine` not `last`. Trivial loop indices can stay short.
- Strict mode is on; no `any` cheats.
- Default to no comments. Add `/* ... */` only when the _why_ isn't obvious from the code (e.g. protocol notes, ordering invariants). Don't write JSDoc / docstrings.

## What's next

1. **Structured extraction** — replace the cleanup pass in `transcribe.ts` with a JSON-schema `gpt-4o-mini` call returning `{ text, callsigns, sender, recipient }` so transcripts become queryable by entity. The `Transcript` type in `listen.ts` then grows to carry that structure.
2. **Redis Agent Memory REST client** — POST each `Transcript` (from `listen()`) to `/v1/stores/{storeId}/session-memory`, recall via `/long-term-memory/search`. Auth: `Bearer <API_KEY>`. Env vars: `MEMORY_API_HOST`, `MEMORY_API_KEY`, `MEMORY_STORE_ID`.
3. **LangGraph agent** — chat agent with tools: `setFrequency`, `setMode`, `getRigStatus`, `recallMemory`, `searchTranscripts`. This is where the natural-language frequency parsing ("tune to 14.250 USB" → `rig.frequency = 14_250_000; rig.mode = Mode.USB`) lives.
4. **Ink TUI** — single-process app combining the listener loop, the chat agent, and three panes: chat / live transcripts / rig status.
