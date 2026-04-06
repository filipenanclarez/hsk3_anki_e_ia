/**
 * Módulo de Áudio - Palavras (Hanzi)
 */

const HSK_PROJECT_ID = '6a2c12b1-b1ea-44c3-805e-e55dfba29130';

const VOZES = [
  { id: 'cmn-CN-Wavenet-A', label: 'CN Wavenet A (feminina)',  sufixo: 'cn_wavenet_a' },
  { id: 'cmn-CN-Wavenet-B', label: 'CN Wavenet B (masculina)', sufixo: 'cn_wavenet_b' },
  { id: 'cmn-CN-Wavenet-C', label: 'CN Wavenet C (masculina)', sufixo: 'cn_wavenet_c' },
  { id: 'cmn-CN-Wavenet-D', label: 'CN Wavenet D (feminina)',  sufixo: 'cn_wavenet_d' },
  { id: 'cmn-TW-Wavenet-A', label: 'TW Wavenet A (feminina)',  sufixo: 'tw_wavenet_a' },
  { id: 'cmn-TW-Wavenet-B', label: 'TW Wavenet B (masculina)', sufixo: 'tw_wavenet_b' },
  { id: 'cmn-TW-Wavenet-C', label: 'TW Wavenet C (masculina)', sufixo: 'tw_wavenet_c' },
];

// ─── GERAÇÃO EM LOTE ─────────────────────────────────────────────────

function gerarAudioHanziLote() {
  const inicio = new Date();
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5;

  const TTS_API_KEY = PropertiesService.getScriptProperties().getProperty('TTS_API_KEY');
  const FOLDER_ID   = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folder      = DriveApp.getFolderById(FOLDER_ID);
  const vozPadrao   = PropertiesService.getScriptProperties().getProperty('TTS_VOICE') || 'cmn-CN-Wavenet-A';
  const velocidade  = parseFloat(PropertiesService.getScriptProperties().getProperty('TTS_SPEED') || '0.85');

  const valores = aba.getRange(linhaInicial, 3, tamanhoDoLote, 15).getValues();

  console.log(`Linha inicial: ${linhaInicial}`);

  for (let i = 0; i < valores.length; i++) {
    let hanzi          = valores[i][0];  // C
    let pinyinNumerico = valores[i][2];  // E
    let audioExistente = valores[i][13]; // P

    if (!hanzi || !pinyinNumerico || pinyinNumerico.toString().trim() === "") {
      console.log(`   Linha ${i}: pulada (rode gerarPinyinNumerico primeiro)`);
      continue;
    }
    if (audioExistente && audioExistente.toString().trim() !== "") {
      console.log(`   Linha ${i}: ${hanzi} já tem áudio definitivo, pulando`);
      continue;
    }

    let nomeDefinitivo = `${HSK_PROJECT_ID}_${pinyinNumerico.replace(/\s+/g, "_")}.mp3`;
    let ssml = `<speak><phoneme alphabet="pinyin" ph="${pinyinNumerico}">${hanzi}</phoneme></speak>`;

    console.log(`   Gerando áudio para ${hanzi} (${pinyinNumerico}) com ${vozPadrao}...`);
    let audioBase64 = chamarGoogleTTS(ssml, TTS_API_KEY, vozPadrao, velocidade);

    if (!audioBase64) {
      console.log(`   ⚠️ Falha ao gerar áudio para ${hanzi}`);
      continue;
    }

    salvarAudioNoDrive(folder, nomeDefinitivo, audioBase64);
    aba.getRange(linhaInicial + i, 16).setValue(`[sound:${nomeDefinitivo}]`);
    console.log(`   ✅ ${hanzi} → ${nomeDefinitivo}`);
  }

  console.log(`🎵 Lote finalizado em ${((new Date() - inicio) / 1000).toFixed(2)}s`);
}

// ─── GERAÇÃO DE PREVIEWS ─────────────────────────────────────────────

