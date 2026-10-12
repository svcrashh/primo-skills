// node --test tests/   (sem rede): o vídeo em capítulos nos horizontais largos (19:9 = 2280×1080, 21:9 = 2520×1080).
// O kit estica a composição do 16:9 na largura (texto à esquerda, palco à direita, tudo dentro dos 5%) sem mexer no 16:9
// nem no 9:16; o new.mjs recusa formato que não existe antes de criar a pasta; o assemble.mjs junta os largos sozinho.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KIT = fs.readFileSync(path.join(RAIZ, 'assets', 'chapters', 'template', 'kit.js'), 'utf8')
const TAM = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920] }

// o kit.js roda depois do engine.js: aqui, só o que ele usa no topo (W, H, HORIZONTAL, VERTICAL e o L do motor)
function kitEm(fmt) {
  const [W, H] = TAM[fmt]
  const HORIZONTAL = W > H, VERTICAL = H > W
  const L = (o) => (o[fmt] !== undefined ? o[fmt] : HORIZONTAL && o['16x9'] !== undefined ? o['16x9'] : VERTICAL && o['9x16'] !== undefined ? o['9x16'] : o.padrao !== undefined ? o.padrao : Object.values(o)[0])
  const ctx = vm.createContext({ W, H, HORIZONTAL, VERTICAL, L })
  return { W, H, ...JSON.parse(vm.runInContext(`${KIT}\n;JSON.stringify({ LAY, PALCO, KX })`, ctx)) }
}

test('16:9 e 9:16 seguem com os números de sempre', () => {
  const h = kitEm('16x9')
  assert.equal(h.KX, 1)
  assert.deepEqual({ tx: h.LAY.tx, txW: h.LAY.txW, palco: h.LAY.palco }, { tx: 140, txW: 750, palco: { x: 900, y: 90, w: 900, h: 900 } })
  const v = kitEm('9x16')
  assert.deepEqual({ tx: v.LAY.tx, txW: v.LAY.txW, palco: v.LAY.palco }, { tx: 90, txW: 840, palco: { x: 90, y: 760, w: 840, h: 690 } })
})

for (const fmt of ['19x9', '21x9']) {
  test(`${fmt}: a composição do 16:9 esticada na largura, texto e palco dentro dos 5% e sem se encostar`, () => {
    const { W, H, LAY, PALCO, KX } = kitEm(fmt)
    assert.equal(KX, W / 1920)
    const m = { x0: W * 0.05, x1: W * 0.95, y0: H * 0.05, y1: H * 0.95 }
    assert.ok(LAY.tx >= m.x0, `texto em x ${LAY.tx} < ${m.x0}`)
    assert.ok(LAY.tx + LAY.txW <= PALCO.x, 'a coluna de texto acaba antes do palco')
    assert.ok(PALCO.x + PALCO.w <= m.x1 && PALCO.y >= m.y0 && PALCO.y + PALCO.h <= m.y1, 'o palco fica dentro da área segura')
    assert.ok(Math.abs((W - (PALCO.x + PALCO.w)) / W - 120 / 1920) < 1e-9, 'a sobra à direita é a mesma fração do 16:9')
    assert.equal(LAY.tituloPx, 128, 'o corpo do texto depende da altura, que é a do 16:9')
  })
}

test('new.mjs recusa formato que não existe, com a lista dos que existem, e não cria nada', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-cap-'))
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'chapters', 'new.mjs'), path.join(tmp, 'v'), '--formats', '16x9,21:9'], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /unknown format: 21:9\. Use 16x9, 19x9, 21x9/)
  assert.ok(!fs.existsSync(path.join(tmp, 'v')))
})

test('assemble.mjs junta sozinho as cenas renderizadas em 21:9', (t) => {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) return t.skip('sem ffmpeg')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-cap-'))
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  fs.mkdirSync(path.join(tmp, 'audio'))
  for (const c of ['00-opening', '02-cores']) {
    const out = path.join(tmp, 'scenes', c, 'out')
    fs.mkdirSync(out, { recursive: true })
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x0D0F14:s=252x108:r=30:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, '21x9.mp4')])
    assert.equal(r.status, 0)
  }
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'chapters', 'assemble.mjs'), tmp], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /out\/assembled-21x9\.mp4 · 2 scenes/)
  assert.ok(fs.existsSync(path.join(tmp, 'out', 'assembled-21x9.mp4')))
  assert.ok(!fs.existsSync(path.join(tmp, 'out', 'assembled-16x9.mp4')))
})
