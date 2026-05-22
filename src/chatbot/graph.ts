import { StateGraph, START, END } from '@langchain/langgraph'

import { promptEnricher } from '@chatbot/nodes/prompt-enricher.js'
import { radioUsingResponder } from '@chatbot/nodes/radio-using-responder.js'
import { memorySaver } from '@chatbot/nodes/memory-saver.js'
import { ChatbotStateAnnotation } from './state.js'

const builder = new StateGraph(ChatbotStateAnnotation) as any

builder.addNode('prompt-enricher', promptEnricher)
builder.addNode('radio-using-responder', radioUsingResponder)
builder.addNode('memory-saver', memorySaver)

builder.addEdge(START, 'prompt-enricher')
builder.addEdge('prompt-enricher', 'radio-using-responder')
builder.addEdge('radio-using-responder', 'memory-saver')
builder.addEdge('memory-saver', END)

export const graph = builder.compile()
