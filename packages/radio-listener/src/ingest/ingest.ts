import chalk from 'chalk'

import { enrichTransmission } from '@enricher/enricher'
import { captureTransmissions } from './transmissions.js'
import { formatTransmission } from './format.js'

export async function ingest(): Promise<void> {
  for await (const transmission of captureTransmissions()) {
    const enriched = await enrichTransmission(transmission)
    const transmissionAsText = formatTransmission(enriched)
    logTransmission(transmissionAsText, transmission.audioPath, enriched.text)
    await storeMemory(transmissionAsText)
  }
}

function logTransmission(description: string, audioPath: string, rawText: string): void {
  console.log(chalk.blue('------------------------------------------------------------'))
  console.log()
  console.log(chalk.yellow('Memory captured:'))
  console.log(description)
  console.log()
  console.log(chalk.yellow('Audio path:'))
  console.log(chalk.white(audioPath))
  console.log()
  console.log(chalk.yellow('Raw text:'))
  console.log(chalk.white(rawText))
  console.log('')
}

async function storeMemory(_description: string): Promise<void> {}
