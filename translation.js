/**
 * Módulo de Tradução Restrita ao HSK 3.0
 */

function obterTraducaoHSK2(hanzi, pinyin) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

  const prompt = `Você é um professor de Mandarim especialista no currículo do Novo HSK 3.0.
  Sua tarefa é fornecer a tradução da palavra "${hanzi}" (${pinyin}).

  REGRA DE OURO (ESCOPO RESTRITO):
  Forneça APENAS o significado e a classe gramatical que são introduzidos e exigidos no Nível 2 do Novo HSK 3.0. 
  IGNORE completamente significados avançados que serão ensinados nos níveis 3 a 9, ou significados básicos do nível 1 se a palavra estiver assumindo uma nova função no nível 2.
  (Exemplo de escopo: Se a palavra "分" no nível 2 atua como Verbo, traduza apenas como Verbo, ignorando sua função de classificador do nível 1).

  REGRAS DE FORMATAÇÃO:
  1. Use abreviações para a classe gramatical: Subs.:, Verbo:, Adj.:, Adv.:, Class.:, Prep.:, etc.
  2. Se houver mais de uma classe gramatical DENTRO DO NÍVEL 2, separe por quebra de linha.
  3. Seja extremamente conciso.
  4. Retorne APENAS o texto final, sem aspas, sem markdown, sem explicações.

  Exemplo de saída esperada:
  Subs.: Meio quilo
  Class.: Quantidade pesada
  `;

  const payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
      "temperature": 0.1 // Temperatura super baixa para evitar alucinações e manter a resposta técnica
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
    const json = JSON.parse(resposta.getContentText());
    
    if (resposta.getResponseCode() === 200) {
      // Retorna o texto limpo, removendo quebras de linha extras no final
      return json.candidates[0].content.parts[0].text.trim();
    } else {
      console.log("Erro na API de Tradução: " + resposta.getContentText());
      return "Erro na tradução";
    }
  } catch (e) {
    console.log("Erro no fetch de Tradução: " + e.message);
    return "Erro no fetch";
  }
}