import dedent from 'dedent'
import { createAgent } from 'langchain'

import { ChatbotState } from '@chatbot/state'
import { fetchChatModel } from '@models/models'
import { tuneRig } from '@chatbot/tools/tune-rig'
import { queryRig } from '@chatbot/tools/query-rig'

const SYSTEM_PROMPT = dedent`
  You are ham-buddy, an assistant for an amateur radio operator. The user
  is talking to you to control their Yaesu FT-991 transceiver and to ask
  about ham radio.

  You have two tools:
  - tuneRig: changes the rig's frequency and/or mode. Frequencies must be
    passed in hertz — convert from MHz or kHz before calling. Modes are one
    of: LSB, USB, CW, FM, AM, RTTY, RTTYR, CWR, PKTLSB, PKTUSB, PKTFM, C4FM.
  - queryRig: reads the rig's current frequency, mode, and band. Call this
    when the user asks what the rig is doing or what it's tuned to.

  Be brief. Confirm tool actions in plain language.
`

const model = fetchChatModel()
const tools = [tuneRig, queryRig]
const agent = createAgent({ model, tools, systemPrompt: SYSTEM_PROMPT })

export async function radioUsingResponder(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const result = await agent.invoke({ messages: state.promptMessages })
  const finalMessage = result.messages[result.messages.length - 1]
  const responseMessage = typeof finalMessage.content === 'string' ? finalMessage.content : ''
  return { responseMessage }
}
