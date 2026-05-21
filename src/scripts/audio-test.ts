import { captureUtterances } from '../capture/capture.js'

const controller = new AbortController()
process.on('SIGINT', () => {
  console.log('\nstopping')
  controller.abort()
})

console.log('listening — Ctrl+C to stop\n')

try {
  for await (const path of captureUtterances(controller.signal)) {
    console.log(`captured -> ${path}`)
  }
} catch (err) {
  console.error('error:', (err as Error).message)
  process.exit(1)
}
