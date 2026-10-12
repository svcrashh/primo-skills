// node --test tests/images.test.mjs   (no network) generated images: a local server answers as the OpenAI API, usage
// tokens included, so nothing paid is ever called. What a call writes (the PNG, images.json, costs.jsonl), the cap that
// stops a call before the API, the key that is never shown, and the script called through the skill's symlink.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DEFAULT_MODEL, SIZES, costFromUsage, estimate, framing, generatedTag, sizeFor } from '../scripts/images.mjs'
import { noteCost, readCosts } from '../scripts/costs.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(HERE, '..')
const CLI = path.join(SKILL, 'scripts', 'images.mjs')
const KEY = 'sk-test-images-0123456789abcdef'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const TOKENS = { text: 310, out: 150, ref: 1550 }

let base, server, home, api
const calls = []
const outputs = []
const tmp = (name) => fs.mkdtempSync(path.join(base, `${name}-`))
const project = (name) => {
  const p = tmp(name)
  fs.mkdirSync(path.join(p, 'media'), { recursive: true })
  for (const f of ['brand-a.png', 'brand-b.jpg']) fs.writeFileSync(path.join(p, 'media', f), PNG)
  return p
}
const usageFor = (n, refs) => ({ input_tokens: TOKENS.text + refs * TOKENS.ref, input_tokens_details: { text_tokens: TOKENS.text, image_tokens: refs * TOKENS.ref }, output_tokens: TOKENS.out * n })
const manifest = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'images.json'), 'utf8'))

function run(args, { key = KEY, env = {}, cwd } = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args[0]?.endsWith?.('.mjs') ? args : [CLI, ...args], {
      cwd, env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home, OPENAI_API_BASE: api, ...(key ? { OPENAI_API_KEY: key } : {}), ...env },
    })
    let stdout = '', stderr = ''
    p.stdout.on('data', (d) => { stdout += d })
    p.stderr.on('data', (d) => { stderr += d })
    p.on('close', (status) => { outputs.push(stdout, stderr); resolve({ status, stdout, stderr }) })
  })
}

before(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'images-'))
  home = tmp('home')
  server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks)
    const call = { method: req.method, url: req.url, auth: req.headers.authorization, type: req.headers['content-type'] ?? '' }
    calls.push(call)
    const send = (status, j) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
    if (req.headers.authorization !== `Bearer ${KEY}`) {
      return send(401, { error: { message: `Incorrect API key provided: ${String(req.headers.authorization).slice(7)}.`, code: 'invalid_api_key' } })
    }
    if (req.method === 'GET' && req.url === '/v1/models') {
      return send(200, { data: ['gpt-4o', 'gpt-image-2', 'whisper-1', DEFAULT_MODEL, 'chatgpt-image-latest', 'gpt-image-2.5-flare'].map((id) => ({ id })) })
    }
    if (req.method === 'POST' && req.url === '/v1/images/generations') {
      Object.assign(call, { json: JSON.parse(body), refs: 0 })
    } else if (req.method === 'POST' && req.url === '/v1/images/edits') {
      const s = body.toString('latin1')
      const field = (k) => new RegExp(`name="${k}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`).exec(s)?.[1]?.replace(/\r\n/g, '\n')
      Object.assign(call, { json: { model: field('model'), prompt: field('prompt'), size: field('size'), quality: field('quality'), n: Number(field('n')) }, refs: s.split('name="image[]"').length - 1 })
    } else return send(404, { error: { message: 'no such route' } })
    if (/BLOCKME/.test(call.json.prompt)) return send(400, { error: { message: 'Your request was rejected by the safety system.', code: 'moderation_blocked' } })
    const n = call.json.n ?? 1
    send(200, { created: 1, data: Array.from({ length: n }, () => ({ b64_json: PNG.toString('base64') })), usage: usageFor(n, call.refs) })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  api = `http://127.0.0.1:${server.address().port}`
})
after(() => {
  server?.close()
  fs.rmSync(base, { recursive: true, force: true })
})

describe('the cost', () => {
  test('the estimate matches what the owner paid (1024x1536): low ~US$ 0.006, high ~0.043, high with 3 references ~0.08', () => {
    const near = (got, want, tol) => assert.ok(Math.abs(got - want) / want <= tol, `estimate ${got}, paid ${want}`)
    near(estimate({ size: '1024x1536', quality: 'low' }), 0.0061, 0.1)
    near(estimate({ size: '1024x1536', quality: 'high' }), 0.0426, 0.05)
    near(estimate({ size: '1024x1536', quality: 'high', refs: 3 }), 0.08, 0.1)
    assert.ok(estimate({ quality: 'low', n: 3 }) < estimate({ quality: 'high' }), 'three low options cost less than one high')
  })

  test('the real cost comes from the tokens: text in, reference images in, image out', () => {
    assert.equal(costFromUsage({ input_tokens: 1200, input_tokens_details: { text_tokens: 200, image_tokens: 1000 }, output_tokens: 1000 }), 0.039)
    assert.equal(costFromUsage({ input_tokens: 300, output_tokens: 1400 }), 0.0435)
    assert.equal(costFromUsage(null), null)
  })
})

