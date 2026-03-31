/**
 * Módulo de Tradução em Lote - Restrito ao HSK 3.0 Nível 2
 */
function obterTraducoesEmLoteHSK2(listaPalavras) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  // Usando o gemini-1.5-flash-latest para garantir estabilidade
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  const prompt = `Você é um professor de Mandarim especialista no currículo do Novo HSK 3.0.
  Abaixo enviarei um JSON com uma lista de palavras. Sua tarefa é fornecer a tradução EXATA de cada uma delas, mas APENAS no contexto do Nível 2.

  REGRA DE OURO (ESCOPO RESTRITO):
  Forneça APENAS o significado e a classe gramatical exigidos no Nível 2 do Novo HSK 3.0. 
  IGNORE significados avançados ou básicos de outros níveis se a palavra tiver uma função específica no nível 2.

  REGRAS DE FORMATAÇÃO:
  1. Use abreviações: Subs.:, Verbo:, Adj.:, Adv.:, Class.:, Prep.:
  2. Seja extremamente conciso.
  
  DADOS DE ENTRADA:
  ${JSON.stringify(listaPalavras)}

  Retorne ESTRITAMENTE um array JSON no formato:
  [
    {
      "id_relativo": (manter exatamente o mesmo número recebido na entrada),
      "traducao": "Verbo: dividir"
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