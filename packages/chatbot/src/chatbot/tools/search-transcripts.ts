import dedent from 'dedent'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

const schema = z.object({
  query: z
    .string()
    .describe('Focused semantic search query — topic, name, term mentioned, etc. Not the raw user message.')
})

type Args = z.infer<typeof schema>

async function impl(_args: Args) {
  return 'No matching transcripts found.'
}

const params = {
  name: 'searchTranscripts',
  description: dedent`
      Semantic search over transmissions previously heard by listener agents.
      Returns up to 10 best matches as prose memories. Use when the user asks
      about anything that may have been heard.`,
  schema: schema
}

export const searchTranscripts = tool(impl, params)
