// Removemos a string fixa e lemos das propriedades do script
const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function gerarPinyinNumerico() {
  const inicio = new Date();
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5; 
  
  // 1. Pegamos o bloco inteiro de uma vez (leitura otimizada)
  const intervaloDados = aba.getRange(linhaInicial, 4, tamanhoDoLote, 2); // Colunas D e E
  const valoresD_E = intervaloDados.getValues();
  
  let loteDeTextos = [];
  let indicesParaAtualizar = [];

  for (let i = 0; i < valoresD_E.length; i++) {
    let pinyinComAcento = valoresD_E[i][0]; // Coluna D
    let pinyinExistente = valoresD_E[i][1]; // Coluna E
    
    if (pinyinComAcento !== "" && pinyinExistente === "") {
      loteDeTextos.push(pinyinComAcento);
      indicesParaAtualizar.push(i); // Guardamos a posição relativa no array
    }
  }
  
  if (loteDeTextos.length > 0) {
    console.log(`Enviando ${loteDeTextos.length} itens via API...`);
    let arrayDeResultados = chamarIAEmLote(loteDeTextos);
    
    if (arrayDeResultados && arrayDeResultados.length === loteDeTextos.length) {
      // 2. Preparamos a matriz de atualização
      // O setValues exige um array de arrays: [[valor1], [valor2], ...]
      for (let j = 0; j < arrayDeResultados.length; j++) {
         let pinyinFinal = formatarRegex(arrayDeResultados[j]);
         let indiceNoBloco = indicesParaAtualizar[j];
         
         // Atualizamos apenas o valor na nossa variável local (memória)
         valoresD_E[indiceNoBloco][1] = pinyinFinal; 
      }
      
      // 3. DESPEJO ÚNICO (Escrita otimizada)
      // Pegamos apenas a coluna E do nosso bloco e escrevemos de uma vez
      const matrizEscrita = valoresD_E.map(linha => [linha[1]]);
      aba.getRange(linhaInicial, 5, tamanhoDoLote, 1).setValues(matrizEscrita);
    }
  }

  const fim = new Date();
  const tempoTotalSegundos = (fim - inicio) / 1000;
  aba.getRange("B1").setValue(`Última execução: ${tempoTotalSegundos.toFixed(2)}s`);
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