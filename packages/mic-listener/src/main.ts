import chalk from 'chalk'

import { config } from '@config/config'

import { ingest } from './ingest/ingest.js'

process.on('SIGINT', () => {
  console.log(chalk.dim('\nstopping'))
  process.exit(0)
})

console.log(chalk.dim('Earshot Mic Listener — Ctrl+C to stop\n'))
console.log()
console.log(`${chalk.yellow('Memory:')}  ${config.memory.host} (store=${config.memory.storeId})`)
console.log(`${chalk.yellow('Owner:')}   ${config.listenerOwnerId}`)
console.log(`${chalk.yellow('Audio:')}   device=${config.audio.device} → ${config.audio.outputDir}`)
console.log(`${chalk.yellow('Context:')} ${config.audio.locationContext ?? ''}`)
console.log()

try {
  await ingest()
} catch (err) {
  console.error(chalk.red('error:'), (err as Error).message)
  process.exit(1)
}
