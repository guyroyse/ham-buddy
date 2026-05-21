import { spawn } from 'node:child_process'

interface Device {
  index: string
  name: string
}

async function main(): Promise<void> {
  const devices = await listAvfoundationAudioDevices()
  if (devices.length === 0) {
    console.log('no avfoundation audio devices found')
    return
  }
  console.log('avfoundation audio devices:')
  for (const d of devices) {
    console.log(`  [${d.index}] ${d.name}`)
  }
  console.log('')
  console.log('Set AUDIO_DEVICE in .env to the index (e.g. "1") or the device name (e.g. "USB Audio CODEC")')
}

function listAvfoundationAudioDevices(): Promise<Device[]> {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''])
    let stderr = ''
    proc.stderr.on('data', c => {
      stderr += c.toString()
    })
    proc.on('error', err => {
      const hint =
        (err as NodeJS.ErrnoException).code === 'ENOENT' ? ' Is ffmpeg installed? Try: brew install ffmpeg' : ''
      rejectPromise(new Error(`Failed to run ffmpeg:${hint}`))
    })
    proc.on('exit', () => resolvePromise(parseDevices(stderr)))
  })
}

function parseDevices(stderr: string): Device[] {
  const devices: Device[] = []
  let inAudio = false
  for (const line of stderr.split('\n')) {
    if (/AVFoundation video devices/i.test(line)) {
      inAudio = false
      continue
    }
    if (/AVFoundation audio devices/i.test(line)) {
      inAudio = true
      continue
    }
    if (!inAudio) continue
    const m = line.match(/\[(\d+)\]\s+(.+?)\s*$/)
    if (m && m[1] && m[2]) devices.push({ index: m[1], name: m[2] })
  }
  return devices
}

main().catch(err => {
  console.error('error:', (err as Error).message)
  process.exit(1)
})
