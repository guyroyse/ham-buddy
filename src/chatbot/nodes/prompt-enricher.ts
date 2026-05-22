import { HumanMessage, AIMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'

import { agentMemory } from '@memory/client'
import type { ChatbotState } from '@chatbot/state'

export async function promptEnricher(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const { sessionId, userMessage } = state

  const events = await fetchSessionEvents(sessionId)
  const historyMessages = events.map(toBaseMessage)
  const promptMessages: BaseMessage[] = [...historyMessages, new HumanMessage(userMessage)]

  return { promptMessages }
}

async function fetchSessionEvents(sessionId: string) {
  try {
    const response = await agentMemory.getSessionMemory(sessionId)
    return response.events
  } catch {
    /* A 404 on the first turn of a session is expected — treat as empty history. */
    return []
  }
}

function toBaseMessage(event: { role: string; content: Array<{ text: string }> }): BaseMessage {
  const text = event.content.map(part => part.text).join('')
  if (event.role === 'USER') return new HumanMessage(text)
  if (event.role === 'ASSISTANT') return new AIMessage(text)
  return new SystemMessage(text)
}
