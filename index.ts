import WaSocket, {
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  proto,
  downloadContentFromMessage,
  downloadMediaMessage, 
  type WAMessageKey,
  type WAMessageContent
} from "@whiskeysockets/baileys"
import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import P from 'pino'
import { GoogleGenerativeAI } from "@google/generative-ai"
import * as dotenv from "dotenv"
dotenv.config()

interface Data  {
  id?: string | null | undefined,
  personalId?: string | null | undefined,
  username?: string | null | undefined,
  text?: string | null | undefined
}

interface MessagePart {
  text: string;
}

interface Message {
  role: 'user' | 'model',
  parts: MessagePart[]
}

interface MessageGrub {
  groupId: string;
  messages: Message[];
}

const conversations: MessageGrub[] = [];

const logger = P({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
  level: "error"
}, P.destination('./wa-logs.txt'))

const msgRetryCounterCache = new NodeCache()


const store = makeInMemoryStore({ logger })
store?.readFromFile('./WA_STORE.json')
// save every 10s
setInterval(() => {
	store?.writeToFile('./WA_STORE.json')
}, 10_000)
const modelName = "gemini-1.5-flash"
const AI = new GoogleGenerativeAI(process.env.API_KEY)
const aiModel = AI.getGenerativeModel({ model: modelName })

function addMessageToGroup(groupId: string, text: string) {
  const conversationGroup = conversations.find(group => group.groupId === groupId)
  if (conversationGroup) {
    conversationGroup.messages.push({
      role: 'user',
      parts: [{ text: text }]
    })
  } else {
    // Jika grup belum ada, buat grup baru
    conversations.push({
      groupId,
      messages: [{
        role: 'user',
        parts: [{ text: text }]
      }]
    })
  }
}

async function generateResponse(groupId: string, newMessageText: string) {
  const conversationGroup = conversations.find(group => group.groupId === groupId)
  if (!conversationGroup) {
    console.log('Group not found! Creating new group')
    addMessageToGroup(groupId, newMessageText)
    console.log(`Sukses membuat grub baru dengan ID: ${groupId}`)
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

const WA = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('sessions')
	
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)
  const conn = WaSocket({
		version,
		logger,
		printQRInTerminal: true,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		msgRetryCounterCache,
		generateHighQualityLinkPreview: true,
		getMessage,
	})

	store?.bind(conn.ev)

  conn.ev.process(async (e) => {
    try {
      if(e['connection.update']) {
        const update = e['connection.update']
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
          // reconnect if not logged out
          if((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
            WA()
          } else {
            console.log('Connection closed. You are logged out.')
          }
        }
      }
      if(e['creds.update']) {
        await saveCreds()
      }
      if(e['messages.upsert']) {
        const m = e['messages.upsert']
        if(m.type === "notify") {
          for (const msg of m?.messages) {
            const reply = async (jid: string, text: string) => {
              const res = await conn.sendMessage(jid, { text: text }, { quoted: msg })
              return res
            }
            let data: Data = {
              id: msg?.key?.remoteJid!,
              personalId: msg.key!.remoteJid!.endsWith("@g.us")
                ? msg?.key?.participant
                : msg?.key?.remoteJid,
              username: msg?.pushName!,
              text:
                msg?.message?.extendedTextMessage?.text! ?? 
                msg?.message?.interactiveResponseMessage?.body?.text ??
                msg?.message?.conversation ??
                msg?.message?.videoMessage ??
                msg?.message?.imageMessage?.caption
                
            }
            console.log(`\nMessage from ${data?.username || 'anonim'}\nMessage : \n\t ${data?.text || 'kosong'}`)
            const messageType = Object.keys(msg.message!)[0] ?? []
            let mediaBuffer = null
            let mediaType = null
            // if(messageType != "protocolMessage") {
            //   if(messageType === "extendedTextMessage"){
            //     const quotedMessage = msg!.message!.extendedTextMessage!.contextInfo!.quotedMessage
            //     const qutedGif = Object.keys(quotedMessage?.videoMessage ?? { text: "undefined" })
            //     if(Object.keys(quotedMessage!)[0] === "imageMessage"){
            //       const stream = await downloadContentFromMessage(quotedMessage?.imageMessage ?? {}, "image")
            //       let buffer = Buffer.from([])
            //       for await ( const chunk of stream ){
            //         buffer = Buffer.concat([buffer, chunk])
            //       }
            //       mediaBuffer = buffer
            //       mediaType = "image/jpeg"
            //     } else if(Object.keys(quotedMessage!)[0] === "videoMessage" && qutedGif.includes("gifAttribution")) {
            //       const stream = await downloadContentFromMessage(quotedMessage?.videoMessage!, "video")
            //       let buffer = Buffer.from([])
            //       for await ( const chunk of stream ){
            //         buffer = Buffer.concat([buffer, chunk])
            //       }
            //       mediaBuffer = buffer
            //       mediaType = "video/mp4"
            //     } else {
            //       await reply(data.id!, "Quoted message not image or gif")
            //     }
            //   } else if(messageType === "imageMessage"){
            //     mediaBuffer = await downloadMediaMessage(
            //       msg,
            //       "buffer",
            //       {},
            //       {
            //         logger,
            //         reuploadRequest: conn.updateMediaMessage
            //       }
            //     )
            //     mediaType = "image/jpeg"
            //   } else if(messageType === "videoMessage") {
            //     mediaBuffer = await downloadMediaMessage(
            //       msg,
            //       "buffer",
            //       {},
            //       {
            //         logger,
            //         reuploadRequest: conn.updateMediaMessage
            //       }
            //     )
            //     mediaType = "video/mp4"
            //   }
            // }
            // if(!!mediaBuffer && !!mediaType) {
              // media AI not supported
            // } else {
              try {
                let response = await generateResponse(data.id!, data.text!)
                if(response === "retry") {
                  response = await generateResponse(data.id!, data.text!)
                  await conn.readMessages([msg.key!])
                  reply(data.id!, response)
                } else {
                  await conn.readMessages([msg.key!])
                  reply(data.id!, response)
                }
              } catch (error) {
                conn.sendMessage(data.id!, { text: "> *AI ERROR*" })
                console.error(error)
              }
            // }
            // console.log(mediaType, mediaBuffer)
          }
        }
      }
    } catch (error) {
      console.error('Error processing event:', error);
      logger.error(error, 'Error processing event:')
    }
  })
  return conn

	async function getMessage(key: WAMessageKey): Promise<WAMessageContent | undefined> {
		if(store) {
			const msg = await store.loadMessage(key.remoteJid!, key.id!)
			return msg?.message || undefined
		}

		// only if store is present
		return proto.Message.fromObject({})
	}

}
WA()