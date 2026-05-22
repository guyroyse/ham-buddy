import { createInterface } from 'node:readline/promises'

import { Rig } from '@rig/rig'

import { chat } from '@chatbot/chatbot'

await Rig.connect()

process.on('SIGINT', () => {
  console.log('\nstopping')
  Rig.instance.close()
  process.exit(0)
})

const repl = createInterface({ input: process.stdin, output: process.stdout })

console.log('ham-buddy chat — Ctrl+C to stop\n')

try {
  while (true) {
    const message = (await repl.question('> ')).trim()
    if (message === '') continue
    const reply = await chat(message)
    console.log(reply + '\n')
  }
} catch (err) {
  console.error('error:', (err as Error).message)
  Rig.instance.close()
  process.exit(1)
}
