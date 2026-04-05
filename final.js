const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function gerarPinyinNumerico() {
  const inicio = new Date();
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5;

  const COLUNA_INICIAL = 3;
  const QTD_COLUNAS = 12;

  const intervaloDados = aba.getRange(linhaInicial, COLUNA_INICIAL, tamanhoDoLote, QTD_COLUNAS);
  const valores = intervaloDados.getValues();

  // Carrega STAGING uma vez para busca direta de frases
  const stagingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('STAGING');
  const stagingData = stagingSheet ? stagingSheet.getDataRange().getValues() : [];

  let lotePinyin = [], indicesPinyin = [];
  let loteTraducao = [];
  let loteObsHanzi = [];
  let loteObsFrase = [];

  for (let i = 0; i < valores.length; i++) {
    let hanzi = valores[i][0];
    let pinyinAcento = valores[i][1];

    // ← adiciona aqui
    console.log(`   Raw linha ${i}: col0="${hanzi}", col1="${pinyinAcento}"`);
       
    if (!hanzi || !pinyinAcento) continue;

    if (valores[i][2] === "") { lotePinyin.push(pinyinAcento); indicesPinyin.push(i); }
    if (valores[i][3] === "") loteTraducao.push({ id_relativo: i, hanzi, pinyin: pinyinAcento });
    if (valores[i][5] === "") loteObsHanzi.push({ id_relativo: i, hanzi, pinyin: pinyinAcento });

    // Busca frase diretamente na STAGING pelo ID (coluna B) + Hanzi (coluna C)
    let idPalavra = String(aba.getRange(linhaInicial + i, 2).getValue());
    let fraseHanzi = "";
    for (let s = 1; s < stagingData.length; s++) {
      if (String(stagingData[s][0]) === idPalavra && stagingData[s][1] === hanzi) {
        fraseHanzi = stagingData[s][3]; // coluna D da STAGING
        break;
      }
    }

     // ← adiciona isso
    console.log(`   Linha ${i}: hanzi=${hanzi}, id=${idPalavra}, fraseEncontrada=${fraseHanzi !== "" ? "SIM" : "NÃO"}, colN=${valores[i][11] === "" ? "vazia" : "preenchida"}`);

    if (fraseHanzi && valores[i][11] === "") {
      loteObsFrase.push({ id_relativo: i, frase_hanzi: fraseHanzi });
    }
  }



  // Monta todas as requisições paralelas
  let requisoesParalelas = [];
  let mapaDeIndices = {};

  if (lotePinyin.length > 0) {
    requisoesParalelas.push(montarRequestPinyin(lotePinyin));
    mapaDeIndices.pinyin = requisoesParalelas.length - 1;
  }

  if (loteTraducao.length > 0) {
    requisoesParalelas.push(montarRequestTraducao(loteTraducao));
    mapaDeIndices.traducao = requisoesParalelas.length - 1;
  }

  // Uma request por palavra para obs_hanzi
  if (loteObsHanzi.length > 0) {
    mapaDeIndices.obs = [];
    for (let i = 0; i < loteObsHanzi.length; i++) {
      requisoesParalelas.push(montarRequestObsHanzi([loteObsHanzi[i]]));
      mapaDeIndices.obs.push({
        posicaoNaFila: requisoesParalelas.length - 1,
        id_relativo: loteObsHanzi[i].id_relativo
      });
    }
  }

  // Uma request por frase para obs_frase
  if (loteObsFrase.length > 0) {
    mapaDeIndices.obsFrase = [];
    for (let i = 0; i < loteObsFrase.length; i++) {
      requisoesParalelas.push(montarRequestObsFrase([loteObsFrase[i]]));
      mapaDeIndices.obsFrase.push({
        posicaoNaFila: requisoesParalelas.length - 1,
        id_relativo: loteObsFrase[i].id_relativo
      });
    }
  }

  // Logs de diagnóstico
  console.log(`📋 Varredura concluída:`);
  console.log(`   lotePinyin: ${lotePinyin.length} itens`);
  console.log(`   loteTraducao: ${loteTraducao.length} itens`);
  console.log(`   loteObsHanzi: ${loteObsHanzi.length} itens`);
  console.log(`   loteObsFrase: ${loteObsFrase.length} itens`);
  console.log(`   STAGING carregada: ${stagingData.length - 1} linhas`);

  if (requisoesParalelas.length === 0) {
    console.log("ℹ️ Nada para processar — todas as colunas já estão preenchidas nas linhas selecionadas.");
    return;
  }

  // Disparo único paralelo
  let respostas = [];
  try {
    console.log(`🚀 Disparando ${requisoesParalelas.length} requisições simultaneamente...`);
    const tempoInicioFetch = new Date();
    respostas = UrlFetchApp.fetchAll(requisoesParalelas);
    console.log(`⏱️ Requisições voltaram em ${((new Date() - tempoInicioFetch) / 1000).toFixed(2)}s`);
  } catch (erroDeRede) {
    console.log(`⚠️ Falha de rede: ${erroDeRede.message}`);
    return;
  }

  // Processa Pinyin
  if (mapaDeIndices.pinyin !== undefined) {
    let arr = extrairJsonPinyin(respostas[mapaDeIndices.pinyin]);
    if (arr) {
      for (let j = 0; j < arr.length; j++) valores[indicesPinyin[j]][2] = formatarRegex(arr[j]);
      aba.getRange(linhaInicial, 5, tamanhoDoLote, 1).setValues(valores.map(l => [l[2]]));
    }
  }

  // Processa Tradução
  if (mapaDeIndices.traducao !== undefined) {
    let arr = extrairJsonTraducao(respostas[mapaDeIndices.traducao]);
    if (arr) {
      for (let k = 0; k < arr.length; k++) valores[arr[k].id_relativo][3] = arr[k].traducao;
      aba.getRange(linhaInicial, 6, tamanhoDoLote, 1).setValues(valores.map(l => [l[3]]));
    }
  }

  // Processa Obs. Hanzi
  if (mapaDeIndices.obs) {
    for (let r = 0; r < mapaDeIndices.obs.length; r++) {
      let { posicaoNaFila, id_relativo } = mapaDeIndices.obs[r];
      let arr = extrairJsonObsHanzi(respostas[posicaoNaFila]);
      if (arr && arr[0]) valores[id_relativo][5] = arr[0].observacao;
    }
    aba.getRange(linhaInicial, 8, tamanhoDoLote, 1).setValues(valores.map(l => [l[5]]));
  }

  // Processa Obs. Frase
  if (mapaDeIndices.obsFrase) {
    for (let r = 0; r < mapaDeIndices.obsFrase.length; r++) {
      let { posicaoNaFila, id_relativo } = mapaDeIndices.obsFrase[r];
      let arr = extrairJsonObsFrase(respostas[posicaoNaFila]);
      if (arr && arr[0]) valores[id_relativo][11] = arr[0].analise;
    }
    aba.getRange(linhaInicial, 14, tamanhoDoLote, 1).setValues(valores.map(l => [l[11]]));
  }

  // Fórmulas Coluna G
  let matrizFormulasG = [];
  for (let idx = 0; idx < tamanhoDoLote; idx++) {
    matrizFormulasG.push([`=SUBSTITUTE(F${linhaInicial + idx};CHAR(10);"<br>")`]);
  }
  aba.getRange(linhaInicial, 7, tamanhoDoLote, 1).setFormulas(matrizFormulasG);

  // Fórmulas Coluna I
  let matrizFormulasI = [];
  for (let idx = 0; idx < tamanhoDoLote; idx++) {
    matrizFormulasI.push([`=SUBSTITUTE(H${linhaInicial + idx};CHAR(10);"<br>")`]);
  }
  aba.getRange(linhaInicial, 9, tamanhoDoLote, 1).setFormulas(matrizFormulasI);

  // Fórmulas Coluna J — frase Hanzi da STAGING
  let matrizFormulasJ = [];
  for (let idx = 0; idx < tamanhoDoLote; idx++) {
    let linha = linhaInicial + idx;
    matrizFormulasJ.push([`=IFERROR(INDEX(STAGING!D$2:D;MATCH(B${linha}&C${linha};STAGING!A$2:A&STAGING!B$2:B;0));"")`]);
  }
  aba.getRange(linhaInicial, 10, tamanhoDoLote, 1).setFormulas(matrizFormulasJ);

  // Fórmulas Coluna K — frase furigana (Anki) da STAGING
  let matrizFormulasK = [];
  for (let idx = 0; idx < tamanhoDoLote; idx++) {
    let linha = linhaInicial + idx;
    matrizFormulasK.push([`=IFERROR(INDEX(STAGING!G$2:G;MATCH(B${linha}&C${linha};STAGING!A$2:A&STAGING!B$2:B;0));"")`]);
  }
  aba.getRange(linhaInicial, 11, tamanhoDoLote, 1).setFormulas(matrizFormulasK);

  // Fórmulas Coluna L — tradução da frase da STAGING
  let matrizFormulasL = [];
  for (let idx = 0; idx < tamanhoDoLote; idx++) {
    let linha = linhaInicial + idx;
    matrizFormulasL.push([`=IFERROR(INDEX(STAGING!F$2:F;MATCH(B${linha}&C${linha};STAGING!A$2:A&STAGING!B$2:B;0));"")`]);
  }
  aba.getRange(linhaInicial, 12, tamanhoDoLote, 1).setFormulas(matrizFormulasL);

  // Fórmulas Coluna M — tradução da frase sem quebras de linha
  let matrizFormulasM = [];
  for (let idx = 0; idx < tamanhoDoLote; idx++) {
    matrizFormulasM.push([`=SUBSTITUTE(L${linhaInicial + idx};CHAR(10);"<br>")`]);
  }
  aba.getRange(linhaInicial, 13, tamanhoDoLote, 1).setFormulas(matrizFormulasM);

  console.log(`✅ Lote finalizado em ${((new Date() - inicio) / 1000).toFixed(2)}s`);
}

// --- FUNÇÕES DE APOIO PARA O PINYIN ---

function montarRequestPinyin(listaDeTextos) {
  const prompt = `Converta uma lista de Pinyin com acentos para Pinyin numérico.
  Regras: 1º=1, 2º=2, 3º=3, 4º=4. Tom neutro = sem número. Separe sílabas com espaço.
  Você receberá um array JSON de strings. Você DEVE retornar ESTRITAMENTE um array JSON de strings.
  Entrada: ${JSON.stringify(listaDeTextos)}`;

  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": {
      "temperature": 0.0,
      "response_mime_type": "application/json",
      "responseSchema": { "type": "ARRAY", "items": { "type": "STRING" } },
      "thinkingConfig": { "thinkingBudget": 0 }
    }
  };

  return {
    url: API_URL,
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
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (e) {
    console.log("Erro no Parse do Pinyin: " + e.message);
    return null;
  }
}

function formatarRegex(texto) {
  if (!texto) return "";
  return texto.replace(/(\d)(?=[a-zA-Z])/g, "$1 ").replace(/\s+/g, " ").trim();
}