function gerarPreviewsHanzi(linha) {
  const aba            = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const hanzi          = aba.getRange(linha, 3).getValue(); // C
  const pinyin         = aba.getRange(linha, 4).getValue(); // D
  const pinyinNumerico = aba.getRange(linha, 5).getValue(); // E
  const previewsSalvos = aba.getRange(linha, 17).getValue(); // Q

  if (!hanzi || !pinyinNumerico || pinyinNumerico.toString().trim() === "") {
    return { erro: "Pinyin numérico ausente na coluna E. Rode gerarPinyinNumerico primeiro." };
  }

  const TTS_API_KEY = PropertiesService.getScriptProperties().getProperty('TTS_API_KEY');
  const FOLDER_ID   = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folder      = DriveApp.getFolderById(FOLDER_ID);
  const velocidade  = parseFloat(PropertiesService.getScriptProperties().getProperty('TTS_SPEED') || '0.85');

  let nomeBase = `${HSK_PROJECT_ID}_${pinyinNumerico.replace(/\s+/g, "_")}`;
  let ssml     = `<speak><phoneme alphabet="pinyin" ph="${pinyinNumerico}">${hanzi}</phoneme></speak>`;

  let previews     = [];
  let nomesGerados = [];

  for (let v of VOZES) {
    let nomeArquivo = `${nomeBase}_${v.sufixo}.mp3`;
    nomesGerados.push(nomeArquivo);

    // Verifica se já existe no Drive
    let arquivos = folder.getFilesByName(nomeArquivo);
    if (arquivos.hasNext()) {
      console.log(`   Preview já existe: ${nomeArquivo}`);
      let base64 = Utilities.base64Encode(arquivos.next().getBlob().getBytes());
      previews.push({ vozId: v.id, vozLabel: v.label, sufixo: v.sufixo, base64, nomeArquivo });
      continue;
    }

    // Gera novo
    console.log(`   Gerando preview ${v.id} para ${hanzi}...`);
    let base64Gerado = chamarGoogleTTS(ssml, TTS_API_KEY, v.id, velocidade);

    if (!base64Gerado) {
      previews.push({ vozId: v.id, vozLabel: v.label, sufixo: v.sufixo, base64: null, nomeArquivo, erro: "Falha ao gerar" });
      continue;
    }

    salvarAudioNoDrive(folder, nomeArquivo, base64Gerado);
    let base64Final = Utilities.base64Encode(Utilities.base64Decode(base64Gerado));
    previews.push({ vozId: v.id, vozLabel: v.label, sufixo: v.sufixo, base64: base64Final, nomeArquivo });
  }

  // Salva nomes dos previews na coluna Q
  aba.getRange(linha, 17).setValue(nomesGerados.join('|'));

  return { hanzi, pinyin, pinyinNumerico, previews };
}

// ─── CONFIRMAÇÃO DA VOZ ESCOLHIDA ────────────────────────────────────

function confirmarVozHanzi(linha, nomeArquivoPreview) {
  const aba            = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const pinyinNumerico = aba.getRange(linha, 5).getValue(); // E

  const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folder    = DriveApp.getFolderById(FOLDER_ID);

  let nomeDefinitivo = `${HSK_PROJECT_ID}_${pinyinNumerico.replace(/\s+/g, "_")}.mp3`;

  let arquivosPreview = folder.getFilesByName(nomeArquivoPreview);
  if (!arquivosPreview.hasNext()) {
    return { sucesso: false, erro: "Arquivo de preview não encontrado: " + nomeArquivoPreview };
  }

  let blob = arquivosPreview.next().getBlob().copyBlob();
  blob.setName(nomeDefinitivo);

  let existentes = folder.getFilesByName(nomeDefinitivo);
  if (existentes.hasNext()) existentes.next().setTrashed(true);
  folder.createFile(blob);

  aba.getRange(linha, 16).setValue(`[sound:${nomeDefinitivo}]`);
  console.log(`✅ Voz confirmada: ${nomeArquivoPreview} → ${nomeDefinitivo}`);

  return { sucesso: true, nomeDefinitivo };
}

