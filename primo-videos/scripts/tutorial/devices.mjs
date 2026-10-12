// Presets de aparelho do modo tutorial. O projeto pode acrescentar ou sobrescrever (video.aparelhos).
// dsf = pixels reais por px CSS. É o que dá resolução para o zoom da câmera: a tela entra no vídeo
// com ~684 px de largura no 9:16 e ~1344 px no 16:9, então DSF 3 no celular e DSF 2 no computador
// deixam dar zoom de ~1,7× e ~2,1× sem amolecer (medido: screencast a 52–60 qps nos dois,
// inclusive com backdrop-blur, no Chromium de headless novo com --force-device-scale-factor).
export const APARELHOS = {
  phone: { viewport: { width: 390, height: 844 }, dsf: 3, toque: true, formato: '9x16' },
  'phone-large': { viewport: { width: 430, height: 932 }, dsf: 3, toque: true, formato: '9x16' },
  'phone-small': { viewport: { width: 360, height: 780 }, dsf: 3, toque: true, formato: '9x16' },
  tablet: { viewport: { width: 820, height: 1180 }, dsf: 2, toque: true, formato: '4x5' },
  computer: { viewport: { width: 1440, height: 900 }, dsf: 2, toque: false, formato: '16x9' },
  'computer-hd': { viewport: { width: 1280, height: 800 }, dsf: 2, toque: false, formato: '16x9' },
}

export function aparelho(nome, extras = {}) {
  const a = { ...(APARELHOS[nome] || {}), ...(extras[nome] || {}) }
  if (!a.viewport) throw new Error(`unknown device: "${nome}". Known: ${Object.keys({ ...APARELHOS, ...extras }).join(', ')}`)
  return { nome, ...a }
}
