import { listen } from '../capture/listen.js'
import { Rig } from '../rig/rig.js'

const rig = await Rig.connect()

process.on('SIGINT', () => {
  console.log('\nstopping')
  rig.close()
  process.exit(0)
})

console.log('listening — Ctrl+C to stop\n')

try {
  for await (const transcript of listen(rig)) {
    const frequencyDisplay =
      transcript.frequency !== null ? `${(transcript.frequency / 1_000_000).toFixed(6)} MHz` : '—'
    console.log(`[${frequencyDisplay}  ${transcript.mode ?? '—'}  ${transcript.band ?? '—'}]`)
    console.log(`  ${transcript.text}\n`)
  }
} catch (err) {
  console.error('error:', (err as Error).message)
  process.exit(1)
}
