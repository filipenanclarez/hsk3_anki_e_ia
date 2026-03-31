const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

// COLOQUE O SEU MODELO AQUI
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function gerarPinyinNumerico() {
  const inicio = new Date();
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5; 
  
  const COLUNA_INICIAL = 3; 
  const QTD_COLUNAS = 6; 
  
  const intervaloDados = aba.getRange(linhaInicial, COLUNA_INICIAL, tamanhoDoLote, QTD_COLUNAS); 
  const valores = intervaloDados.getValues();
  
  let lotePinyin = [], indicesPinyin = [];
  let loteTraducao = [];
  let loteObsHanzi = [];

  // 1. VARREDURA (Monta as filas)
  for (let i = 0; i < valores.length; i++) {
    let hanzi = valores[i][0];          
    let pinyinAcento = valores[i][1];   
    let pinyinExistente = valores[i][2]; 
    let traducaoExistente = valores[i][3]; 
    let obsExistente = valores[i][5];   
    
    if (!hanzi || !pinyinAcento) continue; 
    
    if (pinyinExistente === "") {
      lotePinyin.push(pinyinAcento);
      indicesPinyin.push(i); 
    }
    if (traducaoExistente === "") loteTraducao.push({ id_relativo: i, hanzi: hanzi, pinyin: pinyinAcento });
    if (obsExistente === "") loteObsHanzi.push({ id_relativo: i, hanzi: hanzi, pinyin: pinyinAcento });
  }
  
  // 2. PREPARAÇÃO DO LOTE PARALELO
  let requisoesParalelas = [];
  let mapaDeIndices = {}; // Guarda em qual posição do array foi cada requisição

  if (lotePinyin.length > 0) {
    requisoesParalelas.push(montarRequestPinyin(lotePinyin));
    mapaDeIndices.pinyin = requisoesParalelas.length - 1;
  }
  
  if (loteTraducao.length > 0) {
    requisoesParalelas.push(montarRequestTraducao(loteTraducao));
    mapaDeIndices.traducao = requisoesParalelas.length - 1;
  }
  
  if (loteObsHanzi.length > 0) {
    requisoesParalelas.push(montarRequestObsHanzi(loteObsHanzi));
    mapaDeIndices.obs = requisoesParalelas.length - 1;
  }

  // 3. O GRANDE DISPARO PARALELO (Magia acontece aqui)
  let respostas = [];
  if (requisoesParalelas.length > 0) {
    console.log(`Disparando ${requisoesParalelas.length} requisições de API SIMULTANEAMENTE...`);
    respostas = UrlFetchApp.fetchAll(requisoesParalelas);
  }

  // 4. PROCESSAMENTO E GRAVAÇÃO DAS RESPOSTAS
  
  // Pinyin
  if (mapaDeIndices.pinyin !== undefined) {
    let arrayDeResultados = extrairJsonPinyin(respostas[mapaDeIndices.pinyin]);
    if (arrayDeResultados) {
      for (let j = 0; j < arrayDeResultados.length; j++) {
         valores[indicesPinyin[j]][2] = formatarRegex(arrayDeResultados[j]); 
      }
      aba.getRange(linhaInicial, 5, tamanhoDoLote, 1).setValues(valores.map(linha => [linha[2]]));
    }
  }

  // Tradução
  if (mapaDeIndices.traducao !== undefined) {
    let resultadosTraducao = extrairJsonTraducao(respostas[mapaDeIndices.traducao]);
    if (resultadosTraducao) {
      for (let k = 0; k < resultadosTraducao.length; k++) {
         valores[resultadosTraducao[k].id_relativo][3] = resultadosTraducao[k].traducao; 
      }
      aba.getRange(linhaInicial, 6, tamanhoDoLote, 1).setValues(valores.map(linha => [linha[3]]));
    }
  }

  // Obs. Hanzi
  if (mapaDeIndices.obs !== undefined) {
    let resultadosObs = extrairJsonObsHanzi(respostas[mapaDeIndices.obs]);
    if (resultadosObs) {
      for (let m = 0; m < resultadosObs.length; m++) {
         valores[resultadosObs[m].id_relativo][5] = resultadosObs[m].observacao; 
      }
      aba.getRange(linhaInicial, 8, tamanhoDoLote, 1).setValues(valores.map(linha => [linha[5]]));
    }
  }

  const fim = new Date();
  console.log(`Lote finalizado em ${((fim - inicio) / 1000).toFixed(2)}s`);
}

// --- FUNÇÕES DE APOIO PARA O PINYIN ---

function montarRequestPinyin(listaDeTextos) {
  const prompt = `Converta uma lista de Pinyin com acentos para Pinyin numérico.
  Regras: 1º=1, 2º=2, 3º=3, 4º=4. Tom neutro = sem número. Separe sílabas com espaço.
  Você receberá um array JSON de strings. Você DEVE retornar ESTRITAMENTE um array JSON de strings.
  Entrada: ${JSON.stringify(listaDeTextos)}`;

  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": { "temperature": 0.0 }
  };

  return {
    url: API_URL, // Já pega a URL fixa que você arrumar no topo do arquivo
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
}

function extrairJsonPinyin(respostaHttp) {
  if (respostaHttp.getResponseCode() !== 200) return null;
  try {
    const json = JSON.parse(respostaHttp.getContentText());
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