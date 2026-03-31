// Removemos a string fixa e lemos das propriedades do script
const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function gerarPinyinNumerico() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5; 
  
  const intervaloPinyin = aba.getRange(linhaInicial, 4, tamanhoDoLote, 1);
  const valoresPinyin = intervaloPinyin.getValues();
  
  let loteDeTextos = [];
  let linhasDestino = [];

  // 1. Coleta todas as palavras válidas sem fazer requisições
  for (let i = 0; i < valoresPinyin.length; i++) {
    let pinyinComAcento = valoresPinyin[i][0];
    let linhaDestino = linhaInicial + i;
    let celulaDestino = aba.getRange(linhaDestino, 5);
    
    if (pinyinComAcento !== "" && celulaDestino.getValue() === "") {
      loteDeTextos.push(pinyinComAcento);
      linhasDestino.push(linhaDestino); // Guarda o endereço exato para devolver depois
    }
  }
  
  if (loteDeTextos.length === 0) return; // Nada a fazer
  
  // 2. Faz UMA ÚNICA chamada para a API com o lote inteiro
  console.log(`Enviando ${loteDeTextos.length} itens de uma vez...`);
  let arrayDeResultados = chamarIAEmLote(loteDeTextos);
  
  // 3. Despeja os resultados de volta na planilha
  if (arrayDeResultados && arrayDeResultados.length === loteDeTextos.length) {
    for (let j = 0; j < arrayDeResultados.length; j++) {
       let pinyinFinal = formatarRegex(arrayDeResultados[j]);
       aba.getRange(linhasDestino[j], 5).setValue(pinyinFinal);
    }
    console.log("Lote concluído em tempo recorde.");
  } else {
    console.log("Erro: Falha na devolução do lote pela API.");
  }
}

function chamarIAEmLote(listaDeTextos) {
  // O prompt agora exige estritamente um Array JSON de volta
  const prompt = `Converta uma lista de Pinyin com acentos para Pinyin numérico.
  Regras: 1º=1, 2º=2, 3º=3, 4º=4. Tom neutro = sem número (mā ma -> ma1 ma). Separe sílabas com espaço.
  Você receberá um array JSON de strings. Você DEVE retornar ESTRITAMENTE um array JSON de strings com os resultados, exatamente na mesma ordem.
  Entrada: ${JSON.stringify(listaDeTextos)}`;

  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": { "temperature": 0.0 }
  };

  const opcoes = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

try {
    const resposta = UrlFetchApp.fetch(API_URL, opcoes);
    const textoResposta = resposta.getContentText();
    const codigoStatus = resposta.getResponseCode();
    
    if (codigoStatus !== 200) {
      console.log(`Erro HTTP ${codigoStatus}: ${textoResposta}`);
      return null;
    }

    const json = JSON.parse(textoResposta);
    const saidaBruta = json.candidates[0].content.parts[0].text;
    
    // LOG DE DEBUG - MUITO IMPORTANTE AGORA:
    console.log("CONTEÚDO BRUTO VINDO DA IA:");
    console.log(saidaBruta);

    // Limpeza de Markdown (caso ela mande com ```json)
    const jsonLimpo = saidaBruta.replace(/```json|```/g, "").trim();
    
    const resultadoFinal = JSON.parse(jsonLimpo);
    
    // Verifica se o que voltou é realmente um Array
    if (Array.isArray(resultadoFinal)) {
      return resultadoFinal;
    } else {
      console.log("A IA não devolveu um Array. Devolveu: " + typeof resultadoFinal);
      return null;
    }
    
  } catch (e) {
    console.log("Erro no Parse do Lote: " + e.message);
    return null;
  }
}

// Nossa blindagem para garantir que a IA não pule os espaços
function formatarRegex(texto) {
    if (!texto) return "";
    return texto.replace(/(\d)(?=[a-zA-Z])/g, "$1 ").replace(/\s+/g, " ").trim();
}