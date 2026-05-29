import chalk from 'chalk'

import { config } from '@config/config'
import { Rig } from '@rig/rig'

import { ingest } from './ingest/ingest.js'

console.log(chalk.dim('Earshot Radio Listener — Ctrl+C to stop\n'))
console.log()
console.log(`${chalk.yellow('Memory:')}  ${config.memory.host} (store=${config.memory.storeId})`)
console.log(`${chalk.yellow('Owner:')}   ${config.listenerOwnerId}`)
console.log(`${chalk.yellow('Audio:')}   device=${config.audio.device} → ${config.audio.outputDir}`)
console.log(`${chalk.yellow('Rig:')}     model=${config.rig.model} on ${config.rig.port} @ ${config.rig.baud} baud`)
console.log(`${chalk.yellow('Context:')} ${config.audio.locationContext ?? ''}`)
console.log()

await Rig.connect()

process.on('SIGINT', () => {
  console.log(chalk.dim('stopping...'))
  Rig.instance.close()
  process.exit(0)
})

try {
  await ingest()
} catch (err) {
  console.error(chalk.red('error:'), (err as Error).message)
  Rig.instance.close()
  process.exit(1)
}
