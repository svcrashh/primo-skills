// node --test tests/   (sem rede): o progresso em % — as duas réguas, a linha do chat, a meta, o cronômetro e a linha de comando.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { novoEstado, marcar, porcento, linha, etapaDoApp, relatorio, textoRelatorio, REGUAS, META_MIN } from '../scripts/progress.mjs'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'progress.mjs')
const T0 = Date.parse('2026-10-06T12:00:00Z')
const min = (n) => T0 + n * 60000
const seg = (m, s = 0) => T0 + (m * 60 + s) * 1000

test('as réguas somam 100, o kit tem meta de 10 min e o produto novo de 25, e a prévia cresce pelo peso', () => {
  for (const lista of Object.values(REGUAS)) assert.equal(lista.reduce((a, e) => a + e.peso, 0), 100)
  assert.deepEqual(META_MIN, { kit: 10, novo: 25 })
  const novo = novoEstado({ agora: T0 })
  assert.equal(novo.meta_min, 25)
  assert.equal(novo.etapas.previa[0].nome, 'reading and thesis')
  assert.equal(novo.etapas.previa.reduce((a, x) => a + x.min, 0), 23)
  assert.ok(!novo.etapas.previa.some((x) => x.id === 'refine'), 'o refino não é da prévia')
  assert.equal(novo.etapas.final[0].id, 'refine')

  const e = novoEstado({ kit: true, agora: T0 })
  assert.equal(e.meta_min, 10)
  assert.equal(e.etapas.previa[0].nome, 'kit and request')
  assert.equal(e.etapas.previa.reduce((a, x) => a + x.min, 0), 9)
  assert.equal(linha(e, T0), 'Preview: 0% — next: kit and request · ~9 min left, 0 of 10 min')
  marcar(e, 'done', 'reading', { agora: min(1) })
  marcar(e, 'done', 'script', { agora: min(3) })
  marcar(e, 'done', 'voice', { nota: 'voz gerada', agora: min(3.5) })
  assert.equal(porcento(e), 40)
  marcar(e, 'now', 'recording', { agora: min(3.5) })
  assert.equal(linha(e, min(4)), 'Preview: 40% — voz gerada; now: recording (~2 min) · ~5 min left, 4 of 10 min')
  assert.equal(etapaDoApp(e), 'cenas')
  assert.deepEqual(e.log.map((x) => [x.cmd, x.etapa]), [['start', undefined], ['done', 'reading'], ['done', 'script'], ['done', 'voice'], ['now', 'recording']])
  assert.equal(e.log[3].nota, 'voz gerada')
  assert.equal(e.log[4].quando, new Date(min(3.5)).toISOString())
})

test('duas etapas em agora ao mesmo tempo: uma não devolve a outra e a linha mostra as duas', () => {
  const e = novoEstado({ kit: true, agora: T0 })
  marcar(e, 'done', 'reading', { agora: min(1) })
  marcar(e, 'done', 'script', { agora: min(3) })
  marcar(e, 'now', 'voice', { falta: 1, agora: min(3) })
  marcar(e, 'now', 'recording', { agora: min(3) })
  assert.deepEqual(e.etapas.previa.filter((x) => x.estado === 'agora').map((x) => x.id), ['voice', 'recording'])
  assert.equal(linha(e, min(3.5)), 'Preview: 25% — script done; now: voice (~1 min) + recording (~2 min) · ~5 min left, 4 of 10 min')
  marcar(e, 'now', 'recording', { falta: 4, agora: min(5) })
  assert.equal(e.etapas.previa.find((x) => x.id === 'recording').inicio, new Date(min(3)).toISOString(), 'o agora repetido não zera o início')
  assert.match(linha(e, min(6)), /now: voice \(~1 min\) \+ recording \(~3 min\)/)
})

