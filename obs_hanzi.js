/**
 * Módulo de Observações do Hanzi - Etimologia, Cultura e Memorização
 */
function obterObsHanziEmLote(listaPalavras) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  const prompt = `Você é um etimologista e professor de cultura chinesa.
  Abaixo enviarei um JSON com uma lista de palavras (Hanzi e Pinyin). Sua tarefa é gerar uma observação detalhada para cada palavra.

  ESTRUTURA OBRIGATÓRIA DA RESPOSTA:
  Você deve usar EXATAMENTE estes 4 blocos para cada palavra, separados por duplas quebras de linha (\\n\\n):

  🧩 Etimologia:
  [Explique a origem do caractere/radicais de forma literal e histórica, desmembrando os componentes se for uma palavra composta].

  🌟 Curiosidades Culturais:
  [Traga um contexto cultural chinês relevante sobre o uso dessa palavra no dia a dia ou na mentalidade chinesa].

  Comparativo com palavras similares:
  [Compare com outra palavra do HSK que os alunos costumam confundir, explicando a diferença exata de uso. Ex: 客人 vs 顾客].

  💡 Dica de Memorização:
  [Crie uma mnemônica visual ou lógica para ajudar a lembrar a palavra].

  REGRAS DE FORMATAÇÃO:
  1. Use "\\n\\n" para separar os parágrafos e os blocos. Nunca use tags HTML.
  2. Não use negrito (**) ou itálico (*) do Markdown, retorne texto limpo.
  
  DADOS DE ENTRADA:
  ${JSON.stringify(listaPalavras)}

  Retorne ESTRITAMENTE um array JSON no formato:
  [
    {
      "id_relativo": (manter exatamente o mesmo número recebido na entrada),
      "observacao": "🧩 Etimologia:\\nTexto...\\n\\n🌟 Curiosidades Culturais:\\nTexto...\\n\\nComparativo com palavras similares:\\nTexto...\\n\\n💡 Dica de Memorização:\\nTexto..."
    }
  ]`;

  const payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
      "response_mime_type": "application/json",
      "temperature": 0.2 // Um pouquinho de temperatura (0.2) para permitir boas conexões mnemônicas
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
      console.log("Erro na API de Obs. Hanzi: " + resposta.getContentText());
      return null;
    }
  } catch (e) {
    console.log("Erro no fetch de Obs. Hanzi: " + e.message);
    return null;
  }
}