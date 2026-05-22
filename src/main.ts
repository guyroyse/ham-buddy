import { createInterface } from 'node:readline/promises'

import { config } from '@config/config'
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

const user = config.user.name

try {
  while (true) {
    const message = (await repl.question(`${user}> `)).trim()
    if (message === '') continue
    const reply = await chat(user, message)
    console.log(reply + '\n')
  }
} catch (err) {
  console.error('error:', (err as Error).message)
  Rig.instance.close()
  process.exit(1)
}
