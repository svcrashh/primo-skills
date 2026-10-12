// drawn-explainer · a narração (o render.mjs carrega este arquivo se ele existe).
// Corta o trecho de cada cena falada, mede o primeiro som dele (inicioVoz do voice.mjs, Contrato L) e, na hora do som,
// escreve a voz no tempo do vídeo (audio/voz.wav), o bloco "voz" da folha da trilha (o mix_voz.py cede a trilha) e a
// legenda (captions.srt), pelo scripts/tutorial/locucao.mjs. Os trechos cortados viram também uma locução no Contrato L
// (<obra>/voice/obra/narration.json, uma fala por cena), que o refine.mjs da obra mede (alinhamento, voz apagada, silêncio).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { lerWav, inicioVoz, validarLocucao } from '../../../scripts/voice.mjs'
import { escreverVozWav, blocoFolha, srt } from '../../../scripts/tutorial/locucao.mjs'

export const LEGENDA = 'captions.srt'

/** Os trechos das cenas faladas em <obra>/voice/<cena>.wav, o primeiro som medido de cada um e a locução da obra. */
export function cortarTrechos({ roteiro, locucao, dirLoc, obra, trechoDaFala }) {
  const inicios = {}, wavs = {}, falas = []
  fs.rmSync(path.join(obra, 'voice'), { recursive: true, force: true })
  fs.mkdirSync(path.join(obra, 'voice', 'obra'), { recursive: true })
  for (const cena of roteiro.filter((c) => c.fala)) {
    const tr = trechoDaFala(locucao, cena)
    const wav = path.join(obra, 'voice', `${cena.id}.wav`)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.resolve(dirLoc, tr.fala.arquivo), '-ss', String(tr.de), '-to', String(tr.ate), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le',
      '-af', 'afade=t=in:d=0.008,areverse,afade=t=in:d=0.03,areverse', wav])
    const w = lerWav(wav)
    const iv = inicioVoz(w.amostras, w.taxa)
    if (iv === null) throw new Error(`scene "${cena.id}": the excerpt of line ${cena.fala} (${tr.de}–${tr.ate} s) came out silent`)
    inicios[cena.id] = iv
    wavs[cena.id] = wav
    const r3 = (x) => Math.round(x * 1000) / 1000
    const palavras = tr.palavras.map((p) => ({ texto: p.text, ini: r3(Math.min(p.start, w.n / w.taxa)), fim: r3(Math.min(p.end, w.n / w.taxa)) }))
    if (palavras[0].ini < iv) palavras[0].ini = r3(Math.min(iv, palavras[0].fim))
    falas.push({ id: cena.id, onde: { capitulo: falas.length + 1 }, texto: palavras.map((p) => p.texto).join(' '), arquivo: `../${cena.id}.wav`, duracao: r3(w.n / w.taxa), inicio_voz: r3(iv), palavras })
  }
  const loc = { versao: 1, idioma: locucao.idioma || 'en-US', voz: locucao.voz || null, origem: 'script excerpts cut by the drawn-explainer render.mjs', falas }
  const arq = path.join(obra, 'voice', 'obra', 'narration.json')
  fs.writeFileSync(arq, JSON.stringify(loc, null, 1) + '\n')
  const erros = validarLocucao(loc, path.dirname(arq))
  if (erros.length) console.error(`WARNING: the build's narration does not pass Contract L (the build's refine does not measure the voice):\n  ${erros.slice(0, 5).join('\n  ')}`)
  return { inicios, wavs }
}

/** A voz no tempo do vídeo, o bloco da folha (perfil do mix) e a legenda. Devolve o bloco "voz" da folha. */
export function escreverNarracao({ falas, duracao, dirAudio, obra, perfil }) {
  escreverVozWav(falas, duracao, path.join(dirAudio, 'voz.wav'))
  fs.writeFileSync(path.join(obra, LEGENDA), srt(falas))
  return blocoFolha(falas, perfil || 'calmo')
}
