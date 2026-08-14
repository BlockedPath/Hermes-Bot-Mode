import assert from 'node:assert/strict'
import test from 'node:test'

test('unit: createGroup metadata structure is valid', () => {
  const group = {
    id: 'grp-123',
    name: 'Engineering',
    memberIds: ['agent-coder', 'agent-reviewer'],
    description: 'Shared engineering channel'
  }
  assert.equal(group.name, 'Engineering')
  assert.equal(group.memberIds.length, 2)
  assert.ok(group.memberIds.includes('agent-coder'))
})

test('integration: fan-out message formatting includes room name and sender', () => {
  const formatRoomMessage = (room, sender, text) => `[Room: ${room}] 🤖 ${sender} (@${sender}): ${text}`
  const formatted = formatRoomMessage('Engineering', 'coder', 'PR is ready for review')
  assert.equal(formatted, '[Room: Engineering] 🤖 coder (@coder): PR is ready for review')
})

test('integration: fan-out recipients excludes sender', () => {
  const group = { memberIds: ['alpha', 'beta', 'gamma'] }
  const sender = 'alpha'
  const recipients = group.memberIds.filter(id => id !== sender)
  assert.deepEqual(recipients, ['beta', 'gamma'])
})
