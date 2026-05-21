import { createReadStream } from 'node:fs'
import dedent from 'dedent'
import OpenAI from 'openai'
import { config } from '../config.js'

/* Whisper prompt: focus on things the cleanup model can't recover from once
   Whisper gets them wrong — callsign letter/digit shapes, NATO phonetics
   (so spelled callsigns come through as discrete words), signal reports.
   The richer jargon (POTA, equipment, awards) is handled downstream where
   there's no token cap. */
const WHISPER_PROMPT = dedent`
  Amateur radio QSO with spelled callsigns like K1ABC, W4XYZ, KD8ZZZ,
  VE3ABC, G0XYZ. Signal reports: 599, five by nine. Greetings: CQ, 73.
  Phonetics: Alfa, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel,
  India, Juliet, Kilo, Lima, Mike, November, Oscar, Papa, Quebec, Romeo,
  Sierra, Tango, Uniform, Victor, Whiskey, X-ray, Yankee, Zulu.
`

const CORRECTION_SYSTEM_PROMPT = dedent`
  You are cleaning up transcripts of amateur (ham) radio conversations.
  The audio came from OpenAI Whisper and may have misheard ham jargon.

  Your job: fix obvious mistranscriptions of ham terminology and preserve
  everything else verbatim. Do not paraphrase, summarize, or invent content.
  If you are not confident a word is wrong, leave it alone. Output only the
  corrected transcript with no preamble or commentary.

  Ham vocabulary to recognize:

  - Callsigns: 1-2 letters + digit + 1-3 letters, often spelled phonetically
    on air. Collapse spelled callsigns to their compact form:
      "kilo one alfa bravo charlie" → "K1ABC"
      "whiskey four x-ray yankee zulu" → "W4XYZ"
    Common prefixes: K, W, N, AA-AK (US); VE (Canada); G, M (UK);
    JA (Japan); VK (Australia); DL (Germany).
  - Q-codes (write upper-case): QSO, QSL, QRZ, QRM, QRN, QRP, QRO, QRT,
    QSY, QTH, QSB, QRX.
  - Sign-offs and greetings: CQ (often misheard "seek you" / "see queue"),
    73 (often misheard "seventy three" / "seven three"), 88.
  - Signal reports: 599, "5 by 9", "five nine".
  - Modes: SSB, USB, LSB, CW, FT8, FT4, AM, FM, RTTY, PSK31, JS8.
  - Bands: 160 / 80 / 40 / 30 / 20 / 17 / 15 / 12 / 10 / 6 / 2 meters,
    70 centimeters; HF, VHF, UHF.
  - Activities and programs: POTA (Parks On The Air), SOTA (Summits On
    The Air), IOTA (Islands On The Air), WWFF, DXpedition, Field Day, net,
    rag chew, contest, activation, hunt, Elmer.
  - Awards and orgs: ARRL, DXCC, WAS, VUCC, WAC, DX, FCC.
  - Equipment: repeater, simplex, duplex, CTCSS, PL tone, DCS, Yagi,
    dipole, vertical, EFHW (end-fed half-wave), G5RV, balun, unun, coax,
    feedline, transceiver, rig, HT (handheld transceiver), ATU
    (antenna tuner).
  - Locations: Maidenhead grid squares, four or six chars (FN31, EM79lw).

  Common Whisper mistakes to watch for:

  - Phonetic callsign spell-outs left as separate words instead of
    collapsed to the compact callsign.
  - "CQ" rendered as "seek you" / "see queue" / "C.Q."
  - "73" rendered as "seventy three" / "seven three".
  - "QSL" rendered as "Q.S.L" / "cue ess ell".
  - POTA/SOTA heard as "potter" / "soda" / "soter".
  - Band numbers spelled out as words — leave them as digits.
`

let client: OpenAI | null = null

export async function transcribe(wavPath: string): Promise<string> {
  const raw = await transcribeAudio(wavPath)
  return await correct(raw)
}

async function transcribeAudio(wavPath: string): Promise<string> {
  const result = await openai().audio.transcriptions.create({
    file: createReadStream(wavPath),
    model: 'whisper-1',
    language: 'en',
    prompt: WHISPER_PROMPT
  })
  return result.text
}

async function correct(text: string): Promise<string> {
  const response = await openai().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
      { role: 'user', content: text }
    ]
  })
  return response.choices[0]?.message?.content?.trim() ?? text
}

function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: config.openai.apiKey })
  return client
}
