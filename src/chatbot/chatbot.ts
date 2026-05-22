import { HumanMessage } from '@langchain/core/messages'

import { graph } from './graph.js'

export async function chat(message: string): Promise<string> {
  const inputState = { messages: new HumanMessage(message) }

  const finalState = await graph.invoke(inputState)

  const lastMessage = finalState.messages[finalState.messages.length - 1]
  const content = lastMessage?.content
  return typeof content === 'string' ? content : ''
}
