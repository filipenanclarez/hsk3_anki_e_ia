/**
 * Módulo de Tradução em Lote - Restrito ao HSK 3.0 Nível 2
 */
function obterTraducoesEmLoteHSK2(listaPalavras) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  // Usando o gemini-1.5-flash-latest para garantir estabilidade
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

const prompt = `Você é um professor de Mandarim extremamente rigoroso, especialista no currículo do Novo HSK 3.0.
  Abaixo enviarei um JSON com uma lista de palavras. Sua tarefa é fornecer a tradução de cada uma delas, mas APENAS no contexto do Nível 2.

  REGRAS SEMÂNTICAS (MUITO IMPORTANTE):
  1. Foque no significado PRINCIPAL e mais canônico da palavra no nível 2. 
  2. Evite sinônimos soltos que se confundam com outras palavras do HSK (Ex: para "爱", traga "Amor/Amar", e NÃO "gostar", para não confundir com "喜欢". Para "爱好", o foco principal é "Hobby").
  3. Se a palavra atua fortemente como mais de uma classe gramatical (ex: Substantivo e Verbo), traga ambas.

  REGRAS DE FORMATAÇÃO ESTRITA:
  1. Prefixos obrigatórios: Subs.:, Verbo:, Adj.:, Adv.:, Class.:, Prep.:, Num.:, Part.:
  2. CAPITALIZAÇÃO: A primeira letra de cada tradução deve ser SEMPRE maiúscula. (Ex: "Amor", não "amor").
 3. QUEBRA DE LINHA: Se houver mais de uma classe gramatical para a palavra, separe-as ESTRITAMENTE com o caractere de nova linha (\\n). NUNCA use ponto e vírgula (;), vírgula ou tags HTML como <br>.
  4. Seja extremamente conciso.

  Exemplo Perfeito de Saída Esperada:
  - Para 爱: "Subs.: Amor\\nVerbo: Amar"
  - Para 爱好: "Subs.: Hobby\\n"
  - Para 八: "Num.: Oito"
  - Para 吧: "Part.: Partícula de sugestão"
  
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
      "temperature": 0.1 
    }
  };

  const opcoes = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const resposta = UrlFetchApp.fetch(url, opcoes);
    if (resposta.getResponseCode() === 200) {
      const json = JSON.parse(resposta.getContentText());
      const textoSaida = json.candidates[0].content.parts[0].text;
      return JSON.parse(textoSaida);
    } else {
      console.log("Erro na API de Tradução: " + resposta.getContentText());
      return null;
    }
  } catch (e) {
    console.log("Erro no fetch de Tradução: " + e.message);
    return null;
  }
}