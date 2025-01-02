import { describe, it, expect } from "bun:test"
import { generateResponse, addMessageToGroup } from "../src/myfunc"

describe("Baileys Ai Test Runner", async () => {
  it("Gemini response", async () => {
    const res1 = await generateResponse("1", "Say OK!")
    expect(res1).toBe("retry")
    const res2 = await generateResponse("1", "Say OK!")
    expect(res2).toBe("OK!")
  })
  it("Creating grub message", async () => {
    const res = await addMessageToGroup("2", "test")
    expect(res).toBe("Succes create grub")
  })
  it("Adding message", async () => {
    await addMessageToGroup("3", "test")
    const res = await addMessageToGroup("3", "test")
    expect(res).toBe("Succes adding message")
  })
})
