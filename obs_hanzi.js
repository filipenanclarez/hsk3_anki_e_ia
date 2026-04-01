/**
 * Módulo de Observações do Hanzi - Etimologia, Cultura e Memorização
 */

// 1. Função que apenas MONTA o pacote da requisição
function montarRequestObsHanzi(listaPalavras) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  // COLOQUE O SEU MODELO AQUI
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  const prompt = `Você é um etimologista e professor de cultura chinesa.
  Abaixo enviarei um JSON com uma lista de palavras (Hanzi e Pinyin). Sua tarefa é gerar uma observação detalhada para cada palavra.

  REGRA DE QUANTIDADE (CRÍTICO):
  Estou enviando exatamente ${listaPalavras.length} palavras. Você DEVE processar todas e retornar um array JSON com EXATAMENTE ${listaPalavras.length} objetos. Não pare até terminar todas!

  REGRAS DE LINGUAGEM E TOM (MUITO IMPORTANTE):
  1. Use EXCLUSIVAMENTE o Português do Brasil (pt-BR) moderno, cotidiano, direto e simples.
  2. NÃO use termos acadêmicos, literatura poética, palavras rebuscadas ou traduções literais estranhas.
  3. Seja didático. Exemplo: NUNCA use o jargão "piedade filial" (que não faz sentido no dia a dia brasileiro). Em vez disso, explique de forma clara como "respeito profundo aos pais e antepassados".
  4. Evite textos verbosos. Vá direto ao ponto com vocabulário comum.
  
  ESTRUTURA DA RESPOSTA:
  Você deve estruturar a resposta usando os blocos abaixo, sempre separados por duplas quebras de linha (\\n\\n):

  Blocos OBRIGATÓRIOS:
  🧩 Etimologia:
  [Explicação clara da origem dos caracteres/radicais]

  🌟 Curiosidades Culturais:
  [Contexto cultural chinês relevante sobre o uso da palavra]

  Blocos OPCIONAIS (Use APENAS se houver relevância real. Não "encha linguiça"):
  ⚖️ Similaridades:
  [Busque ATIVAMENTE no vocabulário completo do HSK3.0 nível 2 (novo padrão, 
  772 palavras) por palavras com sobreposição semântica, mesmo que parcial.
  Considere: sinônimos, verbos com função parecida, substantivos do mesmo 
  campo semântico. OMITA este bloco APENAS se após essa busca não encontrar 
  nenhuma palavra que cause confusão real.].

  💡 Dica de Memorização:
  [SÓ INCLUA se você tiver uma mnemônica visual ou lógica genuinamente inteligente e útil. Se for simples, OMITA ESTE BLOCO].

  REGRAS DE FORMATAÇÃO (SIGA À RISCA):
  1. Use "\\n\\n" para separar os parágrafos e os blocos. Nunca use tags HTML.
  2. Não use negrito (**) ou itálico (*) do Markdown, retorne texto limpo.
  3. REGRA DO HANZI/PINYIN: SEMPRE que mencionar um caractere chinês, palavra ou radical no meio da sua explicação, você DEVE escrever o Hanzi seguido do Pinyin com os acentos de tom corretos entre parênteses.
     - Exemplo ERRADO: Combinacao de ai (amor) e hao (bom). O radical nu (mulher)...
     - Exemplo CORRETO: Combinação de 爱 (ài) (amor) e 好 (hào) (bom). O radical 女 (nǚ) (mulher)...
  
  DADOS DE ENTRADA:
  ${JSON.stringify(listaPalavras)}

  Retorne ESTRITAMENTE um array JSON no formato:
  [
    {
      "id_relativo": (manter exatamente o mesmo número recebido na entrada),
      "observacao": "🧩 Etimologia:\\nTexto...\\n\\n🌟 Curiosidades Culturais:\\nTexto..."
    }
  ]`;

  const payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": { 
      "response_mime_type": "application/json", 
      "temperature": 0.2,
      "maxOutputTokens": 8192,
      "thinkingConfig": { "thinkingBudget": 0 } // ← desliga o thinking 
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

function extrairJsonObsHanzi(respostaHttp) {
  if (respostaHttp.getResponseCode() !== 200) {
    console.log("Erro na API de Obs. Hanzi: " + respostaHttp.getContentText());
    return null;
  }
  try {
    const json = JSON.parse(respostaHttp.getContentText());
    const textoSaida = json.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    return JSON.parse(textoSaida);
  } catch (e) {
    console.log("Erro no parse da Obs. Hanzi: " + e.message);
    return null;
  }
}