describe('the size', () => {
  test('each video format gets a size of the same shape, a bit larger than the frame, so nothing is cut', () => {
    for (const [format, { size, frame }] of Object.entries(SIZES)) {
      const [w, h] = size.split('x').map(Number), [fw, fh] = frame.split('x').map(Number)
      assert.equal(w * fh, h * fw, `${format}: ${size} has the shape of ${frame}`)
      assert.ok(w >= fw && h >= fh && w % 16 === 0 && h % 16 === 0, `${format}: ${size}`)
      assert.match(framing(size, format), /nothing cut/)
      assert.equal(sizeFor({ format }), size)
    }
    assert.equal(sizeFor({}), '2048x1152')
    assert.equal(sizeFor({ format: '9x16', size: '1024x1536' }), '1024x1536')
    assert.match(framing('1024x1536', '16x9'), /only the middle 1024x576 shows, 960 px of height \(top and bottom\) cut, enlarged to 188%: it will look soft/)
    assert.throws(() => sizeFor({ format: '3x2' }), (e) => e.code === 2 && /16x9/.test(e.message))
    assert.throws(() => sizeFor({ size: 'big' }), (e) => e.code === 2)
  })
})

describe('generating', () => {
  test('three options: the PNGs, images.json and one line in costs.jsonl with the real cost', async () => {
    const p = project('options')
    const before = calls.length
    const r = await run(['generate', '--project', p, '--prompt', 'A sunlit wooden desk, empty, seen from the side', '--name', 'scene-02', '--n', '3'])
    assert.equal(r.status, 0, r.stderr)
    const call = calls.at(-1)
    assert.equal(calls.length, before + 1)
    assert.equal(call.url, '/v1/images/generations')
    assert.equal(call.auth, `Bearer ${KEY}`)
    assert.deepEqual(call.json, { model: DEFAULT_MODEL, prompt: 'A sunlit wooden desk, empty, seen from the side', size: '2048x1152', quality: 'low', n: 3 })

    const dir = path.join(p, 'media', 'generated')
    for (const f of ['scene-02-a.png', 'scene-02-b.png', 'scene-02-c.png']) assert.deepEqual(fs.readFileSync(path.join(dir, f)), PNG)
    const real = costFromUsage(usageFor(3, 0))
    const m = manifest(dir)
    assert.equal(m.images.length, 3)
    const { at, ...first } = m.images[0]
    assert.ok(!Number.isNaN(Date.parse(at)))
    assert.deepEqual(first, {
      file: 'scene-02-a.png', name: 'scene-02', prompt: 'A sunlit wooden desk, empty, seen from the side', model: DEFAULT_MODEL,
      quality: 'low', size: '2048x1152', format: '16x9', refs: [], usd: Math.round((real / 3) * 1e4) / 1e4, costFrom: 'tokens', generated: true,
    })

    const costs = readCosts(p)
    assert.equal(costs.length, 1)
    assert.deepEqual({ ...costs[0], at: null }, {
      at: null, kind: 'image', provider: 'openai', model: DEFAULT_MODEL, label: 'scene-02',
      files: ['media/generated/scene-02-a.png', 'media/generated/scene-02-b.png', 'media/generated/scene-02-c.png'], usd: real, count: 3,
    })
    assert.match(r.stdout, /^media\/generated\/scene-02-a\.png$/m)
    assert.match(r.stdout, /from the tokens/)
    assert.match(r.stdout, /2048x1152 has the shape of the 16x9 frame/)
    assert.match(r.stdout, /images in this video: US\$ 0\.015 of US\$ 0\.50/)
    assert.match(r.stdout, /final --project/)
  })

  test('with --ref it edits from the references (multipart), and images.json keeps them relative to the project', async () => {
    const p = project('refs')
    fs.writeFileSync(path.join(p, 'prompt.txt'), 'The same desk at night, under one warm lamp')
    const r = await run(['generate', '--project', p, '--prompt', `@${path.join(p, 'prompt.txt')}`, '--name', 'night', '--ref', 'media/brand-a.png', '--ref', 'media/brand-b.jpg', '--format', '9x16', '--quality', 'high'])
    assert.equal(r.status, 0, r.stderr)
    const call = calls.at(-1)
    assert.equal(call.url, '/v1/images/edits')
    assert.match(call.type, /^multipart\/form-data/)
    assert.equal(call.refs, 2)
    assert.deepEqual(call.json, { model: DEFAULT_MODEL, prompt: 'The same desk at night, under one warm lamp', size: '1152x2048', quality: 'high', n: 1 })
    const [e] = manifest(path.join(p, 'media', 'generated')).images
    assert.equal(e.file, 'night.png')
    assert.deepEqual(e.refs, ['media/brand-a.png', 'media/brand-b.jpg'])
    assert.equal(e.usd, costFromUsage(usageFor(1, 2)))
  })

  test('final redoes the chosen option in high with it as the reference, and says it goes back for approval', async () => {
    const p = project('final')
    assert.equal((await run(['generate', '--project', p, '--prompt', 'A plant by a window', '--name', 'scene-04', '--n', '2', '--format', '4x5'])).status, 0)
    const r = await run(['final', '--project', p, 'media/generated/scene-04-b.png', '--add', 'A little more light from the left.'])
    assert.equal(r.status, 0, r.stderr)
    const call = calls.at(-1)
    assert.equal(call.url, '/v1/images/edits')
    assert.equal(call.refs, 1)
    assert.equal(call.json.quality, 'high')
    assert.equal(call.json.size, '1152x1440')
    assert.match(call.json.prompt, /^A plant by a window\n\nA little more light from the left\.\n\nKeep the composition/)
    const e = manifest(path.join(p, 'media', 'generated')).images.find((x) => x.file === 'scene-04-final.png')
    assert.equal(e.from, 'scene-04-b.png')
    assert.equal(e.quality, 'high')
    assert.deepEqual(e.refs, ['media/generated/scene-04-b.png'])
    assert.match(r.stdout, /not the same one: show it on the board again and wait for the ok/)
    assert.equal(readCosts(p).length, 2)

    const notMine = await run(['final', '--project', p, 'media/brand-a.png'])
    assert.equal(notMine.status, 2)
    assert.match(notMine.stderr, /not in the images\.json/)
  })

  test('a batch makes every item into one images.json, one cost line per call', async () => {
    const p = project('batch')
    fs.writeFileSync(path.join(p, 'batch.json'), JSON.stringify({
      format: '1x1', common: 'Soft daylight, no text anywhere.', label: 'textures',
      items: [{ name: 'paper', prompt: 'Close-up of recycled paper' }, { name: 'linen', prompt: 'Close-up of linen', n: 2, quality: 'medium' }],
    }))
    const r = await run(['batch', '--project', p, path.join(p, 'batch.json')])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /2 made · US\$ 0\.0\d+ · media\/generated\/images\.json/)
    assert.deepEqual(manifest(path.join(p, 'media', 'generated')).images.map((e) => e.file).sort(), ['linen-a.png', 'linen-b.png', 'paper.png'])
    const costs = readCosts(p)
    assert.equal(costs.length, 2)
    assert.deepEqual(costs.map((c) => c.label).sort(), ['textures · linen', 'textures · paper'])
    assert.ok(calls.filter((c) => c.json?.prompt?.endsWith('\n\nSoft daylight, no text anywhere.')).length >= 2)
  })

  test('a refusal by the safety filter says to rewrite the prompt and notes no cost', async () => {
    const p = project('refused')
    const r = await run(['generate', '--project', p, '--prompt', 'BLOCKME please'])
    assert.equal(r.status, 1)
    assert.match(r.stderr, /safety filter .* Rewrite the prompt/)
    assert.deepEqual(readCosts(p), [])
  })

  test('without --project nothing is called: the cost has nowhere to go (code 2)', async () => {
    const before = calls.length
    const r = await run(['generate', '--prompt', 'A desk'])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /--project/)
    assert.equal(calls.length, before)
  })
})

