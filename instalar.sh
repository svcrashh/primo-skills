#!/bin/zsh
# Liga cada skill deste repositório na pasta de skills do Claude (padrão: ~/.claude/skills).
# É ligação, não cópia: editar aqui já vale no Claude, e git pull atualiza tudo.
# No fim, cada skill que tem scripts/requisitos.mjs diz o que precisa nesta máquina e o que falta (chave de API,
# ffmpeg, Node), com o que fazer. Rodar de novo não desfaz nada: serve para conferir depois de arrumar.
# Uso: instalar.sh [pasta de skills de outro perfil]
set -e
repo=${0:A:h}
destino=${1:-$HOME/.claude/skills}
mkdir -p $destino
for skill in $repo/*/SKILL.md(N); do
  nome=${skill:h:t}
  alvo=$destino/$nome
  if [[ -e $alvo && ! -L $alvo ]]; then
    echo "$nome: já existe uma pasta de verdade em $alvo. Não mexi: renomeie ou apague e rode de novo."
    continue
  fi
  ln -sfn ${skill:h} $alvo
  echo "$nome -> $alvo"
done

requisitos=($repo/*/scripts/requisitos.mjs(N))
if (( $#requisitos )); then
  echo
  echo "O que cada skill precisa nesta máquina:"
  if command -v node >/dev/null; then
    for r in $requisitos; do
      echo
      node $r || true
    done
  else
    nomes=()
    for r in $requisitos; do nomes+=(${r:h:h:t}); done
    echo
    echo "✖ Node (18 ou mais novo): não achei, e sem ele não dá para conferir nem usar: ${(j:, :)nomes}."
    echo "    brew install node"
    echo "    Depois rode este instalador de novo."
  fi
  echo
  echo "Arrumou algo? Rode o instalador de novo para conferir."
fi