test('sem narração, a voz não conta: o resto é 100%, e a prévia fecha sem ela', () => {
  const e = novoEstado({ narracao: false, kit: true, agora: T0 })
  assert.equal(e.etapas.previa.find((x) => x.id === 'voice').estado, 'pulada')
  for (const id of ['reading', 'script', 'recording', 'soundtrack']) marcar(e, 'done', id, { agora: min(5) })
  assert.equal(porcento(e), Math.round((100 * 60) / 85))
  marcar(e, 'done', 'draft', { nota: 'draft pronto', agora: min(8) })
  assert.ok(e.previa_em, 'a prévia fecha sem a etapa da voz')
})

test('a prévia fecha com a montagem sem o refino; a linha manda mostrar, e o refino abre a régua do final', () => {
  const e = novoEstado({ kit: true, sem: ['recording'], agora: T0 })
  for (const id of ['reading', 'script', 'voice', 'soundtrack']) marcar(e, 'done', id, { agora: min(5) })
  assert.equal(e.previa_em, null)
  marcar(e, 'done', 'draft', { nota: 'draft pronto', agora: min(8) })
  assert.equal(e.previa_em, new Date(min(8)).toISOString())
  assert.equal(e.etapas.final.find((x) => x.id === 'refine').estado, 'pendente')
  assert.equal(porcento(e, 'previa'), 100)
  assert.equal(e.regua, 'previa')
  assert.equal(linha(e, min(8)), 'Preview: 100% — draft pronto; now: show the preview to the owner (the refine runs alongside)')
  assert.equal(etapaDoApp(e), 'montagem')
  marcar(e, 'now', 'refine', { agora: min(8) })
  assert.equal(e.regua, 'final')
  assert.equal(linha(e, min(9)), 'Final: 0% — now: preview refine (~3 min) · ~29 min left')
  assert.equal(etapaDoApp(e), 'refino')
  marcar(e, 'done', 'refine', { nota: 'refino passou', agora: min(10) })
  marcar(e, 'done', 'adjustments', { nota: 'ajustes do dono', agora: min(15) })
  marcar(e, 'now', 'render', { agora: min(15) })
  assert.equal(linha(e, min(19)), 'Final: 25% — ajustes do dono; now: final render (~6 min) · ~14 min left')
  for (const id of ['render', 'critic', 'delivery']) marcar(e, 'done', id, { nota: id === 'delivery' ? 'entregue na pasta' : null, agora: min(30) })
  assert.equal(linha(e, min(30)), 'Final: 100% — entregue na pasta')
  assert.equal(etapaDoApp(e), 'pronto')
})

test('o refino que começa antes de a prévia fechar não tira a prévia da linha', () => {
  const e = novoEstado({ kit: true, agora: T0 })
  for (const id of ['reading', 'script', 'voice', 'recording', 'soundtrack']) marcar(e, 'done', id, { agora: min(5) })
  marcar(e, 'now', 'refine', { agora: min(7) })
  assert.equal(e.regua, 'previa')
  marcar(e, 'done', 'draft', { agora: min(8) })
  assert.equal(linha(e, min(8)), 'Preview: 100% — draft done; now: show the preview to the owner (the refine runs alongside)')
})

