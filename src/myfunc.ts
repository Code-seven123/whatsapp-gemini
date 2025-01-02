import { GoogleGenerativeAI } from "@google/generative-ai"
import type { MessagePart, Message, MessageGrub } from "./mytypes"


const conversations: MessageGrub[] = [];
export function addMessageToGroup(groupId: string, text: string): string {
  const conversationGroup = conversations.find(group => group.groupId === groupId)
  if (conversationGroup) {
    conversationGroup.messages.push({
      role: 'user',
      parts: [{ text: text }]
    })
    return "Succes adding message"
  } else {
    conversations.push({
      groupId,
      messages: [{
        role: 'user',
        parts: [{ text: text }]
      }]
    })
    console.log(`Sukses membuat grub baru dengan ID: ${groupId}`)
    return "Succes create grub"
  }
  return "Failed"
}
export async function generateResponse(groupId: string, newMessageText: string) {
  const modelName = "gemini-1.5-flash"
  const AI = new GoogleGenerativeAI(process.env.API_KEY)
  const aiModel = AI.getGenerativeModel({ model: modelName })
  const conversationGroup = conversations.find(group => group.groupId === groupId)
  if (!conversationGroup) {
    console.log('Group not found! Creating new group')
    addMessageToGroup(groupId, newMessageText)
    return "retry"
  }
  try {
    conversationGroup.messages.push({
      role: 'model',
      parts: [{ text: "Gunakan bahasa indonesia dan semanusia mungkin" }]
    })
    const aiRoom = await aiModel.startChat({
      history: conversationGroup.messages
    })
    const response = aiRoom.sendMessage(newMessageText)
    const aiReply = (await response).response.text()!
    conversationGroup.messages.push({
      role: 'user',
      parts: [{ text: newMessageText }]
    })
    return aiReply.trim()
  } catch (error) {
    throw error;
  }
}