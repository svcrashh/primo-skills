#!/bin/zsh
# Liga cada skill deste repositório na pasta de skills do Claude (padrão: ~/.claude/skills).
# É ligação, não cópia: editar aqui já vale no Claude, e git pull atualiza tudo.
# No fim, cada skill que tem scripts/requisitos.mjs (roda com node) ou scripts/requisitos.py (roda com python3) diz o
# que precisa nesta máquina e o que falta (chave de API, ffmpeg, Node, Python), com o que fazer. Rodar de novo não
# desfaz nada: serve para conferir depois de arrumar.
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

# Sem as ferramentas de linha de comando da Apple, o /usr/bin/python3 existe, mas só abre o pedido para instalá-las.
tem_python3() {
  local p
  p=$(command -v python3) || return 1
  [[ $p != /usr/bin/python3 ]] || xcode-select -p >/dev/null 2>&1
}

requisitos=()
for skill in $repo/*/SKILL.md(N); do
  if [[ -f ${skill:h}/scripts/requisitos.mjs ]]; then requisitos+=(${skill:h}/scripts/requisitos.mjs)
  elif [[ -f ${skill:h}/scripts/requisitos.py ]]; then requisitos+=(${skill:h}/scripts/requisitos.py)
  fi
done
if (( $#requisitos )); then
  echo
  echo "O que cada skill precisa nesta máquina:"
  command -v node >/dev/null && tem_node=1 || tem_node=
  tem_python3 && tem_python=1 || tem_python=
  sem_node=()
  sem_python=()
  for r in $requisitos; do
    if [[ $r == *.mjs ]]; then
      if [[ -n $tem_node ]]; then echo; node $r || true; else sem_node+=(${r:h:h:t}); fi
    else
      if [[ -n $tem_python ]]; then echo; python3 $r || true; else sem_python+=(${r:h:h:t}); fi
    fi
  done
  if (( $#sem_node )); then
    echo
    echo "✖ Node (18 ou mais novo): não achei, e sem ele não dá para conferir nem usar: ${(j:, :)sem_node}."
    echo "    brew install node"
    echo "    Depois rode este instalador de novo."
  fi
  if (( $#sem_python )); then
    echo
    echo "✖ Python 3: não achei, e sem ele não dá para conferir nem usar: ${(j:, :)sem_python}."
    echo "    xcode-select --install"
    echo "    Isso instala as ferramentas de linha de comando da Apple, que trazem o python3. Depois rode este instalador de novo."
  fi
  echo
  echo "Arrumou algo? Rode o instalador de novo para conferir."
fi
