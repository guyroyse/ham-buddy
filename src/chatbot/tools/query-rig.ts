import dedent from 'dedent'
import { z } from 'zod'
import { tool } from '@langchain/core/tools'

import { Rig } from '@rig/rig'

const QueryRigArgumentsSchema = z.object({})

type QueryRigArguments = z.infer<typeof QueryRigArgumentsSchema>

export const queryRig = tool(
  async (_args: QueryRigArguments): Promise<string> => {
    const { frequency, mode, band } = Rig.instance

    const frequencyText = frequency !== null ? `${(frequency / 1_000_000).toFixed(6)} MHz` : 'unknown'
    const modeText = mode ?? 'unknown'
    const bandText = band ?? 'unknown'

    return `Frequency: ${frequencyText}, Mode: ${modeText}, Band: ${bandText}.`
  },
  {
    name: 'queryRig',
    description: dedent`
      Read the radio's current frequency, mode, and band. Takes no arguments.
      Returns a human-readable summary string. Call this when the user asks
      what the rig is doing or what it's tuned to.`,
    schema: QueryRigArgumentsSchema
  }
)