test('a meta: avisa quando o ritmo estoura e manda cortar o escopo quando já passou', () => {
  const e = novoEstado({ meta: 30, agora: T0 })
  marcar(e, 'now', 'reading', { falta: 20, agora: T0 })
  assert.match(linha(e, min(1)), /at the current pace the preview goes past the 30 min target; cut what doesn't change the preview$/)
  assert.match(linha(e, min(31)), /WARNING: past the 30 min target; tell the owner now and cut the preview's scope/)
  const k = novoEstado({ kit: true, agora: T0 })
  assert.doesNotMatch(linha(k, min(1)), /WARNING/)
  assert.match(linha(k, min(11)), /11 of 10 min\. WARNING: past the 10 min target/)
  assert.throws(() => marcar(e, 'done', 'cafe'), /stage "cafe" does not exist; the stages are: reading, script/)
})

test('o relatório: quanto durou cada etapa, o tempo entre elas, o início estimado e o ✓ contra a meta de 10 min do --kit', () => {
  const e = novoEstado({ kit: true, agora: T0 })
  marcar(e, 'now', 'reading', { agora: seg(0, 10) }); marcar(e, 'done', 'reading', { agora: seg(1) })
  marcar(e, 'now', 'script', { agora: seg(1, 30) }); marcar(e, 'done', 'script', { agora: seg(3, 30) })
  marcar(e, 'now', 'voice', { agora: seg(3, 40) }); marcar(e, 'now', 'recording', { agora: seg(3, 40) })
  marcar(e, 'done', 'voice', { agora: seg(4, 20) }); marcar(e, 'done', 'recording', { agora: seg(6, 45) })
  marcar(e, 'done', 'soundtrack', { agora: seg(6, 50) })   // sem agora: começou quando a gravação terminou
  marcar(e, 'now', 'draft', { agora: seg(7) })

  let r = relatorio(e, seg(8))
  assert.equal(r.previa.saiu, false)
  assert.equal(r.previa.total_s, 480)
  assert.deepEqual(r.previa.etapas.find((x) => x.id === 'draft'), { id: 'draft', nome: 'draft', estado: 'agora', tipico_min: 3, comecou_s: 420, durou_s: 60, pct: 13, estimado: false, em_andamento: true })
  assert.match(textoRelatorio(r), /The preview is not out yet: 8:00 so far — target 10 min \(2:00 to spare\)/)
  assert.equal(r.final.comecou, false)

  marcar(e, 'done', 'draft', { nota: 'draft pronto', agora: seg(8, 40) })
  marcar(e, 'now', 'refine', { agora: seg(8, 40) })
  r = relatorio(e, seg(9, 30))
  assert.deepEqual(r.previa.etapas.map((x) => [x.id, x.comecou_s, x.durou_s, x.pct, x.estimado]), [
    ['reading', 10, 50, 10, false],
    ['script', 90, 120, 23, false],
    ['voice', 220, 40, 8, false],
    ['recording', 220, 185, 36, false],
    ['soundtrack', 405, 5, 1, true],
    ['draft', 420, 100, 19, false],
  ])
  assert.deepEqual(r.previa.entre_etapas, { durou_s: 60, pct: 12 })
  assert.equal(r.previa.total_s, 520)
  assert.equal(r.previa.dentro_da_meta, true)
  assert.equal(r.previa.folga_s, 80)
  assert.deepEqual(r.previa.onde.map((x) => x.id), ['recording', 'script'])
  assert.equal(r.final.comecou, true)
  assert.deepEqual(r.final.etapas.slice(0, 2).map((x) => [x.id, x.comecou_s, x.durou_s, x.em_andamento]), [['refine', 520, 50, true], ['adjustments', null, null, false]])
  const txt = textoRelatorio(r)
  assert.match(txt, /^Stopwatch \(product with a kit\) — preview target 10 min\nUp to the preview:\n/)
  assert.match(txt, /\n {2}series and soundtrack +started {2}6:45 {2}took {2}0:05 {4}1% {2}typical ~0 min {2}\(estimated\)\n/)
  assert.match(txt, /\n {2}between stages +took {2}1:00 +12%/)
  assert.match(txt, /\nPreview out in 8:40 — target 10 min: ✓ \(1:20 to spare\)\n/)
  assert.match(txt, /\nWhere the time went: recording 3:05 \(36%\), script 2:00 \(23%\)\n/)
  assert.match(txt, /\nFrom the preview to the final:\n {2}preview refine +started {2}8:40 {2}took {2}0:50 {2}typical ~4 min {2}\(in progress\)\n {2}requested adjustments +not started yet/)
})

test('o relatório: ✗ quando a prévia passa da meta, e o início estimado volta ao início do vídeo', () => {
  const e = novoEstado({ kit: true, sem: ['voice'], agora: T0 })
  for (const [id, m, s] of [['reading', 1, 0], ['script', 4, 0], ['recording', 9, 0], ['soundtrack', 9, 30], ['draft', 13, 10]]) marcar(e, 'done', id, { agora: seg(m, s) })
  const r = relatorio(e, seg(20))
  const leitura = r.previa.etapas[0]
  assert.deepEqual([leitura.comecou_s, leitura.durou_s, leitura.estimado], [0, 60, true])
  assert.equal(r.previa.etapas.find((x) => x.id === 'voice').estado, 'pulada')
  assert.deepEqual([r.previa.total_s, r.previa.dentro_da_meta, r.previa.passou_s], [790, false, 190])
  assert.deepEqual(r.previa.entre_etapas, { durou_s: 0, pct: 0 })
  const txt = textoRelatorio(r)
  assert.match(txt, /\nPreview out in 13:10 — target 10 min: ✗ \(over by 3:10\)\n/)
  assert.match(txt, /\n {2}voice +skipped\n/)
  assert.match(txt, /Where the time went: recording 5:00 \(38%\), draft 3:40 \(28%\)/)
})

test('a linha de comando guarda o estado e o log em progress.json, imprime a linha e grava o stopwatch.md', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'progresso-'))
  const kit = fs.mkdtempSync(path.join(os.tmpdir(), 'progresso-kit-'))
  const roda = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8' })
  try {
    let r = roda('start', pasta, '--target', '40')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^Preview: 0% — next: reading and thesis · ~\d+ min left, 0 of 40 min/)
    r = roda('done', pasta, 'reading', '--note', 'tese escrita')
    assert.match(r.stdout, /^Preview: 1[02]% — tese escrita; next: script/)
    r = roda('now', pasta, 'script', '--remaining', '7')
    assert.match(r.stdout, /now: script \(~7 min\)/)
    r = roda('now', pasta, 'voice')
    assert.match(r.stdout, /now: script \(~7 min\) \+ voice \(~1 min\)/)
    const estado = JSON.parse(fs.readFileSync(path.join(pasta, 'progress.json'), 'utf8'))
    assert.equal(estado.etapas.previa[1].estado, 'agora')
    assert.deepEqual(estado.log.map((x) => x.cmd), ['start', 'done', 'now', 'now'])
    assert.equal(estado.etapas.previa[0].inicio_estimado, true)
    r = roda('start', pasta)
    assert.match(r.stdout, /already existed/)
    r = roda('done', pasta, 'nada')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /stage "nada" does not exist/)

    r = roda('report', pasta)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^Stopwatch \(new product\) — preview target 40 min\n/)
    assert.match(r.stdout, /The preview is not out yet/)
    const md = fs.readFileSync(path.join(pasta, 'stopwatch.md'), 'utf8')
    assert.ok(md.includes(r.stdout.trim()), 'o stopwatch.md tem o mesmo texto')
    r = roda('report', pasta, '--json')
    const rel = JSON.parse(r.stdout)
    assert.equal(rel.previa.saiu, false)
    assert.equal(rel.previa.etapas[0].estimado, true)
    assert.equal(JSON.parse(fs.readFileSync(path.join(pasta, 'progress.json'), 'utf8')).log.at(-1).cmd, 'report')

    r = roda('start', kit, '--kit')
    assert.equal(r.stdout.trim(), 'Preview: 0% — next: kit and request · ~9 min left, 0 of 10 min')
    r = roda('start', kit, '--kit', '--new', '--restart')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /use --kit .* or --new .*, not both/)
    assert.match(roda('stages').stdout, /Up to the preview[\s\S]*draft\s+25%[\s\S]*From the preview to the final[\s\S]*refine\s+10%[\s\S]*render\s+45%/)
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true })
    fs.rmSync(kit, { recursive: true, force: true })
  }
})
