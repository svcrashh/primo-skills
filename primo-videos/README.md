# /primo-videos

**Português** · [English](#english)

Uma skill do Claude Code que faz vídeo do seu produto, sem narração: tutorial com a tela real, lançamento, novidades,
explicação desenhada, número que conta, vinheta, corte para Reels. Ela **não traz marca nem visual pronto**: a marca,
o contexto e as ideias são seus. Ela lê o seu projeto, pergunta o que falta, mostra cada cena como imagem parada antes
de animar e entrega o MP4 (16:9, 19:9, 21:9, 9:16, 4:5 ou 1:1) com trilha original. Tudo roda na sua máquina, sem API
externa.

## Instalar

Hoje roda no **macOS**. Windows vem depois.

A skill mora na pasta `primo-videos/` do repositório [primo-skills](https://github.com/svcrashh/primo-skills), que
tem uma pasta por skill e um `instalar.sh` que liga cada uma em `~/.claude/skills`:

```sh
git clone https://github.com/svcrashh/primo-skills.git ~/Documents/GitHub/primo-skills
~/Documents/GitHub/primo-skills/instalar.sh
node ~/.claude/skills/primo-videos/scripts/environment.mjs --fix
```

O terceiro comando confere o ambiente uma vez por máquina: acha o Playwright e o Chromium, cria o Python da trilha
(numpy e scipy, num venv em `~/.videostudio`) e diz o que faltar, com o comando certo. Com `--yes` ele baixa o
Chromium do Playwright se não houver (~150 MB). O ffmpeg você instala pelo sistema (`brew install ffmpeg`). Para
atualizar depois: `git pull` na pasta do primo-skills (é ligação, não cópia).

## Como pedir

Abra o Claude Code no projeto do seu produto e peça `/primo-videos`, ou em português mesmo:

- "faz um vídeo de 20 segundos mostrando a novidade X"
- "faz um vídeo tutorial de como cadastrar um cliente"
- "mostra os estilos de vídeo"

Ela responde na sua língua. Antes de produzir, pergunta se você quer conversar sobre o vídeo (os assuntos e a direção)
e aprovar um roteiro. Você pode trazer a ideia pronta, uma referência que gosta ou só o pedido.

## O que você recebe

1. **Leitura do seu produto:** marca (logo, cores e o papel de cada uma, fonte), público e telas, tirados do código e
   do site. O que não der para ler, ela pergunta, já com uma sugestão.
2. **Duas ou três direções, cada uma como imagem parada na sua marca.** São 22 estilos que o motor sabe fazer
   (`node ~/.claude/skills/primo-videos/scripts/catalog.mjs list`); você também pode propor um que não está na lista.
3. **Quadro de revisão no navegador:** uma fase por cena. Você aprova a imagem parada, só então ela anima; você
   aprova a prévia com som, só então sai o final. Dá para colar a sua própria imagem numa cena e escrever em cada uma.
4. **O vídeo final** em cada formato, com a folha de quadros, a conferência de legibilidade e uma crítica independente,
   e a pasta do projeto para refazer.

Cada marca fica guardada em `~/Documents/VideoStudio/Brands/<marca>/` (o kit do produto, as opções de logo e slogan e
o histórico), para o próximo vídeo começar pronto e não sair igual ao anterior.

## O que precisa ter na máquina

- Node.js 18 ou mais novo, Python 3 e ffmpeg;
- o Chromium do Playwright (o comando de ambiente resolve);
- macOS (Windows vem depois);
- Claude Code, que a skill também usa para escrever a tese do vídeo e para a crítica (`claude -p`).

O render final é pesado (alguns minutos por vídeo): em notebook, deixe na tomada.

A documentação completa está em [`SKILL.md`](SKILL.md) e em [`references/`](references/), em inglês.

## Licença

[MIT](LICENSE). A explicação desenhada usa um motor portado do explainroo (MIT), com Rough.js (MIT) e os ícones
Lucide (ISC); o 3D usa three.js (MIT); os exemplos usam a fonte Inter (SIL Open Font License).

---

## English

A Claude Code skill that makes a video of your product, without narration: a tutorial on the real screen, a launch,
what's new, a drawn explainer, a counting number, a logo sting, a cut for Reels. It **ships no brand and no ready-made
look**: the brand, the context and the ideas are yours. It reads your project, asks for what is missing, shows every
scene as a still before animating it and delivers the MP4 (16:9, 19:9, 21:9, 9:16, 4:5 or 1:1) with an original
soundtrack. Everything runs on your machine, with no external API.

### Install

Today it runs on **macOS**. Windows comes later.

The skill lives in the `primo-videos/` folder of the [primo-skills](https://github.com/svcrashh/primo-skills)
repository, which has one folder per skill and an `instalar.sh` that links each one into `~/.claude/skills`:

```sh
git clone https://github.com/svcrashh/primo-skills.git ~/Documents/GitHub/primo-skills
~/Documents/GitHub/primo-skills/instalar.sh
node ~/.claude/skills/primo-videos/scripts/environment.mjs --fix
```

The third command checks the environment once per machine: it finds Playwright and Chromium, creates the soundtrack's
Python (numpy and scipy, in a venv under `~/.videostudio`) and says what is missing, with the right command. With
`--yes` it downloads Playwright's Chromium when there is none (~150 MB). ffmpeg comes from your system
(`brew install ffmpeg`). To update later: `git pull` in the primo-skills folder (it is a link, not a copy).

### How to ask

Open Claude Code in your product's project and ask for `/primo-videos`, or in plain words:

- "make a 20-second video showing the new feature X"
- "make a tutorial video on how to register a customer"
- "show me the video styles"

It answers in your language. Before producing, it asks whether you want to talk the video through (the topics and the
direction) and approve a script. You can bring a finished idea, a reference you like, or just the request.

### What you get

1. **A reading of your product:** brand (logo, colors and the role of each one, font), audience and screens, taken
   from the code and the site. What it cannot read, it asks, with a suggestion.
2. **Two or three directions, each one as a still in your brand.** The engine makes 22 styles
   (`node ~/.claude/skills/primo-videos/scripts/catalog.mjs list`); you can also propose one that is not on the list.
3. **A review board in the browser:** one phase per scene. You approve the still, and only then it animates; you
   approve the preview with sound, and only then the final is rendered. You can paste your own picture into a scene
   and write on each one.
4. **The final video** in each format, with its contact sheet, the legibility check and an independent critique, and
   the project folder to redo it.

Each brand is kept in `~/Documents/VideoStudio/Brands/<brand>/` (the product kit, the logo and slogan options and the
history), so the next video starts ready and does not come out the same as the previous one.

### What your machine needs

- Node.js 18 or newer, Python 3 and ffmpeg;
- Playwright's Chromium (the environment command takes care of it);
- macOS (Windows comes later);
- Claude Code, which the skill also uses to write the video's thesis and for the critique (`claude -p`).

The final render is heavy (a few minutes per video): on a laptop, keep it plugged in.

The full documentation is in [`SKILL.md`](SKILL.md) and [`references/`](references/).

### License

[MIT](LICENSE). The drawn explainer uses an engine ported from explainroo (MIT), with Rough.js (MIT) and the Lucide
icons (ISC); the 3D uses three.js (MIT); the examples use the Inter font (SIL Open Font License).
