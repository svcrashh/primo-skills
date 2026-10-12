// O formato da resposta do crítico: extrair o JSON do texto e conferir as regras. node --test tests/critic-response.test.mjs (sem rede)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { extrairJson, validarResposta, tabela, MAX_DEFEITOS } from '../scripts/critic/response.mjs'

const defeito = (o = {}) => ({ segundo: 12.5, item: 'R1', gravidade: 'severe', o_que: 'a tela entra cortada', corrigir: 'mostrar o aparelho inteiro antes do zoom', ...o })
const boa = (o = {}) => ({ veredito: 'reject', resumo: 'tela cortada', defeitos: [defeito()], ...o })

describe('extrairJson', () => {
  test('JSON puro', () => assert.deepEqual(extrairJson('{"a":1}'), { a: 1 }))
  test('com cerca de código e conversa em volta', () => assert.deepEqual(extrairJson('Segue:\n```json\n{"a":{"b":[1,2]}}\n```\nfim'), { a: { b: [1, 2] } }))
  test('sem cerca, com texto antes e depois', () => assert.deepEqual(extrairJson('Here it is {"veredito":"approve","defeitos":[]} ok'), { veredito: 'approve', defeitos: [] }))
  test('chave dentro de texto não confunde', () => assert.deepEqual(extrairJson('{"o_que":"o botão {Sacar} some"}'), { o_que: 'o botão {Sacar} some' }))
  test('sem JSON dá erro', () => assert.throws(() => extrairJson('não sei'), /has no JSON/))
  test('JSON quebrado dá erro', () => assert.throws(() => extrairJson('{"a":'), /has no JSON/))
})

describe('validarResposta', () => {
  test('reprova com um defeito grave passa', () => {
    const v = validarResposta(boa(), 49.6)
    assert.equal(v.ok, true, v.erros.join('; '))
    assert.equal(v.resposta.defeitos[0].segundo, 12.5)
  })
  test('o veredito e a gravidade saem normalizados para os valores do critica.json (reprova, grave)', () => {
    const v = validarResposta(boa(), 49.6)
    assert.equal(v.resposta.veredito, 'reprova')
    assert.equal(v.resposta.defeitos[0].gravidade, 'grave')
  })
  test('o formato antigo, em português (aprova/reprova, grave/leve), continua valendo', () => {
    const r = validarResposta({ veredito: 'reprova', defeitos: [defeito({ gravidade: 'grave' }), defeito({ gravidade: 'leve' })] }, 30)
    assert.equal(r.ok, true, r.erros.join('; '))
    assert.deepEqual([r.resposta.veredito, ...r.resposta.defeitos.map((d) => d.gravidade)], ['reprova', 'grave', 'leve'])
    const a = validarResposta({ veredito: 'aprova', defeitos: [defeito({ gravidade: 'leve' })] }, 30)
    assert.equal(a.ok, true, a.erros.join('; '))
    assert.equal(a.resposta.veredito, 'aprova')
  })
  test('aprova sem defeitos passa', () => assert.equal(validarResposta({ veredito: 'approve', defeitos: [] }, 30).ok, true))
  test('aprova com ressalva leve passa', () => assert.equal(validarResposta({ veredito: 'approve', defeitos: [defeito({ gravidade: 'minor' })] }, 30).ok, true))
  test('aceita maiúsculas e espaços no veredito, na gravidade e no item', () => {
    const v = validarResposta({ veredito: ' Reject ', defeitos: [defeito({ item: 'r11', gravidade: 'SEVERE' })] }, 30)
    assert.equal(v.ok, true)
    assert.equal(v.resposta.defeitos[0].item, 'R11')
  })
  test(`mais de ${MAX_DEFEITOS} defeitos não passa`, () => {
    const v = validarResposta(boa({ defeitos: [defeito(), defeito(), defeito(), defeito()] }), 49.6)
    assert.equal(v.ok, false)
    assert.match(v.erros.join(), /maximum is 3/)
    assert.equal(v.resposta.defeitos.length, 3)
  })
  test('veredito inválido não passa', () => assert.match(validarResposta(boa({ veredito: 'talvez' }), 30).erros.join(), /veredito/))
  test('reprovar sem defeito grave não passa', () => assert.match(validarResposta(boa({ defeitos: [defeito({ gravidade: 'minor' })] }), 30).erros.join(), /rejected without any severe defect/))
  test('aprovar com defeito grave não passa', () => assert.match(validarResposta(boa({ veredito: 'approve' }), 30).erros.join(), /approved with a severe defect/))
  test('segundo fora do vídeo não passa', () => {
    assert.match(validarResposta(boa({ defeitos: [defeito({ segundo: 80 })] }), 49.6).erros.join(), /segundo/)
    assert.match(validarResposta(boa({ defeitos: [defeito({ segundo: -1 })] }), 49.6).erros.join(), /segundo/)
    assert.match(validarResposta(boa({ defeitos: [defeito({ segundo: 'doze' })] }), 49.6).erros.join(), /segundo/)
  })
  test('item fora da régua não passa', () => assert.match(validarResposta(boa({ defeitos: [defeito({ item: 'R17' })] }), 30).erros.join(), /item.*R1 to R16/))
  test('os itens da tese (R14 a R16) são da régua', () => {
    for (const item of ['R14', 'R15', 'R16']) assert.equal(validarResposta(boa({ defeitos: [defeito({ item })] }), 30).ok, true, item)
  })
  test('defeito sem "o_que" ou sem "corrigir" não passa', () => {
    assert.match(validarResposta(boa({ defeitos: [defeito({ o_que: '' })] }), 30).erros.join(), /o_que/)
    assert.match(validarResposta(boa({ defeitos: [defeito({ corrigir: ' ' })] }), 30).erros.join(), /corrigir/)
  })
  test('defeitos que não é lista não passa', () => assert.match(validarResposta({ veredito: 'approve', defeitos: 'nenhum' }, 30).erros.join(), /must be a list/))
  test('não-objeto não passa', () => assert.equal(validarResposta(null, 30).ok, false))
})

test('tabela mostra o veredito, o segundo com ponto e o que fazer', () => {
  const t = tabela(validarResposta(boa(), 49.6).resposta, 'x.mp4')
  assert.match(t, /^REJECTED · x\.mp4/)
  assert.match(t, /12\.5 s · R1 · severe/)
  assert.match(t, /→ mostrar o aparelho inteiro/)
})
