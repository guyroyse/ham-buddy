import dedent from 'dedent'
import { createAgent, SystemMessage } from 'langchain'

import { ChatbotState } from '@chatbot/state'
import { fetchChatModel } from '@models/models'
import { tuneRig } from '@chatbot/tools/tune-rig'

const SYSTEM_PROMPT = dedent`
  You are ham-buddy, an assistant for an amateur radio operator. The user
  is talking to you to control their Yaesu FT-991 transceiver and to ask
  about ham radio.

  You have a tool, tuneRig, that changes the rig's frequency and/or mode.
  Frequencies must be passed in hertz — convert from MHz or kHz before
  calling. Modes are one of: LSB, USB, CW, FM, AM, RTTY, RTTYR, CWR,
  PKTLSB, PKTUSB, PKTFM, C4FM.

  Be brief. Confirm tool actions in plain language.
`

const model = fetchChatModel()
const tools = [tuneRig]
const agent = createAgent({ model, tools, systemPrompt: SYSTEM_PROMPT })

export async function radioUsingResponder(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const systemMessage = new SystemMessage(SYSTEM_PROMPT)
  const humanMessage = state.messages[state.messages.length - 1]
  const inputMessages = [systemMessage, humanMessage]

  const result = await agent.invoke({ messages: inputMessages })

  const outputMessage = result.messages[result.messages.length - 1]

  return { messages: [outputMessage] }
}
