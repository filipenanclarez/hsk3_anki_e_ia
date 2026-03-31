const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function gerarPinyinNumerico() {
  const inicio = new Date();
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5; 
  
  // Lemos a partir da Coluna C (3), tamanho 6 colunas: C, D, E, F, G, H
  const COLUNA_INICIAL = 3; 
  const QTD_COLUNAS = 6; 
  
  const intervaloDados = aba.getRange(linhaInicial, COLUNA_INICIAL, tamanhoDoLote, QTD_COLUNAS); 
  const valores = intervaloDados.getValues();
  
  let lotePinyin = [];
  let indicesPinyin = [];
  let loteTraducao = [];
  let loteObsHanzi = [];

  for (let i = 0; i < valores.length; i++) {
    let hanzi = valores[i][0];          // Coluna C
    let pinyinAcento = valores[i][1];   // Coluna D
    let pinyinExistente = valores[i][2]; // Coluna E
    let traducaoExistente = valores[i][3]; // Coluna F
    // valores[i][4] é a Coluna G (sua formatação particular, ignoramos)
    let obsExistente = valores[i][5];   // Coluna H
    
    if (!hanzi || !pinyinAcento) continue; 
    
    // Fila do Pinyin Numérico
    if (pinyinExistente === "") {
      lotePinyin.push(pinyinAcento);
      indicesPinyin.push(i); 
    }
    
    // Fila da Tradução HSK 2
    if (traducaoExistente === "") {
      loteTraducao.push({ id_relativo: i, hanzi: hanzi, pinyin: pinyinAcento });
    }

    // Fila de Observações Hanzi (Coluna H)
    if (obsExistente === "") {
      loteObsHanzi.push({ id_relativo: i, hanzi: hanzi, pinyin: pinyinAcento });
    }
  }
  
  // --- 1. GRAVA PINYIN NUMÉRICO (COLUNA E) ---
  if (lotePinyin.length > 0) {
    console.log(`Enviando ${lotePinyin.length} itens para Pinyin...`);
    let arrayDeResultados = chamarIAEmLote(lotePinyin);
    if (arrayDeResultados && arrayDeResultados.length === lotePinyin.length) {
      for (let j = 0; j < arrayDeResultados.length; j++) {
         valores[indicesPinyin[j]][2] = formatarRegex(arrayDeResultados[j]); 
      }
      const matrizPinyin = valores.map(linha => [linha[2]]);
      aba.getRange(linhaInicial, 5, tamanhoDoLote, 1).setValues(matrizPinyin);
    }
  }

  // --- 2. GRAVA TRADUÇÃO HSK 2 (COLUNA F) ---
  if (loteTraducao.length > 0) {
    console.log(`Enviando ${loteTraducao.length} itens para Tradução...`);
    let resultadosTraducao = obterTraducoesEmLoteHSK2(loteTraducao);
    if (resultadosTraducao) {
      for (let k = 0; k < resultadosTraducao.length; k++) {
         valores[resultadosTraducao[k].id_relativo][3] = resultadosTraducao[k].traducao; 
      }
      const matrizTraducao = valores.map(linha => [linha[3]]);
      aba.getRange(linhaInicial, 6, tamanhoDoLote, 1).setValues(matrizTraducao);
    }
  }

  // --- 3. GRAVA OBS. HANZI (COLUNA H) ---
  if (loteObsHanzi.length > 0) {
    console.log(`Enviando ${loteObsHanzi.length} itens para Obs. Hanzi...`);
    let resultadosObs = obterObsHanziEmLote(loteObsHanzi);
    if (resultadosObs) {
      for (let m = 0; m < resultadosObs.length; m++) {
         valores[resultadosObs[m].id_relativo][5] = resultadosObs[m].observacao; 
      }
      // Coluna H é o índice 8 (A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8)
      const matrizObs = valores.map(linha => [linha[5]]);
      aba.getRange(linhaInicial, 8, tamanhoDoLote, 1).setValues(matrizObs);
    }
  }

  const fim = new Date();
  const tempoTotalSegundos = (fim - inicio) / 1000;
  console.log(`Lote finalizado em ${tempoTotalSegundos.toFixed(2)}s`);
}

// --- FUNÇÕES DE APOIO ---

function chamarIAEmLote(listaDeTextos) {
  const prompt = `Converta uma lista de Pinyin com acentos para Pinyin numérico.
  Regras: 1º=1, 2º=2, 3º=3, 4º=4. Tom neutro = sem número. Separe sílabas com espaço.
  Você receberá um array JSON de strings. Você DEVE retornar ESTRITAMENTE um array JSON de strings.
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
    const json = JSON.parse(resposta.getContentText());
    const jsonLimpo = json.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonLimpo);
  } catch (e) {
    console.log("Erro no Parse do Pinyin: " + e.message);
    return null;
  }
}

function formatarRegex(texto) {
    if (!texto) return "";
    return texto.replace(/(\d)(?=[a-zA-Z])/g, "$1 ").replace(/\s+/g, " ").trim();
}