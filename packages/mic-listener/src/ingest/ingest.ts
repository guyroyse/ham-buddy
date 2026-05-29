import chalk from 'chalk'
import { ulid } from 'ulid'

import { MemoryType } from '@redis-iris/agent-memory/models'

import { config } from '@config/config'
import { agentMemory } from '@memory/client'
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

async function storeMemory(description: string): Promise<void> {
  const id = ulid()
  const text = description
  const memoryType = MemoryType.Episodic
  const ownerId = config.listenerOwnerId

  try {
    await agentMemory.bulkCreateLongTermMemories({
      memories: [{ id, text, memoryType, ownerId }]
    })
  } catch (err) {
    console.error(chalk.red('store memory failed:'), err)
  }
}
