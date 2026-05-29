import chalk from 'chalk'

import { enrichRecording } from '@enricher/enricher'

import { captureRecordings } from './recordings.js'
import { formatRecording } from './format.js'

export async function ingest(): Promise<void> {
  for await (const recording of captureRecordings()) {
    const enriched = await enrichRecording(recording)
    const recordingAsText = formatRecording(enriched)
    logRecording(recordingAsText, recording.audioPath, enriched.text)
    await storeMemory(recordingAsText)
  }
}

function logRecording(description: string, audioPath: string, rawText: string): void {
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
