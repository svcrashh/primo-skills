#!/usr/bin/env node
// Busca um ícone Lucide por palavra (os 1.854 do molde, ISC): node icons.mjs <palavra> [quantos]
// Procura no nome e nas tags do Lucide (em inglês); as palavras em português mais comuns de explicação são traduzidas
// antes ("dinheiro" → money, "servidor" → server). Imprime o nome para usar em s.icon('<name>') ou { icon: '<name>' }.
// A busca é a do explainroo (iconSuggest em engine/stage.js e "explainroo icons", MIT, © 2026 Vincent Schmalbach).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
export const PT = {
  dinheiro: 'money', pagamento: 'credit card', pagar: 'credit card', cartao: 'credit card', carteira: 'wallet', banco: 'landmark',
  usuario: 'user', pessoa: 'user', pessoas: 'users', cliente: 'user', equipe: 'users', nuvem: 'cloud', servidor: 'server',
  dados: 'database', 'banco de dados': 'database', cadeado: 'lock', seguranca: 'shield', seguro: 'shield', grafico: 'chart',
  phone: 'smartphone', telefone: 'phone', computer: 'monitor', email: 'mail', mensagem: 'message', conversa: 'message',
  carrinho: 'shopping cart', loja: 'store', compra: 'shopping', relogio: 'clock', tempo: 'clock', calendario: 'calendar',
  casa: 'house', configuracao: 'settings', ajuste: 'settings', busca: 'search', procurar: 'search', pasta: 'folder',
  arquivo: 'file', documento: 'file', foto: 'image', imagem: 'image', video: 'video', musica: 'music', link: 'link',
  estrela: 'star', coracao: 'heart', alerta: 'alert', aviso: 'alert', erro: 'x', certo: 'check', ok: 'check',
  raio: 'zap', rapido: 'zap', ia: 'sparkles', magia: 'sparkles', robo: 'bot', codigo: 'code', terminal: 'terminal',
  api: 'webhook', rede: 'network', internet: 'globe', mundo: 'globe', mapa: 'map', lugar: 'map pin', entrega: 'truck',
  caminhao: 'truck', pacote: 'package', caixa: 'package', presente: 'gift', ideia: 'lightbulb', lampada: 'lightbulb',
  meta: 'target', alvo: 'target', crescer: 'trending up', subir: 'trending up', cair: 'trending down', lista: 'list',
  tarefa: 'list checks', chave: 'key', senha: 'key', notificacao: 'bell', sino: 'bell', camera: 'camera', microfone: 'mic',
  fone: 'headphones', livro: 'book', escola: 'school', aula: 'graduation', saude: 'heart pulse', hospital: 'hospital',
  carro: 'car', aviao: 'plane', comida: 'utensils', cafe: 'coffee', limpar: 'eraser', apagar: 'eraser', copiar: 'copy',
  colar: 'clipboard', enviar: 'send', baixar: 'download', subir_arquivo: 'upload', compartilhar: 'share', filtro: 'filter',
}

const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim()

export function carregar() {
  const ic = JSON.parse(fs.readFileSync(path.join(AQUI, 'scene', 'vendor', 'lucide.json'), 'utf8'))
  const tags = JSON.parse(fs.readFileSync(path.join(AQUI, 'scene', 'vendor', 'lucide-tags.json'), 'utf8'))
  return { nomes: Object.keys(ic.icons), aliases: ic.aliases || {}, tags, versao: ic.version }
}

export function buscar(palavra, { nomes, aliases, tags }, n = 12) {
  const q = norm(palavra)
  const termo = PT[q] || PT[q.replace(/\s+/g, '_')] || q
  const partes = termo.split(/[-_\s]+/).filter(Boolean)
  const pontua = (nome) => {
    const np = nome.split('-')
    let sc = 0
    if (nome === termo.replace(/\s+/g, '-')) sc += 10
    for (const p of partes) {
      if (np.includes(p)) sc += 3
      else if (nome.includes(p)) sc += 1
      const ts = tags[nome] || []
      if (ts.some((t) => t === p || t === termo)) sc += 2
      else if (ts.some((t) => t.includes(p))) sc += 0.5
    }
    return sc - np.length * 0.1
  }
  const achados = nomes.map((nome) => ({ nome, sc: pontua(nome) })).filter((x) => x.sc > 0.4).sort((a, b) => b.sc - a.sc).slice(0, n)
  if (aliases[q] && !achados.some((a) => a.nome === aliases[q])) achados.unshift({ nome: aliases[q], sc: 99 })
  return { termo, achados: achados.map((a) => ({ nome: a.nome, tags: (tags[a.nome] || []).slice(0, 6) })) }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const [palavra, quantos] = process.argv.slice(2)
  if (!palavra) { console.error('usage: node icons.mjs <word> [how many]   (e.g. node icons.mjs money)'); process.exit(1) }
  const lib = carregar()
  const r = buscar(palavra, lib, Number(quantos) || 12)
  if (r.termo !== norm(palavra)) console.log(`"${palavra}" → "${r.termo}" (Lucide tags are in English)`)
  if (!r.achados.length) { console.log(`no icon for "${palavra}" among the ${lib.nomes.length} in Lucide ${lib.versao}; try in English`); process.exit(1) }
  for (const a of r.achados) console.log(`${a.nome.padEnd(28)} ${a.tags.join(', ')}`)
}
