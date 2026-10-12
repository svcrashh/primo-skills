// Ajudante do macOS para gravar a janela de um programa. Compilado uma vez pelo record-window.mjs.
//   janela permissao                 → {"tela":bool,"acessibilidade":bool}
//   janela listar                    → janelas visíveis [{id,pid,dono,titulo,x,y,w,h,camada}]
//   janela clicar <x> <y>            → clique do mouse no ponto (coordenada global, em pontos)
import Foundation
import CoreGraphics
import ApplicationServices

let a = CommandLine.arguments
func json(_ o: Any) { let d = try! JSONSerialization.data(withJSONObject: o, options: [.sortedKeys]); print(String(data: d, encoding: .utf8)!) }
guard a.count > 1 else { FileHandle.standardError.write("usage: janela permissao|listar|clicar x y\n".data(using: .utf8)!); exit(1) }
switch a[1] {
case "permissao":
  json(["tela": CGPreflightScreenCaptureAccess(), "acessibilidade": AXIsProcessTrusted()])
case "listar":
  let lista = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
  json(lista.compactMap { w -> [String: Any]? in
    guard let id = w[kCGWindowNumber as String] as? Int, let pid = w[kCGWindowOwnerPID as String] as? Int, let b = w[kCGWindowBounds as String] as? [String: Double] else { return nil }
    return ["id": id, "pid": pid, "dono": w[kCGWindowOwnerName as String] as? String ?? "", "titulo": w[kCGWindowName as String] as? String ?? "",
            "x": b["X"] ?? 0, "y": b["Y"] ?? 0, "w": b["Width"] ?? 0, "h": b["Height"] ?? 0, "camada": w[kCGWindowLayer as String] as? Int ?? 0]
  })
case "clicar":
  guard a.count > 3, let x = Double(a[2]), let y = Double(a[3]) else { exit(1) }
  let p = CGPoint(x: x, y: y)
  for (tipo, botao) in [(CGEventType.mouseMoved, CGMouseButton.left), (.leftMouseDown, .left), (.leftMouseUp, .left)] {
    CGEvent(mouseEventSource: nil, mouseType: tipo, mouseCursorPosition: p, mouseButton: botao)?.post(tap: .cghidEventTap)
    usleep(60_000)
  }
default: exit(1)
}
