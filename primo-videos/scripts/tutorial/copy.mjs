// Copia o motor do modo tutorial para dentro de um repositório, para os vídeos rodarem sem a skill
// instalada (outra máquina, Windows, CI). A cópia tem o mesmo layout da skill, então os caminhos
// relativos continuam valendo. Recopie quando a skill melhorar: o MOTOR.md diz de quando é a cópia.
//   node copy.mjs <destination>        ex.: node copy.mjs docs/videos/_motor
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..', '..')
const destino = process.argv[2]
if (!destino) { console.error('usage: node copy.mjs <destination>'); process.exit(1) }
const D = path.resolve(destino)
const ARQUIVOS = [
  'scripts/playwright.cjs', 'scripts/where.cjs', 'scripts/environment.mjs', 'scripts/frames.cjs', 'scripts/render.cjs', 'scripts/finalize.mjs', 'scripts/fonts.mjs', 'scripts/logo.mjs',
  ...fs.readdirSync(path.join(SKILL, 'scripts/tutorial')).filter((f) => /\.(mjs|js|cjs)$/.test(f)).map((f) => 'scripts/tutorial/' + f),
  ...fs.readdirSync(path.join(SKILL, 'assets/template')).filter((f) => /\.(js|html)$/.test(f)).map((f) => 'assets/template/' + f),
  'assets/audio/synth.py', 'assets/audio/verify.py', 'assets/audio/sounds.py', 'assets/audio/series.py', 'assets/audio/arrange_series.py', 'assets/audio/API.md',
  // o modo cinema (cinema.js, já na lista de scripts/tutorial) precisa do kit 3D
  'assets/3d/three.bundle.js', 'assets/3d/kit3d.js',
  'references/tutorial.md',
]
// Só existem nos pacotes com narração (e o canal, só no que tem o app): vão junto quando estão lá, sem aviso quando não
// estão. Com o canal, o gravar e o compor da cópia também avisam o app.
const DOS_MODULOS = ['assets/audio/mix_voz.py', 'references/voice-tutorial.md', 'references/voice-mix.md', 'scripts/app/canal.mjs']
ARQUIVOS.push(...DOS_MODULOS.filter((f) => fs.existsSync(path.join(SKILL, f))))
let n = 0
for (const f of ARQUIVOS) {
  const de = path.join(SKILL, f)
  if (!fs.existsSync(de)) { console.error(`warning: ${f} does not exist in the skill`); continue }
  fs.mkdirSync(path.dirname(path.join(D, f)), { recursive: true })
  fs.copyFileSync(de, path.join(D, f)); n++
}
fs.writeFileSync(path.join(D, 'MOTOR.md'), `# Tutorial engine (copy of the primo-videos skill engine)

Copied on ${new Date().toISOString().slice(0, 10)} by \`scripts/tutorial/copy.mjs\`. Do not edit here: improve it in the skill
and copy again (\`node <skill>/scripts/tutorial/copy.mjs ${destino}\`). The contract is in
\`references/tutorial.md\`.

- Record: \`node <video-folder>/video.mjs [--device phone] [--check]\`
- Compose: \`node ${destino}/scripts/tutorial/compose.mjs <video-folder> [--mode final]\`
- Needs: Node 18+, ffmpeg, Playwright with Chromium and Python 3 with numpy + scipy. Once per machine:
  \`node ${destino}/scripts/environment.mjs --fix\` finds Playwright and Chromium (with \`--yes\`, it downloads the
  missing ones, ~300 MB), creates the soundtrack Python in \`~/.videostudio/venv\` and writes \`~/.videostudio/environment.json\`,
  which gravar and compor read on their own. \`PLAYWRIGHT_PATH\` and \`VIDEOSTUDIO_PYTHON\` only force another path.
- Do not commit: \`*/output/\`, \`*.mp4\`, \`.venv/\` (add them to .gitignore).
`)
console.log(`${n} files copied to ${D} (+ MOTOR.md)`)
