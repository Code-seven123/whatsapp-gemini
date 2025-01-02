export interface Data  {
  id?: string | null | undefined,
  personalId?: string | null | undefined,
  username?: string | null | undefined,
  text?: string | null | undefined
}

export interface MessagePart {
  text: string;
}

export interface Message {
  role: 'user' | 'model',
  parts: MessagePart[]
}

export interface MessageGrub {
  groupId: string;
  messages: Message[];
}