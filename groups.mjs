/**
 * Shared Group Rooms & Multi-Agent Fan-Out for Hermes Bot Mode
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

export class GroupManager {
  constructor(baseDir = join(homedir(), '.hermes', 'agent-data', 'agents')) {
    this.baseDir = baseDir
    mkdirSync(this.baseDir, { recursive: true })
  }

  createGroup({ name, memberIds = [], description = '' }) {
    const groupId = randomUUID()
    const groupDir = join(this.baseDir, groupId)
    mkdirSync(groupDir, { recursive: true })

    const meta = {
      id: groupId,
      name,
      description,
      memberIds,
      createdAt: Date.now()
    }

    writeFileSync(join(groupDir, 'group.json'), JSON.stringify(meta, null, 2), 'utf8')
    writeFileSync(join(groupDir, 'room.jsonl'), '', 'utf8')
    return meta
  }

  getGroup(groupId) {
    const file = join(this.baseDir, groupId, 'group.json')
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, 'utf8'))
  }

  listGroups() {
    if (!existsSync(this.baseDir)) return []
    const groups = []
    for (const entry of readdirSync(this.baseDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const file = join(this.baseDir, entry.name, 'group.json')
        if (existsSync(file)) {
          try {
            groups.push(JSON.parse(readFileSync(file, 'utf8')))
          } catch {}
        }
      }
    }
    return groups
  }

  postToRoom({ groupId, senderName, content }) {
    const group = this.getGroup(groupId)
    if (!group) throw new Error(`Group room ${groupId} not found`)

    const msg = {
      id: randomUUID(),
      groupId,
      senderName,
      content,
      timestamp: Date.now()
    }

    const logFile = join(this.baseDir, groupId, 'room.jsonl')
    appendFileSync(logFile, JSON.stringify(msg) + '\n', 'utf8')

    // Build fan-out CLI commands for member agents
    const commands = group.memberIds
      .filter(m => m !== senderName)
      .map(member => ({
        targetAgent: member,
        cliCommand: `hermes -p ${member} chat --in ~ -c "[Room: ${group.name}]" -Q -q "[Room: ${group.name}] 🤖 ${senderName} (@${senderName}): ${content.replace(/"/g, '\\"')}"`
      }))

    return {
      message: msg,
      fanOutCount: commands.length,
      fanOutCommands: commands
    }
  }
}