describe('the cap', () => {
  test('a call that would pass the video cap stops BEFORE the API: code 5, the costs.mjs message, no request', async () => {
    const p = project('capped')
    noteCost(p, { kind: 'image', provider: 'openai', usd: 0.47 })
    const before = calls.length
    const r = await run(['generate', '--project', p, '--prompt', 'A desk', '--quality', 'high'])
    assert.equal(r.status, 5)
    assert.match(r.stderr, /this video's image cap is US\$ 0\.50: US\$ 0\.47 already spent .*--image-usd/)
    assert.equal(calls.length, before, 'the fake API got no request')
    assert.equal(fs.existsSync(path.join(p, 'media', 'generated')), false)
    assert.equal(readCosts(p).length, 1)
  })

  test('a batch is checked whole before the first call', async () => {
    const p = project('capped-batch')
    noteCost(p, { kind: 'image', provider: 'openai', usd: 0.4 })
    fs.writeFileSync(path.join(p, 'batch.json'), JSON.stringify({ quality: 'high', items: [{ name: 'a', prompt: 'x' }, { name: 'b', prompt: 'y' }] }))
    const before = calls.length
    const r = await run(['batch', '--project', p, path.join(p, 'batch.json')])
    assert.equal(r.status, 5)
    assert.equal(calls.length, before)
    const e = await run(['estimate', '--project', p, path.join(p, 'batch.json')])
    assert.equal(e.status, 0)
    assert.match(e.stdout, /~US\$ 0\.1\d+ · 2 images in 2 calls\nover this video's cap/)
  })
})

describe('the key', () => {
  test('without a key: what to do, code 3, and no request (the video goes on without generated images)', async () => {
    const p = project('no-key')
    const before = calls.length
    for (const args of [['generate', '--project', p, '--prompt', 'A desk'], ['models']]) {
      const r = await run(args, { key: null })
      assert.equal(r.status, 3, args[0])
      assert.match(r.stderr, /no OpenAI key: set OPENAI_API_KEY, or put the line OPENAI_API_KEY=… in ~\/\.claude\/secrets\/openai\.env/)
      assert.match(r.stderr, /without generated images/)
    }
    assert.equal(calls.length, before)
    assert.deepEqual(readCosts(p), [])
  })

  test('the key can come from ~/.claude/secrets/openai.env', async () => {
    const h = tmp('home-with-key')
    fs.mkdirSync(path.join(h, '.claude', 'secrets'), { recursive: true })
    fs.writeFileSync(path.join(h, '.claude', 'secrets', 'openai.env'), `# OpenAI\nOPENAI_API_KEY="${KEY}"\n`)
    const r = await run(['models'], { key: null, env: { HOME: h, USERPROFILE: h } })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(calls.at(-1).auth, `Bearer ${KEY}`)
  })

  test('a refused key is code 3 too, and the message does not repeat it', async () => {
    const wrong = 'sk-wrong-key-9876543210'
    const r = await run(['models'], { key: wrong })
    assert.equal(r.status, 3)
    assert.match(r.stderr, /OpenAI refused the key \(401/)
    assert.ok(!r.stderr.includes(wrong) && !r.stderr.includes('9876543210'), r.stderr)
  })

  test('the key never shows in stdout, stderr or a written file', () => {
    assert.ok(outputs.length > 10, 'the other tests ran first')
    for (const o of outputs) assert.ok(!o.includes(KEY), o)
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.isFile() ? [path.join(dir, d.name)] : []))
    const written = walk(base).filter((f) => !f.includes(`${path.sep}.claude${path.sep}secrets${path.sep}`))
    assert.ok(written.some((f) => f.endsWith('images.json')) && written.some((f) => f.endsWith('costs.jsonl')))
    for (const f of written) assert.ok(!fs.readFileSync(f).includes(KEY), f)
  })
})

describe('the account and the board', () => {
  test('models lists only the image models, the default marked (a free call)', async () => {
    const r = await run(['models'])
    assert.equal(r.status, 0, r.stderr)
    assert.equal(r.stdout, `chatgpt-image-latest\ngpt-image-2\ngpt-image-2.5-flare\n${DEFAULT_MODEL} (default)\n`)
    assert.equal(calls.at(-1).method, 'GET')
  })

  test('board prints the `generated` of each image, by its path in the project', async () => {
    const p = project('board')
    assert.equal((await run(['generate', '--project', p, '--prompt', 'A shelf', '--name', 'shelf', '--n', '2'])).status, 0)
    const r = await run(['board', '--project', p])
    assert.equal(r.status, 0, r.stderr)
    const tags = JSON.parse(r.stdout)
    const each = Math.round((costFromUsage(usageFor(2, 0)) / 2) * 1e4) / 1e4
    assert.deepEqual(tags, { 'media/generated/shelf-a.png': { model: DEFAULT_MODEL, usd: each }, 'media/generated/shelf-b.png': { model: DEFAULT_MODEL, usd: each } })
    assert.deepEqual(generatedTag(path.join(p, 'media', 'generated', 'shelf-b.png')), { model: DEFAULT_MODEL, usd: each })
    assert.equal(generatedTag(path.join(p, 'media', 'brand-a.png')), null)
  })
})

describe('through the symlink', () => {
  test('called by the path of a symlinked skill, the script answers', async () => {
    const link = path.join(tmp('link'), 'skills', 'primo-videos')
    fs.mkdirSync(path.dirname(link), { recursive: true })
    fs.symlinkSync(SKILL, link, 'dir')
    const help = await run([path.join(link, 'scripts', 'images.mjs')])
    assert.equal(help.status, 2)
    assert.match(help.stderr, /usage:\n {2}node images\.mjs generate/)
    const est = await run([path.join(link, 'scripts', 'images.mjs'), 'estimate', '--quality', 'high', '--format', '9x16'])
    assert.equal(est.status, 0, est.stderr)
    assert.match(est.stdout, /^~US\$ 0\.0\d+ · 1 image · 1152x2048 high$/m)
  })
})
