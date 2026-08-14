import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')
function load(hostOverrides = {}) {
  const atom = initial => {
    let value = initial
    return { get: () => value, set: next => { value = next } }
  }
  const contributions = []
  const disposers = []
  const eventHandlers = new Map()
  const context = {
    atom,
    PALETTE_AREA: 'palette',
    ROUTES_AREA: 'routes',
    COMPOSER_AREAS: { middleware: 'middleware' },
    setTimeout,
    clearTimeout,
    document: {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: () => undefined }
    },
    host: {
      state: { profile: { listen: () => undefined }, gateway: 'open' },
      onEvent: (event, handler) => {
        eventHandlers.set(event, handler)
        return () => eventHandlers.delete(event)
      },
      request: async () => ({ profiles: [] }),
      notify: () => undefined,
      notifyError: () => undefined,
      navigate: () => undefined,
      ...hostOverrides
    }
  }
  const code = source
    .replace(/^import\s+\{[\s\S]*?\}\s+from '@hermes\/plugin-sdk'\r?\n/m, '')
    .replace(/^import .* from 'react'\r?\n/m, '')
    .replace(/^import .* from 'react\/jsx-runtime'\r?\n/m, '')
    .replace('export default {', 'globalThis.plugin = {')
    .concat('\nglobalThis.__teams = { normalizeTeams, normalizeTeamLog, projectTeamContext, teamPrompt, teamTargets, routinePrompt, saveTeams, runTeamFanout, teamLogs: $teamLogs, teams: $teams };\n')
  vm.runInNewContext(code, context)
  return {
    api: context.__teams,
    plugin: context.plugin,
    contributions,
    disposers,
    events: eventHandlers,
    register(storage = { get: (_key, fallback) => fallback, set: () => undefined }) {
      context.plugin.register({
        storage,
        register: item => contributions.push(item),
        onDispose: callback => disposers.push(callback)
      })
    }
  }
}

test('unit: normalizeTeams keeps only valid, distinct members from the live roster', () => {
  const { api } = load()
  const teams = api.normalizeTeams({
    version: 1,
    teams: [
      { id: 'Company-A', name: 'Company A', lead: 'alice', members: ['alice', 'bob', 'alice'] },
      { id: 'company-a', name: 'Duplicate', lead: 'alice', members: ['alice', 'bob'] },
      { id: 'invalid', name: 'Invalid', lead: 'alice', members: ['alice', 'missing'] }
    ]
  }, ['alice', 'bob'])
  assert.equal(JSON.stringify(teams), JSON.stringify([{ id: 'company-a', name: 'Company A', lead: 'alice', members: ['alice', 'bob'] }]))
})

test('integration: Team prompt isolates Company A history and routes explicit audience only', () => {
  const { api } = load()
  const team = { id: 'company-a', name: 'Company A', lead: 'alice', members: ['alice', 'bob'] }
  api.teamLogs.set({
    'company-a': [
      { id: 'human-1', turnId: 'prior', authorType: 'human', author: 'operator', body: 'Company A plan', createdAt: 1, state: 'success', error: '' },
      { id: 'alice-1', turnId: 'prior', authorType: 'profile', author: 'alice', body: 'Alice contribution', createdAt: 2, state: 'success', error: '' },
      { id: 'outside-1', turnId: 'prior', authorType: 'profile', author: 'carol', body: 'Company B secret', createdAt: 3, state: 'success', error: '' }
    ],
    'company-b': [
      { id: 'other', turnId: 'prior', authorType: 'human', author: 'operator', body: 'Other company secret', createdAt: 4, state: 'success', error: '' }
    ]
  })
  const prompt = api.teamPrompt(team, 'alice', 'Review the launch plan', 'current')
  assert.match(prompt, /Company A plan/)
  assert.match(prompt, /Alice contribution/)
  assert.doesNotMatch(prompt, /Company B secret|Other company secret/)
  assert.equal(JSON.stringify(api.teamTargets('@bob @carol', team.members)), JSON.stringify({ targets: ['bob'], unknown: ['carol'] }))
})

