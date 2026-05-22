import { agentMemory } from '@memory/client'
import type { ChatbotState } from '@chatbot/state'

export async function memorySaver(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const { sessionId, username, userMessage, responseMessage } = state
  const createdAt = new Date()

  await agentMemory.addSessionEvent({
    sessionId,
    actorId: username,
    role: 'USER',
    content: [{ text: userMessage }],
    createdAt
  })

  await agentMemory.addSessionEvent({
    sessionId,
    actorId: 'ham-buddy',
    role: 'ASSISTANT',
    content: [{ text: responseMessage }],
    createdAt
  })

  return {}
}
