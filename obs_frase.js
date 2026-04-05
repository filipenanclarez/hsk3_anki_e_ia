/**
 * Módulo de Observações da Frase - Agente Especializado
 */

function montarRequestObsFrase(listaFrases) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  const prompt = `Você é um professor de Mandarim especialista no currículo do Novo HSK 3.0, ensinando para estudantes brasileiros.
  Abaixo enviarei um JSON com uma lista de frases em Hanzi. Sua tarefa é gerar uma análise detalhada para cada frase.

  REGRAS DE LINGUAGEM E TOM (MUITO IMPORTANTE):
  1. Use EXCLUSIVAMENTE o Português do Brasil (pt-BR) moderno, cotidiano, direto e simples.
  2. NÃO use termos acadêmicos desnecessários, palavras rebuscadas ou explicações verbosas.
  3. Seja didático e vá direto ao ponto.
  4. REGRA DO HANZI/PINYIN: SEMPRE que mencionar um caractere chinês no meio da explicação, escreva o Hanzi seguido do Pinyin com acentos de tom corretos entre parênteses.
     - Exemplo ERRADO: O caractere shi significa "ser".
     - Exemplo CORRETO: O caractere 是 (shì) significa "ser".

  ESTRUTURA DA RESPOSTA:
  Preencha os blocos abaixo, SEMPRE separados por dupla quebra de linha (\\n\\n):

  🔍 Quebra da Frase:
  [Liste cada parte em uma linha separada por \\n, no formato:]
  [Hanzi (Pinyin) → tradução e função gramatical.]

  ✍️ Gramática:
  [Estrutura gramatical da frase. Padrões importantes, partículas, ordem das palavras.]

  🌟 Cultura:
  [Contexto cultural relevante. OMITA se não houver nada genuinamente relevante.]

  💡 Dica:
  [Variação da frase, pergunta relacionada ou uso prático. OMITA se não houver uma dica realmente boa.]

  📝 Observações:
  [Nuances gramaticais ou armadilhas comuns para brasileiros. OMITA se a frase for simples e direta.]

  REGRAS DE FORMATAÇÃO:
  1. Use "\\n\\n" para separar blocos e "\\n" para separar linhas dentro da Quebra da Frase.
  2. Sem negrito (**) ou itálico (*). Texto limpo.
  3. Sem tags HTML.

  DADOS DE ENTRADA:
  ${JSON.stringify(listaFrases)}
  
  Retorne ESTRITAMENTE um array JSON no formato:
  [{ "id_relativo": 0, "analise": "🔍 Quebra da Frase:\n..." }]`;

  const payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
      "response_mime_type": "application/json",
      "temperature": 0.2,
      "maxOutputTokens": 8192,
      "thinkingConfig": { "thinkingBudget": 1024 }
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

function extrairJsonObsFrase(respostaHttp) {
  if (respostaHttp.getResponseCode() !== 200) {
    console.log("Erro na API de Obs. Frase: " + respostaHttp.getResponseCode() + " - " + respostaHttp.getContentText());
    return null;
  }
  try {
    const json = JSON.parse(respostaHttp.getContentText());
    const parts = json.candidates[0].content.parts;

    console.log(`   Obs. Frase: ${parts.length} part(s) recebido(s). Tipos: ${parts.map((p, i) => `[${i}] thought=${!!p.thought}, hasText=${!!p.text}`).join(", ")}`);

    const textPart = parts.find(p => !p.thought && p.text);
    if (!textPart) {
      console.log("   ⚠️ Nenhum part de texto encontrado. Resposta completa: " + JSON.stringify(parts).substring(0, 5000));
      return null;
    }

    console.log(`   ✅ Text part encontrado. Preview: ${textPart.text.substring(0, 5000)}`);
    const textoSaida = textPart.text.replace(/```json|```/g, "").trim();
    return JSON.parse(textoSaida);
  } catch (e) {
    console.log("Erro no parse da Obs. Frase: " + e.message);
    return null;
  }
}