test('integration: Team fanout uses private profile sessions in lead-first order', async () => {
  const requests = []
  let runtime
  runtime = load({
    request: async (method, payload) => {
      requests.push({ method, payload })
      if (method === 'session.create') {
        return { session_id: `session-${payload.profile}`, stored_session_id: `stored-${payload.profile}` }
      }
      if (method === 'prompt.submit') {
        queueMicrotask(() => runtime.events.get('message.complete')({
          session_id: payload.session_id,
          payload: { status: 'complete', text: `reply-${payload.session_id}` }
        }))
      }
      return {}
    }
  })
  runtime.register()
  const team = { id: 'launch', name: 'Launch', lead: 'alice', members: ['alice', 'bob'] }
  runtime.api.teams.set([team])
  const settled = []
  await runtime.api.runTeamFanout(team, ['bob', 'alice'], 'Coordinate release', 'turn-1', 1, (profile, result) => {
    settled.push({ profile, state: result.state, body: result.body, error: result.error })
  })
  const prompts = requests.filter(request => request.method === 'prompt.submit').map(request => request.payload)
  assert.equal(JSON.stringify(settled), JSON.stringify([
    { profile: 'alice', state: 'success', body: 'reply-session-alice' },
    { profile: 'bob', state: 'success', body: 'reply-session-bob' }
  ]))
  assert.equal(JSON.stringify(prompts.map(prompt => prompt.session_id)), JSON.stringify(['session-alice', 'session-bob']))
  assert.match(prompts[0].text, /CURRENT_HUMAN_MESSAGE_JSON: "Coordinate release"/)
})

test('regression: existing single-agent routine prompts retain their direct profile handoff', () => {
  const { api } = load()
  const prompt = api.routinePrompt('ops', 'Backups', 'Verify the latest backup.')
  assert.match(prompt, /hermes -p ops chat -c "Routine: Backups"/)
  assert.match(prompt, /Verify the latest backup/)
})

test('system: plugin registration exposes the Team page without removing existing middleware', () => {
  const runtime = load()
  runtime.register()
  assert.equal(runtime.contributions.some(item => item.id === 'team-page' && item.data.path === '/bot-team'), true)
  assert.equal(runtime.contributions.some(item => item.id === 'mention-middleware'), true)
  assert.equal(runtime.contributions.some(item => item.id === 'routines'), true)
  assert.equal(runtime.disposers.length, 1)
})

test('regression: saved Teams hydrate from asynchronous plugin storage', async () => {
  const runtime = load()
  runtime.register({
    get: key => key === 'teams-v1'
      ? Promise.resolve({ version: 1, teams: [{ id: 'ops', name: 'Operations', lead: 'alice', members: ['alice', 'bob'] }] })
      : null,
    set: () => undefined
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(JSON.stringify(runtime.api.teams.get()), JSON.stringify([{ id: 'ops', name: 'Operations', lead: 'alice', members: ['alice', 'bob'] }]))
})

test('regression: late storage hydration never overwrites a local Team save', async () => {
  let resolveStoredTeams
  const runtime = load()
  runtime.register({
    get: key => key === 'teams-v1'
      ? new Promise(resolve => { resolveStoredTeams = resolve })
      : null,
    set: () => undefined
  })
  const current = [{ id: 'launch', name: 'Launch', lead: 'alice', members: ['alice', 'bob'] }]
  runtime.api.saveTeams(current)
  resolveStoredTeams({ version: 1, teams: [{ id: 'stale', name: 'Stale', lead: 'alice', members: ['alice', 'bob'] }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(JSON.stringify(runtime.api.teams.get()), JSON.stringify(current))
})

test('performance: bounded Team normalization and audience selection handle 10,000 inputs', () => {
  const { api } = load()
  const raw = Array.from({ length: 10000 }, (_value, index) => ({
    id: `team-${index}`,
    name: `Team ${index}`,
    lead: 'alice',
    members: ['alice', 'bob']
  }))
  const start = Date.now()
  const teams = api.normalizeTeams(raw, ['alice', 'bob'])
  for (let index = 0; index < 10000; index += 1) api.teamTargets('@alice', ['alice', 'bob'])
  assert.equal(teams.length, 50)
  assert.ok(Date.now() - start < 1000)
})