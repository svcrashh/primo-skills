"""Um Cory de mentira para os testes simulados: o servidor HTTP de terminais que a skill usa dentro do
Cory, em 127.0.0.1 numa porta livre, com o contrato combinado com o Cory em 24/10/2026:

    POST   /terminais                {titulo, pasta, comando: [argv], env?, conversa?}  → 201 {id}
    GET    /terminais                                                                 → [{id, titulo, vivo}]
    GET    /terminais/<id>                                                            → {id, titulo, vivo, codigo?}
    POST   /terminais/<id>/escrever  {texto}                                          → 204
    DELETE /terminais/<id>           encerra e tira a aba                             → 204

Todas com "Authorization: Bearer <token>"; token errado dá 401. Como o do Cory (src/main/terminais/api.ts),
o terminal que saiu, ou cuja aba o dono fechou, continua na lista com vivo falso: só o DELETE o tira. Quem
roda o comando de cada terminal é o teste: rodar(id, corpo) devolve o processo, vivo(processo) diz se ele
roda e matar(processo) faz o que o Cory faz ao fechar a aba.
"""
import json
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class CoryFalso:
    def __init__(self, rodar, vivo, matar, token="token-do-cory"):
        self.rodar, self.vivo, self.matar, self.token = rodar, vivo, matar, token
        self.pedidos = []         # (método, caminho, Authorization, corpo), na ordem em que chegaram
        self.terminais = {}       # id → corpo do POST + "processo"
        self.recusar_post = False  # o POST responde 400, como se o contrato tivesse mudado do lado do Cory
        self.servidor = ThreadingHTTPServer(("127.0.0.1", 0), self.atendente())
        self.url = f"http://127.0.0.1:{self.servidor.server_port}"
        threading.Thread(target=self.servidor.serve_forever, daemon=True).start()

    def desligar(self):
        self.servidor.shutdown()
        self.servidor.server_close()

    def fechar_aba(self, tid):
        """O dono fechando a aba no Cory: o processo morre e o terminal fica na lista, com vivo falso."""
        self.matar(self.terminais[tid]["processo"])

    def de(self, metodo):
        return [p for p in self.pedidos if p[0] == metodo]

    def atendente(cory):
        class Atendente(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def responder(self, codigo, corpo=None):
                dados = b"" if corpo is None else json.dumps(corpo).encode()
                self.send_response(codigo)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                self.wfile.write(dados)

            def atender(self, metodo):
                tamanho = int(self.headers.get("Content-Length") or 0)
                corpo = json.loads(self.rfile.read(tamanho)) if tamanho else None
                cory.pedidos.append((metodo, self.path, self.headers.get("Authorization"), corpo))
                if self.headers.get("Authorization") != f"Bearer {cory.token}":
                    return self.responder(401, {"erro": "token recusado"})
                partes = self.path.strip("/").split("/")
                if partes[0] != "terminais":
                    return self.responder(404)
                if len(partes) == 1 and metodo == "GET":
                    return self.responder(200, [{"id": i, "titulo": t["titulo"], "vivo": cory.vivo(t["processo"])}
                                                for i, t in list(cory.terminais.items())])
                if len(partes) == 1 and metodo == "POST":
                    if cory.recusar_post:
                        return self.responder(400, {"erro": "pedido fora do contrato"})
                    tid = str(uuid.uuid4())
                    cory.terminais[tid] = {**corpo, "processo": cory.rodar(tid, corpo)}
                    return self.responder(201, {"id": tid})
                t = cory.terminais.get(partes[1])
                if not t:
                    return self.responder(404, {"erro": "terminal não existe"})
                if len(partes) == 2 and metodo == "GET":
                    return self.responder(200, {"id": partes[1], "titulo": t["titulo"], "vivo": cory.vivo(t["processo"])})
                if partes[2:] == ["escrever"] and metodo == "POST":
                    t.setdefault("escrito", []).append(corpo["texto"])
                    return self.responder(204)
                if len(partes) == 2 and metodo == "DELETE":
                    cory.matar(cory.terminais.pop(partes[1])["processo"])
                    return self.responder(204)
                self.responder(404)

            def do_GET(self):
                self.atender("GET")

            def do_POST(self):
                self.atender("POST")

            def do_DELETE(self):
                self.atender("DELETE")
        return Atendente
