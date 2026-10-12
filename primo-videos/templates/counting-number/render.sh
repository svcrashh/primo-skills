#!/bin/zsh
# Do parâmetro ao vídeo entregue, com trilha (e a voz, se a locução já existe), num formato ou em vários.
#   templates/counting-number/render.sh <parametros.json> <video-folder> [formatos] [draft|final]
#   ex.: render.sh example.json ~/Desktop/numeros 16x9,9x16 final
# Passos: preparar (com falas, escreve voice/script.json para o passo de voz da skill) → preparar com a locução, se
# <folder>/voice/pt/narration.json existe → trilha (arranjo_serie: com o bloco voz, cede à fala; sem ele, é a
# protagonista) → render de cada formato → finalizar (confere a entrega) → folha de quadros.
# O molde não gera voz: com falas e sem locução ele para e diz o que fazer. SEM_VOZ=1 sai só com a trilha.
# O Python da trilha (numpy e scipy): o venv do `node <skill>/scripts/environment.mjs --fix` (~/.videostudio/venv,
# ou $VIDEOSTUDIO_HOME/venv) quando existe, senão o python3 do sistema. PYTHON ou VIDEOSTUDIO_PYTHON forçam outro.
set -e
M=${0:A:h}; SKILL=${M:h:h}; S=$SKILL/scripts
PJ=${1:A}; D=${2:A}; FMTS=${3:-16x9,9x16}; MODO=${4:-final}
VENV_PY=${VIDEOSTUDIO_HOME:-$HOME/.videostudio}/venv/bin/python
PY=${PYTHON:-${VIDEOSTUDIO_PYTHON:-}}; [[ -z $PY && -x $VENV_PY ]] && PY=$VENV_PY; PY=${PY:-python3}
[[ -f $PJ && -n $2 ]] || { echo "usage: render.sh <parametros.json> <video-folder> [16x9,9x16] [draft|final]"; exit 1 }

node $M/prepare.mjs $PJ $D
LOC=$D/voice/pt/narration.json
if [[ -z $SEM_VOZ && -f $LOC ]]; then
  node $M/prepare.mjs $PJ $D --narration $LOC
elif [[ -z $SEM_VOZ && -f $D/voice/script.json ]]; then
  echo "the lines (falas) exist, but $LOC does not: generate the voiceover from $D/voice/script.json in $D/voice/pt before the render (the voice step in SKILL.md), or run with SEM_VOZ=1 to output with the soundtrack only"
  exit 1
fi
rm -f $D/audio/soundtrack.wav
if [[ -z $SEM_VOZ && -f $LOC ]] || $PY -c 'import numpy, scipy' 2>/dev/null; then
  (cd $D/audio && $PY $SKILL/assets/audio/arrange_series.py identity.json sheet.json)
else
  echo "WARNING: no Python with numpy and scipy, the video comes out silent. Run once: node $S/environment.mjs --fix"
fi
NOME=${D:t}; mkdir -p $D/delivery
for F in ${(s:,:)FMTS}; do
  if [[ $MODO == final ]]; then EXTRA=(--sub 4 --crf 16 --preset medium); else EXTRA=(); fi
  node $S/render.cjs --project $D --mode $MODO --format $F --out out/$F.mp4 --no-sheet $EXTRA
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $D/out/$F.mp4)
  case $F in 16x9) SC=480:-1; TL=6x4;; 19x9) SC=570:-1; TL=6x4;; 21x9) SC=630:-1; TL=6x4;; 9x16) SC=270:-1; TL=8x3;; *) SC=360:-1; TL=6x4;; esac
  if [[ -f $D/audio/soundtrack.wav ]]; then
    node $S/finalize.mjs --project $D --video out/$F.mp4 --audio audio/soundtrack.wav --out $D/delivery/$NOME-$F.mp4 || echo "WARNING: finalizar flagged something above"
    V=$D/delivery/$NOME-$F.mp4
  else V=$D/out/$F.mp4; fi
  node $S/opening.mjs $V --json $PJ || echo "WARNING: the logo opening flagged something above"   # o "aberturaLogo" do JSON
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $V)
  ffmpeg -v error -y -i $V -vf "fps=24/$DUR,scale=$SC,tile=$TL" -frames:v 1 $D/delivery/sheet-$F.png
  echo "✓ $V  ·  contact sheet: $D/delivery/sheet-$F.png"
done
