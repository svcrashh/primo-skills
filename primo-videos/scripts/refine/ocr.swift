// OCR com o Vision do macOS: uma linha JSON por imagem, {arquivo,w,h,linhas:[{texto,conf,x,y,w,h,contraste}]},
// em px com origem no topo. contraste = p95 − p5 da luminância na caixa (texto esmaecido de propósito fica
// abaixo de ~80; texto opaco passa de 120). O video.mjs compila com `swiftc -O` e guarda o binário num cache.
//   ocr <img.png> [<img.png> …]
import Foundation
import Vision
import ImageIO

func json(_ v: Any) -> String {
  let d = try! JSONSerialization.data(withJSONObject: v, options: [])
  return String(data: d, encoding: .utf8)!
}

/** Luminância 8 bits da imagem inteira, linha 0 em cima. */
func cinza(_ img: CGImage) -> [UInt8]? {
  let w = img.width, h = img.height
  var px = [UInt8](repeating: 0, count: w * h)
  let ok = px.withUnsafeMutableBytes { buf -> Bool in
    guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                              space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    return true
  }
  return ok ? px : nil
}

func contraste(_ px: [UInt8], _ W: Int, _ H: Int, _ x: Int, _ y: Int, _ w: Int, _ h: Int) -> Int? {
  let x0 = max(0, x), y0 = max(0, y), x1 = min(W, x + w), y1 = min(H, y + h)
  if x1 - x0 < 2 || y1 - y0 < 2 { return nil }
  var hist = [Int](repeating: 0, count: 256), n = 0
  for yy in y0..<y1 { for xx in x0..<x1 { hist[Int(px[yy * W + xx])] += 1; n += 1 } }
  func p(_ f: Double) -> Int { var s = 0; for v in 0..<256 { s += hist[v]; if Double(s) >= f * Double(n) { return v } }; return 255 }
  return p(0.95) - p(0.05)
}

for arq in CommandLine.arguments.dropFirst() {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: arq) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    print(json(["arquivo": arq, "erro": "could not open the image"]))
    continue
  }
  let W = Double(img.width), H = Double(img.height)
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["pt-BR", "en-US"]
  req.usesLanguageCorrection = false
  req.minimumTextHeight = 0
  var linhas: [[String: Any]] = []
  let px = cinza(img)
  do {
    try VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    for o in req.results ?? [] {
      guard let c = o.topCandidates(1).first else { continue }
      // o boundingBox vem normalizado e com origem embaixo
      let b = o.boundingBox
      let x = (b.minX * W).rounded(), y = ((1 - b.maxY) * H).rounded(), w = (b.width * W).rounded(), h = (b.height * H).rounded()
      var l: [String: Any] = ["texto": c.string, "conf": (Double(c.confidence) * 100).rounded() / 100, "x": x, "y": y, "w": w, "h": h]
      if let px = px, let k = contraste(px, img.width, img.height, Int(x), Int(y), Int(w), Int(h)) { l["contraste"] = k }
      linhas.append(l)
    }
    print(json(["arquivo": arq, "w": W, "h": H, "linhas": linhas]))
  } catch {
    print(json(["arquivo": arq, "w": W, "h": H, "erro": "\(error)"]))
  }
  fflush(stdout)
}
