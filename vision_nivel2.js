/**
 * FUNÇÃO PRINCIPAL: Processa os prints da pasta do Drive
 */
function processarPrintsHSK() {
  const FOLDER_ID = '1d-iclYPFitkd-2tpw_QbnTVwskicEsrr';
  const folderNovos = DriveApp.getFolderById(FOLDER_ID);
  
  // 1. Garante que existe uma pasta para mover os arquivos processados
  let folderProcessados;
  const subPastas = folderNovos.getFoldersByName('Processados');
  if (subPastas.hasNext()) {
    folderProcessados = subPastas.next();
  } else {
    folderProcessados = folderNovos.createFolder('Processados');
  }

  const arquivos = folderNovos.getFiles();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let stagingSheet = ss.getSheetByName('STAGING');

  // 2. Se a aba STAGING não existir, cria com cabeçalhos
  if (!stagingSheet) {
    stagingSheet = ss.insertSheet('STAGING');
    stagingSheet.appendRow(['ID', 'Hanzi', 'Pinyin', 'Frase Hanzi', 'Frase Pinyin', 'Tradução']);
    stagingSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#f3f3f3");
  }

  console.log("Iniciando varredura de prints...");

  while (arquivos.hasNext()) {
    let arquivo = arquivos.next();
    
    // Pula pastas ou arquivos que não sejam imagem
    if (arquivo.getMimeType().includes('image')) {
      console.log(`Lendo imagem: ${arquivo.getName()}`);
      
      let dados = extrairDadosViaVisao(arquivo.getBlob());
      
      if (dados && dados.numero_palavra) {

        // --- LIMPEZA DE PONTUAÇÃO FINAL ---
        // Remove o ponto final chinês da frase em Hanzi
        dados.frase_exemplo_hanzi = dados.frase_exemplo_hanzi.replace(/。/g, '').trim();
        
        // Remove o ponto final ocidental da tradução e do pinyin (se houver)
        dados.traducao_portugues = dados.traducao_portugues.replace(/\./g, '').trim();
        dados.frase_exemplo_pinyin = dados.frase_exemplo_pinyin.replace(/\./g, '').trim();
        // ----------------------------------

        // CHAMA A FUNÇÃO LOCAL PARA GERAR A STRING DO ANKI
        const fraseFurigana = formatarParaAnki(dados.frase_exemplo_hanzi, dados.frase_exemplo_pinyin);

        // 3. Adiciona na aba STAGING (Append é mais seguro aqui)
        stagingSheet.appendRow([
          dados.numero_palavra,
          dados.hanzi,
          dados.pinyin,
          dados.frase_exemplo_hanzi,
          dados.frase_exemplo_pinyin,
          dados.traducao_portugues,
          fraseFurigana
        ]);
        
        // 4. Move o arquivo para a pasta de processados
        arquivo.moveTo(folderProcessados);
        console.log(`Sucesso: Palavra ${dados.numero_palavra} processada.`);
      } else {
        console.log(`Erro ao processar ${arquivo.getName()}. Verifique o log.`);
      }
    }
  }

  // --- AUTO-ORDENAÇÃO ---
  // Verifica se tem mais do que só a linha de cabeçalho para ordenar
  if (stagingSheet.getLastRow() > 1) {
    console.log("Ordenando a planilha pelo ID...");
    // Pega o intervalo de dados (ignorando o cabeçalho na linha 1) e ordena pela coluna 1 (ID)
    let rangeParaOrdenar = stagingSheet.getRange(2, 1, stagingSheet.getLastRow() - 1, stagingSheet.getLastColumn());
    rangeParaOrdenar.sort({column: 1, ascending: true});
  }

  console.log("Fim do processamento.");
}

/**
 * Chama a API do Gemini Vision (1.5 Flash)
 */
function extrairDadosViaVisao(blob) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  const base64Image = Utilities.base64Encode(blob.getBytes());

