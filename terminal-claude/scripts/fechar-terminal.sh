#!/bin/zsh
# Fecha janelas do Terminal abertas pelo open-terminal.sh, sem o diálogo "finalizar os processos?".
#
# O diálogo só aparece quando a janela tem processo além do shell de login. Então a ordem aqui é:
# encerrar o claude daquela janela (o caffeinate sai junto, é pai dele), esperar o tty esvaziar e
# só então fechar. Nada de mexer nas preferências do Terminal.
#
# Antes de fechar, confere se a janela está segurando um servidor (dev server, proxy, watcher):
# o processo nasce dentro dela e morre junto. Nesse caso não fecha, a não ser com --forcar.
#
#   fechar-terminal.sh                 fecha as janelas que ESTA sessão abriu (pelo registro)
#   fechar-terminal.sh 40524 40535     fecha as janelas com esses ids
#   fechar-terminal.sh --todas         fecha as janelas registradas de qualquer sessão
#   fechar-terminal.sh --listar        só mostra o que seria fechado
#   fechar-terminal.sh --forcar ...    fecha mesmo segurando servidor (derruba o servidor junto)
#
# O registro aqui é só lido. Quem tira dele a janela fechada é o terminais.py, com a trava: o
# `terminais.py fechar` faz isso logo depois deste script, e qualquer outra chamada dele também.
# Regravado daqui, sem a trava, sumia a linha da janela que outra sessão abria na mesma hora.
set -u
REGISTRO=/private/tmp/claude-terminais-abertos.tsv
sessao=${CLAUDE_CODE_SESSION_ID:-sem-sessao}
forcar=0; listar=0; todas=0; ids=()
typeset -A registrado   # id -> tty, das janelas que vieram do registro
for a in "$@"; do
  case "$a" in
    --forcar) forcar=1 ;;
    --listar) listar=1 ;;
    --todas)  todas=1 ;;
    --*) echo "uso: $0 [--todas] [--listar] [--forcar] [ID ...]" >&2; exit 2 ;;
    *) ids+=("$a") ;;
  esac
done

