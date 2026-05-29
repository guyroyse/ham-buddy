import { HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'

// import dedent from 'dedent'
// import { AIMessage } from '@langchain/core/messages'

import type { ChatbotState } from '@chatbot/state'

// const PREFERENCE_FETCH_LIMIT = 5
// const PREFERENCE_SEARCH_QUERY = 'The user has preferences, interests, opinions, and personal facts known about them.'

export async function promptEnricher(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const { sessionId, username, userMessage } = state

  const [preferenceMessage, historyMessages] = await Promise.all([
    fetchUserPreferenceMessage(username),
    fetchMessageHistory(sessionId)
  ])

  const promptMessages: BaseMessage[] = []

  if (preferenceMessage !== null) promptMessages.push(preferenceMessage)
  promptMessages.push(...historyMessages, new HumanMessage(userMessage))

  return { promptMessages }
}

async function fetchUserPreferenceMessage(_username: string): Promise<SystemMessage | null> {
  return null
}

async function fetchMessageHistory(_sessionId: string): Promise<BaseMessage[]> {
  return []
}
