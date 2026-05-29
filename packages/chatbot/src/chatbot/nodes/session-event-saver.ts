import type { ChatbotState } from '@chatbot/state'

export async function sessionEventSaver(_state: ChatbotState): Promise<Partial<ChatbotState>> {
  return {}
}
