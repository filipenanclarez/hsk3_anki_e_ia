/**
 * Módulo de Tradução em Lote - Restrito ao HSK 3.0 Nível 2
 */

// 1. Função que apenas MONTA o pacote da requisição
function montarRequestTraducao(listaPalavras) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  // COLOQUE O SEU MODELO AQUI (ex: gemini-1.5-flash-002 ou gemini-flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

 const prompt = `Você é um professor de Mandarim extremamente rigoroso, especialista no currículo do Novo HSK 3.0.
  Abaixo enviarei um JSON com uma lista de palavras. Sua tarefa é fornecer a tradução de cada uma delas, mas APENAS no contexto do Nível 2.

  REGRA DE QUANTIDADE (CRÍTICO):
  Estou a enviar exatamente ${listaPalavras.length} palavras. Você DEVE retornar um array JSON com EXATAMENTE ${listaPalavras.length} objetos. Não omita nenhuma palavra!

  REGRAS SEMÂNTICAS (MUITO IMPORTANTE):
  1. Foque no significado PRINCIPAL e mais canônico da palavra no nível 2. 
  2. Evite sinônimos soltos que se confundam com outras palavras do HSK.
  3. Se a palavra atua fortemente como mais de uma classe gramatical, traga ambas.

  REGRAS DE FORMATAÇÃO ESTRITA:
  1. Prefixos obrigatórios: Subs.:, Verbo:, Adj.:, Adv.:, Class.:, Prep.:, Num.:, Part.:
  2. CAPITALIZAÇÃO: A primeira letra de cada tradução deve ser SEMPRE maiúscula.
  3. QUEBRA DE LINHA: Se houver mais de uma classe gramatical, separe-as ESTRITAMENTE com o caractere de nova linha (\\n).
  4. Seja extremamente conciso.

  Exemplo Perfeito de Saída Esperada:
  - Para 爱: "Subs.: Amor\\nVerbo: Amar"
  
  DADOS DE ENTRADA:
  ${JSON.stringify(listaPalavras)}

  Retorne ESTRITAMENTE um array JSON no formato:
  [
    {
      "id_relativo": (manter exatamente o mesmo número recebido na entrada),
      "traducao": "Verbo: Dividir"
    }
  ]`;

  const payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": { 
      "response_mime_type": "application/json", 
      "temperature": 0.0,
      "maxOutputTokens": 8192 // Garante que a IA não corta a resposta a meio
    }
  };

  return {
    url: url,
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
}

function extrairJsonTraducao(respostaHttp) {
  if (respostaHttp.getResponseCode() !== 200) {
    console.log("Erro na API de Tradução: " + respostaHttp.getContentText());
    return null;
  }
  try {
    const json = JSON.parse(respostaHttp.getContentText());
    const textoSaida = json.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    return JSON.parse(textoSaida);
  } catch (e) {
    console.log("Erro no parse da Tradução: " + e.message);
    return null;
  }
}