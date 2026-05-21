import { SerialPort } from 'serialport'

const ports = await SerialPort.list()

if (ports.length === 0) {
  console.log('no serial ports found')
  process.exit(0)
}

console.log('serial ports:')
for (const p of ports) {
  const bits = [p.manufacturer, p.serialNumber].filter(Boolean).join(' · ')
  console.log(`  ${p.path}${bits ? `  (${bits})` : ''}`)
}

console.log('')
console.log('Set RIG_PORT in .env to the FT-991 Enhanced port (CAT). The Standard port is for RTS / PTT keying. (Audio is on a separate USB sound card — see `npm run audio:devices`.)')
