const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
// Corrigi aqui para "gemini-1.5-flash-latest" para evitar aquele erro de modelo não encontrado
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function gerarPinyinNumerico() {
  const inicio = new Date();
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5; 
  
  // 1. Pegamos o bloco inteiro de uma vez (leitura otimizada)
  // Lemos a partir da Coluna C (índice 3), tamanho 4 colunas: C, D, E, F
  const intervaloDados = aba.getRange(linhaInicial, 3, tamanhoDoLote, 4); 
  const valores = intervaloDados.getValues();
  
  let lotePinyin = [];
  let indicesPinyin = [];
  
  let loteTraducao = [];

  for (let i = 0; i < valores.length; i++) {
    let hanzi = valores[i][0];        // Coluna C
    let pinyinAcento = valores[i][1]; // Coluna D
    let pinyinExistente = valores[i][2]; // Coluna E
    let traducaoExistente = valores[i][3]; // Coluna F
    
    // Se não tiver Hanzi nem Pinyin com acento, a linha está vazia, ignora.
    if (!hanzi || !pinyinAcento) continue; 
    
    // Fila do Pinyin Numérico
    if (pinyinExistente === "") {
      lotePinyin.push(pinyinAcento);
      indicesPinyin.push(i); // Guarda a posição relativa
    }
    
    // Fila da Tradução HSK 2
    if (traducaoExistente === "") {
      loteTraducao.push({
        id_relativo: i,
        hanzi: hanzi,
        pinyin: pinyinAcento
      });
    }
  }
  
  // --- 2. EXECUTA E GRAVA O PINYIN NUMÉRICO ---
  if (lotePinyin.length > 0) {
    console.log(`Enviando ${lotePinyin.length} itens para Pinyin...`);
    let arrayDeResultados = chamarIAEmLote(lotePinyin);
    
    if (arrayDeResultados && arrayDeResultados.length === lotePinyin.length) {
      for (let j = 0; j < arrayDeResultados.length; j++) {
         let pinyinFinal = formatarRegex(arrayDeResultados[j]);
         let indiceNoBloco = indicesPinyin[j];
         valores[indiceNoBloco][2] = pinyinFinal; // Atualiza a matriz (Coluna E)
      }
      
      // DESPEJO ÚNICO NA COLUNA E
      const matrizPinyin = valores.map(linha => [linha[2]]);
      aba.getRange(linhaInicial, 5, tamanhoDoLote, 1).setValues(matrizPinyin);
    }
  }

  // --- 3. EXECUTA E GRAVA A TRADUÇÃO HSK 2 ---
  if (loteTraducao.length > 0) {
    console.log(`Enviando ${loteTraducao.length} itens para Tradução...`);
    let resultadosTraducao = obterTraducoesEmLoteHSK2(loteTraducao);
    
    if (resultadosTraducao) {
      for (let k = 0; k < resultadosTraducao.length; k++) {
         let item = resultadosTraducao[k];
         let indiceNoBloco = item.id_relativo;
         valores[indiceNoBloco][3] = item.traducao; // Atualiza a matriz (Coluna F)
      }
      
      // DESPEJO ÚNICO NA COLUNA F
      const matrizTraducao = valores.map(linha => [linha[3]]);
      aba.getRange(linhaInicial, 6, tamanhoDoLote, 1).setValues(matrizTraducao);
    }
  }

  const fim = new Date();
  const tempoTotalSegundos = (fim - inicio) / 1000;
  
  // Nota: Deixei a célula B1 aqui como você tinha no seu código original, 
  // mas lembre-se que se a Coluna B for a sua chave de IDs, isso vai sobrescrever o cabeçalho.
  aba.getRange("B1").setValue(`Última execução: ${tempoTotalSegundos.toFixed(2)}s`);
  console.log(`Lote finalizado em ${tempoTotalSegundos.toFixed(2)}s`);
}

// --- FUNÇÕES DE APOIO ---

function chamarIAEmLote(listaDeTextos) {
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
    
    const jsonLimpo = saidaBruta.replace(/```json|```/g, "").trim();
    const resultadoFinal = JSON.parse(jsonLimpo);
    
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

function formatarRegex(texto) {
    if (!texto) return "";
    return texto.replace(/(\d)(?=[a-zA-Z])/g, "$1 ").replace(/\s+/g, " ").trim();
}