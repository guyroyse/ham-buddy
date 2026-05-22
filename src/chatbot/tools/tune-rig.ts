import dedent from 'dedent'
import { z } from 'zod'
import { tool } from '@langchain/core/tools'

import { Rig } from '@rig/rig'
import { Mode } from '@rig/modes'

const TuneRigArgumentsSchema = z.object({
  frequency: z.number().int().positive().optional().describe('Frequency in hertz. 14.250 MHz is 14250000.'),
  mode: z
    .enum(Mode)
    .optional()
    .describe('Modulation mode. One of LSB, USB, CW, FM, AM, RTTY, RTTYR, CWR, PKTLSB, PKTUSB, PKTFM, C4FM.')
})

type TuneRigArguments = z.infer<typeof TuneRigArgumentsSchema>

export const tuneRig = tool(
  async (args: TuneRigArguments): Promise<string> => {
    const { frequency, mode } = args

    const changes: string[] = []

    if (frequency !== undefined) {
      Rig.instance.frequency = frequency
      changes.push(`frequency ${(frequency / 1_000_000).toFixed(6)} MHz`)
    }

    if (mode !== undefined) {
      Rig.instance.mode = mode
      changes.push(`mode ${mode}`)
    }

    if (changes.length === 0) return 'No change — provide frequency, mode, or both.'

    return `Tuned: ${changes.join(', ')}.`
  },
  {
    name: 'tuneRig',
    description: dedent`
      Tune the radio by setting its frequency, mode, or both. Provide at least
      one of frequency or mode. Frequencies are in hertz — convert from MHz
      before calling (14.250 MHz is 14250000).`,
    schema: TuneRigArgumentsSchema
  }
)
