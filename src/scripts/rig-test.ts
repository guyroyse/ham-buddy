import { createInterface } from 'node:readline/promises'
import { Rig, Mode } from '../rig/rig.js'

const rig = await Rig.connect()

process.on('SIGINT', () => {
  console.log('\nstopping')
  rig.close()
  process.exit(0)
})

const readline = createInterface({ input: process.stdin, output: process.stdout })

let previousLine = ''
setInterval(() => {
  const frequency = rig.frequency !== null ? `${(rig.frequency / 1_000_000).toFixed(6)} MHz` : '—'
  const line = `${frequency}  ${rig.mode ?? '—'}  ${rig.band ?? '—'}`
  if (line !== previousLine) {
    process.stdout.write(`\r${line}\n`)
    previousLine = line
  }
}, 200)

console.log('connected')
console.log('  freq <MHz>   set frequency, e.g. "freq 146.52"')
console.log('  mode <NAME>  set mode, e.g. "mode FM" (USB, LSB, CW, FM, AM, ...)')
console.log('  Ctrl+C to stop\n')

while (true) {
  const input = (await readline.question('> ')).trim()
  if (!input) continue

  const [command, value] = input.split(/\s+/)
  if (command === 'freq') {
    const megahertz = Number(value)
    if (!Number.isFinite(megahertz)) {
      console.log('invalid frequency')
      continue
    }
    rig.frequency = Math.round(megahertz * 1_000_000)
  } else if (command === 'mode') {
    const mode = value?.toUpperCase()
    if (!mode) {
      console.log('mode required')
      continue
    }
    rig.mode = mode as Mode
  } else {
    console.log(`unknown command: ${command}`)
  }
}
