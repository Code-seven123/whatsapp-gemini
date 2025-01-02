import { readdir } from "node:fs/promises"
import { unlink } from "node:fs/promises"

// Get files in folder sessios
let sessionsFIles: Array<string> = await readdir("./sessions", { recursive: true })
sessionsFIles = sessionsFIles.map(i => `./sessions/${i}`)
const files: Array<string> = [...sessionsFIles, "./WA_STORE.json", "./wa-logs.txt"]

// Deleting file
for( const file of files ) {
  if(await Bun.file(file).exists().catch(() => false)) {
    unlink(file)
    console.log("Sucess deleted Session: \n", files.join("\n"))
  } else {
    console.log("Session not found")
    break;
  }
}