// ─── DADOS PARA A SIDEBAR ────────────────────────────────────────────

function getDadosLinhaHanzi() {
  const aba      = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linha    = aba.getActiveCell().getRow();
  const hanzi    = aba.getRange(linha, 3).getValue();  // C
  const pinyin   = aba.getRange(linha, 4).getValue();  // D
  const audioTag = aba.getRange(linha, 16).getValue(); // P

  if (!hanzi) return { linha, hanzi: "", pinyin: "", status: "vazio" };

  if (!audioTag || !audioTag.toString().includes('[sound:')) {
    return { linha, hanzi, pinyin, status: "sem_audio" };
  }

  const nomeDefinitivo = audioTag.toString().replace('[sound:', '').replace(']', '');
  return { linha, hanzi, pinyin, nomeDefinitivo, status: "ok" };
}

// ─── BUSCA BASE64 DO ÁUDIO DEFINITIVO ────────────────────────────────

function getAudioBase64ParaPlayer(linha) {
  const aba      = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const audioTag = aba.getRange(linha, 16).getValue();

  if (!audioTag || !audioTag.toString().includes('[sound:')) return { erro: "Sem áudio" };

  const nomeArquivo = audioTag.toString().replace('[sound:', '').replace(']', '');

  try {
    const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
    const folder    = DriveApp.getFolderById(FOLDER_ID);
    const arquivos  = folder.getFilesByName(nomeArquivo);
    if (!arquivos.hasNext()) return { erro: "Arquivo não encontrado: " + nomeArquivo };
    const base64 = Utilities.base64Encode(arquivos.next().getBlob().getBytes());
    return { sucesso: true, base64, nomeArquivo };
  } catch(e) {
    return { erro: e.message };
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function chamarGoogleTTS(ssml, apiKey, nomeVoz, velocidade) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const payload = {
    "input": { "ssml": ssml },
    "voice": { "languageCode": "cmn-CN", "name": nomeVoz },
    "audioConfig": { "audioEncoding": "MP3", "speakingRate": velocidade }
  };

  try {
    const resposta = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (resposta.getResponseCode() !== 200) {
      console.log(`Erro TTS (${nomeVoz}): ` + resposta.getContentText());
      return null;
    }
    return JSON.parse(resposta.getContentText()).audioContent;
  } catch (e) {
    console.log(`Erro na chamada TTS (${nomeVoz}): ` + e.message);
    return null;
  }
}

function salvarAudioNoDrive(folder, nomeArquivo, base64) {
  let existentes = folder.getFilesByName(nomeArquivo);
  if (existentes.hasNext()) existentes.next().setTrashed(true);
  let blob = Utilities.newBlob(Utilities.base64Decode(base64), "audio/mpeg", nomeArquivo);
  folder.createFile(blob);
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────

function abrirSidebarAudioHanzi() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_audio')
    .setTitle('🔊 Preview Áudio - Hanzi');
  SpreadsheetApp.getUi().showSidebar(html);
}

// ─── MENU ────────────────────────────────────────────────────────────

// function onOpen() {
//   SpreadsheetApp.getUi()
//     .createMenu('HSK Tools')
//     .addItem('🔊 Abrir Preview de Áudio', 'abrirSidebarAudioHanzi')
//     .addItem('🎵 Gerar Áudios Hanzi (lote)', 'gerarAudioHanziLote')
//     .addToUi();
// }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎙️ IA Audio Player')
    .addItem('Abrir Player', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Player de Áudio IA')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Esta função será chamada pela Sidebar periodicamente
function getSelectedCellValue() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var cell = sheet.getActiveCell();
    var val = cell.getValue();
    
    // Retorna o valor apenas se for um link do Drive
    if (val.toString().includes("drive.google.com")) {
      return val;
    }
    return null;
  } catch (e) {
    return null;
  }
}