if (( ${#ids} == 0 )) && [[ -f $REGISTRO ]]; then
  while IFS=$'\t' read -r id tty pasta ses resto; do
    [[ -z ${id:-} ]] && continue
    if (( todas )) || [[ ${ses:-} == $sessao ]]; then ids+=("$id"); registrado[$id]=$tty; fi
  done < $REGISTRO
fi
if (( ${#ids} == 0 )); then echo "nenhuma janela registrada para fechar"; exit 0; fi

ttys=$(/usr/bin/osascript -e 'tell application "Terminal"
  set out to ""
  repeat with w in windows
    try
      set out to out & (id of w) & " " & (tty of selected tab of w) & linefeed
    end try
  end repeat
  return out
end tell' 2>/dev/null)
tty_de() { echo "$ttys" | awk -v i="$1" '$1==i{print $2}' }

# A linha de uma janela que já fechou fica no registro até o terminais.py passar: sai da lista
# calada, que ela não é novidade para ninguém.
if (( ${#registrado} )); then
  abertas=()
  for id in $ids; do [[ -n $(tty_de $id) ]] && abertas+=("$id"); done
  ids=($abertas)
  if (( ${#ids} == 0 )); then echo "nenhuma janela registrada para fechar"; exit 0; fi
fi

# pid -> porta em LISTEN (uma varredura só) e a árvore pid/ppid da máquina.
listen=$(lsof -nP -iTCP -sTCP:LISTEN -Fpn 2>/dev/null | awk '/^p/{pid=substr($0,2)} /^n/{print pid" "substr($0,2)}')
arvore=$(ps -axo pid=,ppid=)

fechar=(); pulou=0
for id in $ids; do
  tty=$(tty_de $id)
  if [[ -z $tty ]]; then echo "janela $id: não existe mais (já fechada)"; continue; fi
  # O Terminal recomeça a contagem dos ids quando reabre: o id de uma linha velha pode ser hoje o
  # de outra janela. A do registro é a que tem o tty do registro.
  if [[ -n ${registrado[$id]:-} && $tty != ${registrado[$id]} ]]; then
    echo "janela $id: no registro o tty dela é ${registrado[$id]} e agora é $tty (o id passou para outra janela, ou há outra aba na frente) — não fechei."
    continue
  fi
  donos=$(ps -axo pid=,tty= | awk -v t="${tty#/dev/}" '$2==t{print $1}')
  servidores=""
  while read -r spid porta; do
    [[ -z ${spid:-} ]] && continue
    a=$spid
    for _ in {1..20}; do
      a=$(echo "$arvore" | awk -v x="$a" '$1==x{print $2; exit}')
      [[ -z $a ]] && break
      (( a <= 1 )) && break
      if echo "$donos" | grep -qx "$a"; then servidores="$servidores $porta"; break; fi
    done
  done <<< "$listen"
  servidores=$(echo $servidores | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
  if [[ -n $servidores ]] && (( ! forcar )); then
    echo "janela $id ($tty): segura servidor em $servidores — não fechei."
    echo "   relance o servidor fora da janela (nohup) antes, ou use --forcar para derrubar junto."
    pulou=1; continue
  fi
  fechar+=("$id:$tty")
done

if (( listar )); then
  for f in $fechar; do echo "fecharia janela ${f%%:*} (${f##*:})"; done
  exit 0
fi

tentadas=()
for f in $fechar; do
  id=${f%%:*}; tty=${f##*:}
  # Encerra tudo que roda na janela menos o shell de login — é a presença desses processos que
  # faz o Terminal perguntar "finalizar os processos?". Matar o claude basta no caso normal; o
  # --forcar precisa alcançar também servidor e afins, por isso a regra é por tty, não por nome.
  vivos() { ps -axo pid=,tty=,command= | awk -v t="${tty#/dev/}" '$2==t && $0 !~ /-zsh$|login -pf|awk/{print $1}'; }
  for p in $(vivos); do kill "$p" 2>/dev/null; done
  for _ in {1..40}; do [[ -z $(vivos) ]] && break; /bin/sleep 0.1; done
  for p in $(vivos); do kill -9 "$p" 2>/dev/null; done
  for _ in {1..20}; do [[ -z $(vivos) ]] && break; /bin/sleep 0.1; done
  # Só matar os processos não basta: com o shell de login ainda vivo o Terminal pergunta mesmo
  # assim (a preferência desta máquina é "sempre perguntar"). Mandando o shell sair primeiro, a
  # janela fica em "processo concluído" e aí o close fecha calado. Testado em 04/10/2026.
  /usr/bin/osascript -e "tell application \"Terminal\" to do script \"exit\" in (first window whose id is $id)" >/dev/null 2>&1
  for _ in {1..40}; do
    [[ -z $(ps -axo tty= | tr -d ' ' | grep -x "${tty#/dev/}") ]] && break
    /bin/sleep 0.1
  done
  /usr/bin/osascript -e "tell application \"Terminal\" to close (every window whose id is $id)" 2>/dev/null
  tentadas+=("$id")
done

# Janela fechada continua na lista de ids como objeto fantasma (visible falso, zero abas), e
# contá-la dizia 'não fechou' para janela que fechou. Por isso a conferência exige aba e visible.
# O close é assíncrono e o Terminal atende um de cada vez: conferir janela a janela, no meio do
# caminho, dá resposta instável. Por isso a conferência é uma só, no fim, pela lista de ids vivos.
fechadas=0
for _ in {1..40}; do
  vivas=$(/usr/bin/osascript -e 'tell application "Terminal"
      set out to ""
      repeat with w in windows
        try
          if (count of tabs of w) > 0 and (visible of w) then set out to out & (id of w) & linefeed
        end try
      end repeat
      return out
    end tell' 2>/dev/null | tr -d ' ')
  resta=0
  for id in $tentadas; do echo "$vivas" | grep -qx "$id" && resta=1; done
  (( resta == 0 )) && break
  /bin/sleep 0.1
done
for id in $tentadas; do
  if echo "$vivas" | grep -qx "$id"; then
    echo "janela $id NÃO fechou"
  else
    echo "janela $id fechada"
    fechadas=$((fechadas + 1))
  fi
done
echo "$fechadas janela(s) fechada(s)$( (( pulou )) && echo ', outras preservadas por segurarem servidor')"
