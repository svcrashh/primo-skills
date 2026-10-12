// Modelo de video.mjs para a série de exemplo de tutorial de ferramenta web no computador (references/tutorial.md,
// "Recipe: tutorial of a web tool on the computer"). Copie para <project>/01-<tarefa>/video.mjs, troque cada TROQUE e
// escreva o roteiro com a API do g (references/tutorial.md, seção 4). A série é <project>/_serie, cópia desta pasta.
// Os textos daqui são marcadores: dizem o que vai em cada lugar, não são conteúdo.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// A skill primo-videos instalada (~/.claude/skills/primo-videos); VIDEOSTUDIO_SKILL=<skill folder> troca.
const SKILL = [process.env.VIDEOSTUDIO_SKILL, path.join(os.homedir(), '.claude', 'skills', 'primo-videos')]
  .find((d) => d && fs.existsSync(path.join(d, 'scripts', 'tutorial', 'record.mjs')))
if (!SKILL) throw new Error('primo-videos skill not found: install it in ~/.claude/skills/primo-videos or set VIDEOSTUDIO_SKILL=<skill folder>')
const { rodar, principal } = await import(pathToFileURL(path.join(SKILL, 'scripts', 'tutorial', 'record.mjs')).href)

const video = {
  id: 'name-of-the-task',                            // TROQUE: nome curto do arquivo, sem espaço
  titulo: 'Title of the task, in a few words',       // TROQUE: a tarefa, informativa (nada de frase de efeito)
  url: 'http://localhost:5173/?demo=1',              // TROQUE: a prévia local da ferramenta, com os parâmetros na URL
  endereco: 'yourproduct.com',                       // TROQUE: o que a barra do navegador mostra (um nome; nunca caminho com token)
  versoes: ['computer'],                           // 1440×900; a série grava com DSF 3 (zoom nítido)
  pasta: path.dirname(fileURLToPath(import.meta.url)),
  serie: '../_serie',
  idioma: 'en-US', fuso: 'America/Sao_Paulo',        // TROQUE: o idioma e o fuso de quem vai assistir
  tema: 'light',                                     // o navegador pede o tema claro (prefers-color-scheme)
  privacidade: { emailsPermitidos: '@example\\.com$' },  // TROQUE: e-mail que pode aparecer; o resto sai borrado
  borrar: ['[data-private]', '.amount'],             // TROQUE: seletores com dado de cliente, valor, nome
  esconder: { seletores: [], textos: [] },           // o que nunca aparece (aviso de ambiente, banner de teste)
  // async entrar({ p }) { … }                       // login de teste, pela variável de ambiente; nunca senha no código
  async roteiro(g) {
    // TROQUE: a jornada. Uma seção (g.secao) por visão da ferramenta; com 2 ou mais, a abertura mostra o índice delas
    // (01, 02…) sozinha. Cada passo é uma frase curta no imperativo.
    await g.secao('Name of the first view')
    await g.passo('First step, in a few words.')
    await g.toque('nav >> text=Reports')
    await g.passo('Second step.')
    await g.toque('button:has-text("This month")')
    await g.secao('Second view')
    await g.passo('Last step, with the result.')
    await g.toque('button:has-text("Export")')
    await g.espera('text=Done')
    await g.sucesso('text=Done')                    // termine na tela que prova a tarefa feita
  },
}
export default video
if (principal(import.meta.url)) await rodar(video)
