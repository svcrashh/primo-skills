# /primo-videos

**Português** · [English](#english)

Uma skill do Claude Code que faz vídeo do seu produto, com ou sem narração: tutorial com a tela real, lançamento,
novidades, explicação desenhada, número que conta, vinheta, corte para Reels. Sem narração, que é o padrão, o vídeo é
contado pelo texto na tela, pela trilha original e pelos efeitos; com narração, ganha uma voz em off. Ela **não traz
marca nem visual pronto**: a marca, o contexto e as ideias são seus. Ela lê o seu projeto, pergunta o que falta, mostra
cada cena como imagem parada antes de animar e entrega o MP4 (16:9, 19:9, 21:9, 9:16, 4:5 ou 1:1) com trilha original.
Sem voz e sem imagem gerada, tudo roda na sua máquina, sem API externa; a voz em off (ElevenLabs) e as imagens geradas
(OpenAI) são opcionais e pagas, com a sua chave.

## Instalar

Roda no **macOS** e no **Windows** (o que muda no Windows está em [No Windows](#no-windows)).

A skill mora na pasta `primo-videos/` do repositório [primo-skills](https://github.com/svcrashh/primo-skills), que
tem uma pasta por skill e um instalador que liga cada uma na pasta de skills do Claude Code. No Mac, no Terminal:

```sh
git clone https://github.com/svcrashh/primo-skills.git ~/Documents/GitHub/primo-skills
~/Documents/GitHub/primo-skills/instalar.sh
node ~/.claude/skills/primo-videos/scripts/environment.mjs --fix
```

No Windows, no PowerShell:

```powershell
git clone https://github.com/svcrashh/primo-skills.git "$env:USERPROFILE\Documents\GitHub\primo-skills"
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Documents\GitHub\primo-skills\instalar.ps1"
node "$env:USERPROFILE\.claude\skills\primo-videos\scripts\environment.mjs" --fix
```

O terceiro comando confere o ambiente uma vez por máquina: acha o Playwright e o Chromium, cria o Python da trilha
(numpy e scipy, num venv em `~/.videostudio`) e diz o que faltar, com o comando certo. Com `--yes` ele baixa o
Chromium do Playwright se não houver (~300 MB). O ffmpeg você instala pelo sistema (Mac: `brew install ffmpeg`;
Windows: `winget install ffmpeg`, e depois feche e abra o PowerShell e o Claude Code). Para atualizar depois:
`git pull` na pasta do primo-skills (é ligação, não cópia).

Logo depois de ligar a skill, o instalador mostra o que ela precisa e o que falta nesta máquina (Node, ffmpeg, a
conferência do ambiente e as duas chaves opcionais), com o comando ou os passos de cada coisa. Para ver de novo quando
quiser: `node ~/.claude/skills/primo-videos/scripts/requisitos.mjs` (com `--lang en`, em inglês).

## Como pedir

Abra o Claude Code no projeto do seu produto e peça `/primo-videos`, ou em português mesmo:

- "faz um vídeo de 20 segundos mostrando a novidade X"
- "faz um vídeo tutorial de como cadastrar um cliente"
- "faz um vídeo tutorial narrado de como cadastrar um cliente"
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
   Com voz, você aprova o roteiro de locução antes de qualquer gasto e escolhe a voz ouvindo; o que o vídeo já gastou
   aparece no quadro.
4. **O vídeo final** em cada formato, com a folha de quadros, a conferência de legibilidade e uma crítica independente,
   e a pasta do projeto para refazer.

Cada marca fica guardada em `~/Documents/VideoStudio/Brands/<marca>/` (o kit do produto, as opções de logo e slogan e
o histórico), para o próximo vídeo começar pronto e não sair igual ao anterior.

## Voz e imagens (opcionais)

Duas coisas pagas, que só entram quando você pede e tem a chave do serviço. Sem elas, a skill funciona exatamente como
antes, inteira na sua máquina.

- **Voz em off,** lida pela ElevenLabs: o roteiro de locução é aprovado antes de qualquer gasto, e a voz você escolhe
  ouvindo a mesma frase em duas ou três vozes.
- **Imagem gerada,** pela OpenAI, só para o que não existe no produto nem na marca: um cenário, um objeto, um fundo.
  Nunca a tela do produto, o logo, uma pessoa real ou texto dentro da imagem.
- **As chaves:** `ELEVENLABS_API_KEY` e `OPENAI_API_KEY`. Como conseguir e guardar cada uma está logo abaixo; o
  `requisitos.mjs` e o `environment.mjs` dizem se cada uma existe, sem mostrar o valor.
- **Quanto custa, por alto:** as opções de uma imagem saem em qualidade baixa, ~US$ 0,006 cada; a escolhida, refeita em
  alta, ~US$ 0,04 a 0,08. A locução gasta até uns 900 créditos da ElevenLabs por minuto.
- **Teto por vídeo:** US$ 0,50 em imagem (umas quatro cenas geradas) e 1.500 créditos de voz. Para passar disso, ela
  pergunta antes. O gasto fica à vista no quadro de revisão, atualizado a cada chamada paga.

### Como conseguir e guardar cada chave

Só a do que você for usar; uma não depende da outra.

| | Voz em off | Imagem gerada |
|---|---|---|
| Serviço | ElevenLabs | OpenAI |
| Onde se cria | [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys), no menu da esquerda, em "Developers" → "API Keys" | [platform.openai.com](https://platform.openai.com), em "API keys" |
| O que gasta | os créditos do plano da sua própria conta | a API é paga por uso e é separada da assinatura do ChatGPT: precisa de crédito na conta da API (em "Billing") |
| Arquivo | `~/.claude/secrets/elevenlabs.env` | `~/.claude/secrets/openai.env` |
| A linha | `ELEVENLABS_API_KEY=` e a chave | `OPENAI_API_KEY=` e a chave |

1. Crie a chave no serviço (a tabela diz onde).
2. No Mac, no Terminal, crie a pasta e o arquivo, fechados só para você, e abra o arquivo no TextEdit. Para a OpenAI:
   ```sh
   mkdir -p ~/.claude/secrets && chmod 700 ~/.claude/secrets
   touch ~/.claude/secrets/openai.env && chmod 600 ~/.claude/secrets/openai.env
   open -e ~/.claude/secrets/openai.env
   ```
   No Windows, no PowerShell, crie a pasta e abra o arquivo no Bloco de Notas (ele pergunta se cria o arquivo: diga
   que sim). O arquivo fica em `%USERPROFILE%\.claude\secrets\`:
   ```powershell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\secrets" | Out-Null
   notepad "$env:USERPROFILE\.claude\secrets\openai.env"
   ```
   Para a ElevenLabs, os mesmos comandos com `elevenlabs.env` no lugar de `openai.env`.
3. No arquivo, escreva uma linha só, a da tabela, com a chave logo depois do `=` (sem espaço nem aspas), e salve.
4. Confira: `node ~/.claude/skills/primo-videos/scripts/requisitos.mjs`. A linha da chave passa a ✔, sem mostrar o
   valor.

A chave nunca é colada na conversa com o Claude, nunca vai para o git e nunca é impressa: quem a põe no arquivo é você,
com o seu editor. Em vez do arquivo, também vale a variável de ambiente de mesmo nome.

## O que precisa ter na máquina

- Node.js 18 ou mais novo, Python 3 e ffmpeg;
- o Chromium do Playwright (o comando de ambiente resolve);
- macOS ou Windows;
- Claude Code, que a skill também usa para escrever a tese do vídeo e para a crítica (`claude -p`);
- opcional: a conta e a chave da ElevenLabs (voz) e da OpenAI (imagens geradas), em
  [Como conseguir e guardar cada chave](#como-conseguir-e-guardar-cada-chave).

O render final é pesado (alguns minutos por vídeo): em notebook, deixe na tomada.

## No Windows

Rodou num Windows de verdade em 12/10/2026: o `windows-latest` do GitHub Actions (Windows Server 2025, sem placa de
vídeo e sem conta do Claude). Lá passaram a suíte de testes inteira, a instalação do zero (os passos do `requisitos.mjs` e a conferência do
ambiente), vídeos de ponta a ponta
(com trilha, com voz em off de uma API de mentira, em capítulos), a conferência de legibilidade, o quadro de revisão
no navegador e a gravação da janela de um programa. O que muda em relação ao Mac:

- **O vídeo é desenhado pelo processador**, não pela placa de vídeo: a mesma imagem, mais devagar, sobretudo nas cenas
  em 3D.
- **A conferência de legibilidade** lê o texto com o reconhecimento de texto do próprio Windows, no idioma do seu
  Windows. Se ele não tiver um idioma com esse recurso, a conferência de legibilidade é pulada com um aviso, e as
  outras seguem.
- **Gravar o terminal** de um programa de linha de comando usa o Git Bash (vem com o Git for Windows, que o Claude
  Code também usa). **Gravar a janela** de um programa não pede permissão: deixe a janela inteira na tela, sem nada por
  cima, enquanto grava.
- **Não deu para provar no runner,** confira na primeira vez: a tese e a crítica com a sua conta do Claude (rode
  `claude --version` no mesmo terminal), a voz e as imagens com as suas chaves, a placa de vídeo, tela com escala
  diferente de 100% ou dois monitores na gravação de janela, e Windows 10 ou 11.

A documentação completa está em [`SKILL.md`](SKILL.md) e em [`references/`](references/), em inglês.

## Licença

[MIT](LICENSE). A explicação desenhada usa um motor portado do explainroo (MIT), com Rough.js (MIT) e os ícones
Lucide (ISC); o 3D usa three.js (MIT); os exemplos usam a fonte Inter (SIL Open Font License).

---

## English

A Claude Code skill that makes a video of your product, with or without narration: a tutorial on the real screen, a
launch, what's new, a drawn explainer, a counting number, a logo sting, a cut for Reels. Without narration, the
default, the video is told by on-screen text, an original soundtrack and sound effects; with narration, it gets a
voiceover. It **ships no brand and no ready-made look**: the brand, the context and the ideas are yours. It reads your
project, asks for what is missing, shows every scene as a still before animating it and delivers the MP4 (16:9, 19:9,
21:9, 9:16, 4:5 or 1:1) with an original soundtrack. Without a voiceover and without generated images, everything runs
on your machine, with no external API; the voiceover (ElevenLabs) and the generated images (OpenAI) are optional and
paid, with your own key.

### Install

It runs on **macOS** and **Windows** (what changes on Windows is in [On Windows](#on-windows)).

The skill lives in the `primo-videos/` folder of the [primo-skills](https://github.com/svcrashh/primo-skills)
repository, which has one folder per skill and an installer that links each one into Claude Code's skills folder. On a
Mac, in Terminal:

```sh
git clone https://github.com/svcrashh/primo-skills.git ~/Documents/GitHub/primo-skills
~/Documents/GitHub/primo-skills/instalar.sh
node ~/.claude/skills/primo-videos/scripts/environment.mjs --fix
```

On Windows, in PowerShell:

```powershell
git clone https://github.com/svcrashh/primo-skills.git "$env:USERPROFILE\Documents\GitHub\primo-skills"
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Documents\GitHub\primo-skills\instalar.ps1"
node "$env:USERPROFILE\.claude\skills\primo-videos\scripts\environment.mjs" --fix
```

The third command checks the environment once per machine: it finds Playwright and Chromium, creates the soundtrack's
Python (numpy and scipy, in a venv under `~/.videostudio`) and says what is missing, with the right command. With
`--yes` it downloads Playwright's Chromium when there is none (~300 MB). ffmpeg comes from your system (Mac:
`brew install ffmpeg`; Windows: `winget install ffmpeg`, then close and reopen PowerShell and Claude Code). To update
later: `git pull` in the primo-skills folder (it is a link, not a copy).

Right after linking the skill, the installer shows what it needs and what this machine is missing (Node, ffmpeg, the
environment check and the two optional keys), with the command or the steps for each one. To see it again any time:
`node ~/.claude/skills/primo-videos/scripts/requisitos.mjs --lang en` (without `--lang en`, in Portuguese).

### How to ask

Open Claude Code in your product's project and ask for `/primo-videos`, or in plain words:

- "make a 20-second video showing the new feature X"
- "make a tutorial video on how to register a customer"
- "make a narrated tutorial video on how to register a customer"
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
   and write on each one. With a voiceover, you approve the voiceover script before anything is spent and pick the
   voice by ear; what the video has spent shows on the board.
4. **The final video** in each format, with its contact sheet, the legibility check and an independent critique, and
   the project folder to redo it.

Each brand is kept in `~/Documents/VideoStudio/Brands/<brand>/` (the product kit, the logo and slogan options and the
history), so the next video starts ready and does not come out the same as the previous one.

### Voice and images (optional)

Two paid extras, used only when you ask for them and have the service's key. Without them, the skill works exactly as
before, entirely on your machine.

- **Voiceover,** read by ElevenLabs: the voiceover script is approved before anything is spent, and you pick the voice
  by hearing the same sentence read by two or three voices.
- **Generated image,** from OpenAI, only for what neither the product nor the brand has: a setting, an object, a
  backdrop. Never the product's screen, the logo, a real person or text inside the image.
- **The keys:** `ELEVENLABS_API_KEY` and `OPENAI_API_KEY`. How to get and store each one is right below;
  `requisitos.mjs` and `environment.mjs` say whether each one exists, without showing it.
- **What it costs, roughly:** an image's options come out in low quality, ~US$ 0.006 each; the chosen one, redone in
  high quality, ~US$ 0.04 to 0.08. A voiceover spends up to about 900 ElevenLabs credits per minute.
- **Cap per video:** US$ 0.50 of images (about four generated scenes) and 1,500 voice credits. To go past them, it
  asks first. The spending stays in view on the review board, updated after every paid call.

#### How to get and store each key

Only the one for what you will use; neither depends on the other.

| | Voiceover | Generated images |
|---|---|---|
| Service | ElevenLabs | OpenAI |
| Where it is created | [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys), in the left menu, under "Developers" → "API Keys" | [platform.openai.com](https://platform.openai.com), under "API keys" |
| What it spends | the credits of your own account's plan | the API is paid per use and is separate from the ChatGPT subscription: it needs credit on the API account (under "Billing") |
| File | `~/.claude/secrets/elevenlabs.env` | `~/.claude/secrets/openai.env` |
| The line | `ELEVENLABS_API_KEY=` and the key | `OPENAI_API_KEY=` and the key |

1. Create the key at the service (the table says where).
2. On a Mac, in Terminal, create the folder and the file, closed to anyone but you, and open the file in TextEdit. For
   OpenAI:
   ```sh
   mkdir -p ~/.claude/secrets && chmod 700 ~/.claude/secrets
   touch ~/.claude/secrets/openai.env && chmod 600 ~/.claude/secrets/openai.env
   open -e ~/.claude/secrets/openai.env
   ```
   On Windows, in PowerShell, create the folder and open the file in Notepad (it asks whether to create the file: say
   yes). The file lives in `%USERPROFILE%\.claude\secrets\`:
   ```powershell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\secrets" | Out-Null
   notepad "$env:USERPROFILE\.claude\secrets\openai.env"
   ```
   For ElevenLabs, the same commands with `elevenlabs.env` in place of `openai.env`.
3. In the file, write a single line, the one from the table, with the key right after the `=` (no spaces, no quotes),
   and save.
4. Check it: `node ~/.claude/skills/primo-videos/scripts/requisitos.mjs --lang en`. The key's line turns into ✔,
   without showing the value.

The key is never pasted into the conversation with Claude, never goes into git and is never printed: you put it in the
file yourself, with your own editor. Instead of the file, the environment variable of the same name works too.

### What your machine needs

- Node.js 18 or newer, Python 3 and ffmpeg;
- Playwright's Chromium (the environment command takes care of it);
- macOS or Windows;
- Claude Code, which the skill also uses to write the video's thesis and for the critique (`claude -p`);
- optional: an ElevenLabs account and key (voiceover) and an OpenAI one (generated images), in
  [How to get and store each key](#how-to-get-and-store-each-key).

The final render is heavy (a few minutes per video): on a laptop, keep it plugged in.

### On Windows

It ran on a real Windows on 12/10/2026: GitHub Actions' `windows-latest` (Windows Server 2025, no graphics card and no
Claude account). The whole test suite passed there, along with the install from scratch (the steps `requisitos.mjs` gives and the
environment check), videos end to end (with a
soundtrack, with a voiceover from a fake API, in chapters), the legibility check, the review board in the browser and
the recording of a program's window. What changes from the Mac:

- **The video is drawn by the processor**, not the graphics card: the same image, slower, most of all in 3D scenes.
- **The legibility check** reads the text with Windows' own text recognition, in your Windows' language. If it has no
  language with that feature, the legibility check is skipped with a warning, and the other checks run.
- **Recording the terminal** of a command-line program uses Git Bash (it comes with Git for Windows, which Claude Code
  uses too). **Recording a program's window** asks for no permission: keep the window whole on the screen, with nothing
  on top, while it records.
- **Not proven on the runner,** check the first time: the thesis and the critique with your Claude account (run
  `claude --version` in the same terminal), the voice and the images with your keys, a graphics card, screen scaling
  other than 100% or two monitors when recording a window, and Windows 10 or 11.

The full documentation is in [`SKILL.md`](SKILL.md) and [`references/`](references/).

### License

[MIT](LICENSE). The drawn explainer uses an engine ported from explainroo (MIT), with Rough.js (MIT) and the Lucide
icons (ISC); the 3D uses three.js (MIT); the examples use the Inter font (SIL Open Font License).
