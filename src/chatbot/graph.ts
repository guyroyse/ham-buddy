import { StateGraph, START, END } from '@langchain/langgraph'

import { radioUsingResponder } from '@chatbot/nodes/radio-using-responder.js'
import { ChatbotStateAnnotation } from './state.js'

const builder = new StateGraph(ChatbotStateAnnotation) as any

builder.addNode('agent', radioUsingResponder)

builder.addEdge(START, 'agent')
builder.addEdge('agent', END)

export const graph = builder.compile()