const prompt = `Você é um extrator de texto (OCR) de alta precisão. 
  Sua tarefa é transcrever os dados desta imagem de aula de chinês EXATAMENTE como aparecem na tela, sem alterar formatos.

  DIRETRIZES VISUAIS:
  1. A PALAVRA ALVO (Hanzi isolado) é aquela que está destacada com uma cor diferente das demais.
  2. REGRA DE OURO PARA O PINYIN: Transcreva o Pinyin de forma LITERAL. 
     - Mantenha os acentos visuais originais (ā, á, ǎ, à, ü, etc.).
     - NÃO converta os tons para números sob nenhuma hipótese.
     - Respeite EXATAMENTE o mesmo espaçamento e capitalização (maiúsculas/minúsculas) que está na imagem.
     - Exemplo: Se na imagem está "ānquán", retorne "ānquán". Se está "Wǒmen", retorne "Wǒmen".
  
  Retorne ESTRITAMENTE este JSON:
  {
    "numero_palavra": 0,
    "hanzi": "palavra destacada",
    "pinyin": "pinyin copiado exatamente da imagem",
    "frase_exemplo_hanzi": "frase completa da imagem",
    "frase_exemplo_pinyin": "pinyin da frase copiado exatamente da imagem",
    "traducao_portugues": "tradução da frase"
  }`;

  const payload = {
    "contents": [{
      "parts": [
        { "text": prompt },
        { "inline_data": { "mime_type": "image/png", "data": base64Image } }
      ]
    }],
    "generationConfig": { 
      "response_mime_type": "application/json",
      "temperature": 0 
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
      const textoSaida = json.candidates[0].content.parts[0].text;
      return JSON.parse(textoSaida);
    } else {
      console.log("Erro API: " + resposta.getContentText());
      return null;
    }
  } catch (e) {
    console.log("Erro no fetch: " + e.message);
    return null;
  }
}

/**
 * Converte Hanzi e Pinyin para o formato do Anki: Hanzi[Pinyin]
 * Trata as pontuações para que fiquem de fora dos colchetes.
 */
function formatarParaAnki(hanziStr, pinyinStr) {
  if (!hanziStr || !pinyinStr) return "";

  // 1. Limpa pontuações ocidentais do Pinyin que possam ter vindo na imagem
  let pinyinLimpo = pinyinStr.replace(/[,.?!:;()]/g, '');
  let blocosPinyin = pinyinLimpo.split(/\s+/).filter(Boolean);

  // Regex poderoso: encontra os grupos de vogais no pinyin (incluindo os acentuados)
  // Cada grupo de vogais = 1 Hanzi
  const regexVogais = /[aāáǎàeēéěèiīíǐìoōóǒòuūúǔùüǖǘǚǜ]+/gi;

  // Regex para identificar pontuações chinesas e ocidentais no Hanzi
  const regexPontuacaoChinesa = /[\u3000-\u303F\uFF00-\uFFEF]/;

  let fraseAnki = "";
  let cursorHanzi = 0;

  for (let i = 0; i < blocosPinyin.length; i++) {
    let pinyinWord = blocosPinyin[i];
    
    // Conta quantas sílabas (Hanzi) essa palavra Pinyin engloba
    let matches = pinyinWord.match(regexVogais);
    let qtdSilibas = matches ? matches.length : 1; // Fallback para 1

    let hanziChunk = "";
    let pontuacaoAntes = "";
    
    // Captura pontuações ANTES da palavra
    while (cursorHanzi < hanziStr.length && regexPontuacaoChinesa.test(hanziStr[cursorHanzi])) {
      pontuacaoAntes += hanziStr[cursorHanzi];
      cursorHanzi++;
    }

    // Captura os Hanzi correspondentes a esta palavra Pinyin
    for (let j = 0; j < qtdSilibas; j++) {
      if (cursorHanzi < hanziStr.length) {
        // Ignora pontuação no meio da palavra (caso raro, mas protege o script)
        if (regexPontuacaoChinesa.test(hanziStr[cursorHanzi])) {
          hanziChunk += hanziStr[cursorHanzi];
          cursorHanzi++;
          j--; // Não conta a pontuação como um Hanzi consumido
        } else {
          hanziChunk += hanziStr[cursorHanzi];
          cursorHanzi++;
        }
      }
    }

    // Monta o bloco Anki e adiciona à string final
    fraseAnki += `${pontuacaoAntes}${hanziChunk}[${pinyinWord}]`;
  }

  // Adiciona qualquer pontuação que tenha sobrado no final da frase (ex: ponto final, interrogação)
  let pontuacaoFinal = "";
  while (cursorHanzi < hanziStr.length) {
    pontuacaoFinal += hanziStr[cursorHanzi];
    cursorHanzi++;
  }

  return fraseAnki + pontuacaoFinal;
}