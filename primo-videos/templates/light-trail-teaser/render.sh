#!/bin/zsh
# Renderiza o light-trail-teaser de um arquivo de parâmetros: monta o projeto, faz a trilha (com a voz, se a locução já
# está em <folder>/project/voice/pt/narration.json; sem ela, a trilha é a protagonista), renderiza cada formato a 60 fps,
# junta o som e tira a folha.
#   templates/light-trail-teaser/render.sh meu.json ~/Desktop/teaser [16x9 9x16 19x9 21x9]
#   MODO=draft templates/light-trail-teaser/render.sh …     → 30 fps rápido, para olhar
#   SUB=1 … → 60 fps sem motion blur (4× mais rápido que o padrão de 4 subquadros)
# O molde não gera voz: a locução, quando há, vem antes, do passo de voz da skill (scripts/voice.mjs generate … --out
# <folder>/project/voice/pt), com uma fala por item de "falas" do JSON (mesmo id; ela toca a partir do "em").
# O Python da trilha (numpy e scipy): o venv do `node <skill>/scripts/environment.mjs --fix` (~/.videostudio/venv,
# ou $VIDEOSTUDIO_HOME/venv) quando existe, senão o python3 do sistema. PYTHON ou VIDEOSTUDIO_PYTHON forçam outro.
set -e
M=${0:A:h}; SKILL=${M:h:h}
J=${1:?usage: render.sh <parametros.json> <folder> [formatos]}; S=${2:?missing the output folder}; shift 2
FORMATOS=(${@:-16x9 9x16}); MODO=${MODO:-final}
VENV_PY=${VIDEOSTUDIO_HOME:-$HOME/.videostudio}/venv/bin/python
PY=${PYTHON:-${VIDEOSTUDIO_PYTHON:-}}; [[ -z $PY && -x $VENV_PY ]] && PY=$VENV_PY; PY=${PY:-python3}
mkdir -p $S; P=$S/project
node $M/assemble.mjs $J $P
NOME=${${J:t}:r}
LOC=$P/voice/pt/narration.json
if [[ -f $LOC && ! -f $SKILL/scripts/tutorial/locucao.mjs ]]; then
  echo "This copy of the skill has no voice module (scripts/tutorial/locucao.mjs is missing): the voiceover in $P/voice/pt is ignored and the soundtrack is the lead."
  LOC=-
fi
[[ -f $LOC ]] || LOC=-
if $PY -c 'import numpy, scipy' 2>/dev/null; then
  mkdir -p $P/audio; $PY $M/soundtrack.py $J $LOC $P/audio/mix.wav
else
  rm -f $P/audio/mix.wav
  echo "WARNING: no Python with numpy and scipy, the video comes out silent. Run once: node $SKILL/scripts/environment.mjs --fix"
fi
for F in $FORMATOS; do
  if [[ $MODO == final ]]; then EXTRA=(--sub ${SUB:-4} --crf 16 --preset medium); else EXTRA=(); fi
  node $SKILL/scripts/render.cjs --project $P --mode $MODO --format $F --out out/$F.mp4 --no-sheet $EXTRA
  V=$P/out/$F.mp4; OUT=$S/$NOME-$F.mp4
  if [[ -f $P/audio/mix.wav ]]; then ffmpeg -v error -y -i $V -i $P/audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $OUT
  else cp $V $OUT; fi
  node $SKILL/scripts/opening.mjs $OUT --json $J || echo "WARNING: the logo opening flagged something above"   # o "aberturaLogo" do JSON
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $OUT)
  case $F in 16x9) SC=480:-1; TL=6x4;; 19x9|21x9) SC=480:-1; TL=4x6;; 9x16) SC=270:-1; TL=8x3;; *) SC=360:-1; TL=6x4;; esac
  N=${TL/x/*}; ffmpeg -v error -y -i $OUT -vf "fps=$(( N ))/$D,scale=$SC,tile=$TL" -frames:v 1 $S/sheet-$NOME-$F.png
  echo "video: $OUT · contact sheet: $S/sheet-$NOME-$F.png ($D s)"
done
