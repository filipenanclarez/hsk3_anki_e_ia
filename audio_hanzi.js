/**
 * Módulo de Áudio - Geração TTS e Preview via Sidebar
 */
const HSK_PROJECT_ID = '6a2c12b1-b1ea-44c3-805e-e55dfba29130';

const VOZES = [
  { id: 'cmn-CN-Wavenet-A', label: 'CN Wavenet A (feminina)' },
  { id: 'cmn-CN-Wavenet-B', label: 'CN Wavenet B (masculina)' },
  { id: 'cmn-CN-Wavenet-C', label: 'CN Wavenet C (masculina)' },
  { id: 'cmn-CN-Wavenet-D', label: 'CN Wavenet D (feminina)' },
  { id: 'cmn-TW-Wavenet-A', label: 'TW Wavenet A (feminina)' },
  { id: 'cmn-TW-Wavenet-B', label: 'TW Wavenet B (masculina)' },
  { id: 'cmn-TW-Wavenet-C', label: 'TW Wavenet C (masculina)' },
  
];

// ─── GERAÇÃO DE ÁUDIO EM LOTE ────────────────────────────────────────

function gerarAudioLote() {
  const inicio = new Date();
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5;

  const TTS_API_KEY = PropertiesService.getScriptProperties().getProperty('TTS_API_KEY');
  const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const vozPadrao = PropertiesService.getScriptProperties().getProperty('TTS_VOICE') || 'cmn-CN-Wavenet-A';
  const velocidade = parseFloat(PropertiesService.getScriptProperties().getProperty('TTS_SPEED') || '0.85');

  const valores = aba.getRange(linhaInicial, 3, tamanhoDoLote, 14).getValues();

  console.log(`Linha inicial: ${linhaInicial}`);

  for (let i = 0; i < valores.length; i++) {
    let hanzi = valores[i][0];
    let pinyinNumerico = valores[i][2];  // Coluna E — já correto, gerado pelo Gemini
    let audioExistente = valores[i][13];

    if (!hanzi || !pinyinNumerico || pinyinNumerico.toString().trim() === "") {
      console.log(`   Linha ${i}: pulada (coluna E vazia — rode gerarPinyinNumerico primeiro)`);
      continue;
    }
    if (audioExistente && audioExistente.toString().trim() !== "") {
      console.log(`   Linha ${i}: ${hanzi} já tem áudio, pulando`);
      continue;
    }

    let pinyinSsml = converterAcentoParaNumero(pinyinAcento);
    let ssml = `<speak><phoneme alphabet="pinyin" ph="${pinyinNumerico}">${hanzi}</phoneme></speak>`;

    console.log(`   Gerando áudio para ${hanzi} (${pinyinSsml}) com ${vozPadrao}...`);
    let audioBase64 = chamarGoogleTTS(ssml, TTS_API_KEY, vozPadrao, velocidade);

    if (!audioBase64) {
      console.log(`   ⚠️ Falha ao gerar áudio para ${hanzi}`);
      continue;
    }

    let nomeArquivo = `${HSK_PROJECT_ID}_${pinyinNumerico.replace(/\s+/g, "_")}.mp3`;
    salvarAudioNoDrive(folder, nomeArquivo, audioBase64);
    aba.getRange(linhaInicial + i, 16).setValue(`[sound:${nomeArquivo}]`);
    console.log(`   ✅ ${hanzi} → ${nomeArquivo}`);
  }

  console.log(`🎵 Áudios gerados em ${((new Date() - inicio) / 1000).toFixed(2)}s`);
}

// ─── GERAÇÃO DE ALTERNATIVAS (chamada pela sidebar) ──────────────────

function gerarAudiosAlternativos(linha) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const hanzi = aba.getRange(linha, 3).getValue();          // Coluna C
  const pinyin = aba.getRange(linha, 4).getValue();         // Coluna D — só para exibir na sidebar
  const pinyinNumerico = aba.getRange(linha, 5).getValue(); // Coluna E — para o SSML

  if (!hanzi || !pinyinNumerico || pinyinNumerico.toString().trim() === "") {
    return { erro: "Pinyin numérico ausente na coluna E. Rode gerarPinyinNumerico primeiro." };
  }

  const TTS_API_KEY = PropertiesService.getScriptProperties().getProperty('TTS_API_KEY');
  const velocidade = parseFloat(PropertiesService.getScriptProperties().getProperty('TTS_SPEED') || '0.85');
  const ssml = `<speak><phoneme alphabet="pinyin" ph="${pinyinNumerico}">${hanzi}</phoneme></speak>`;

  let alternativas = [];
  for (let v of VOZES) {
    console.log(`   Gerando alternativa ${v.id} para ${hanzi} (${pinyinNumerico})...`);
    let base64 = chamarGoogleTTS(ssml, TTS_API_KEY, v.id, velocidade);
    alternativas.push({
      vozId: v.id,
      vozLabel: v.label,
      base64: base64 || null,
      erro: base64 ? null : "Falha ao gerar"
    });
  }

  return { hanzi, pinyin, pinyinNumerico, alternativas };
}

// ─── CONFIRMAÇÃO DA VOZ ESCOLHIDA (chamada pela sidebar) ─────────────

function confirmarVozEscolhida(linha, vozId, base64) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const pinyinAcento = aba.getRange(linha, 4).getValue();
  const pinyinSsml = converterAcentoParaNumero(pinyinAcento);

  const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folder = DriveApp.getFolderById(FOLDER_ID);

  let nomeArquivo = `${HSK_PROJECT_ID}_${pinyinNumerico.replace(/\s+/g, "_")}.mp3`;
  salvarAudioNoDrive(folder, nomeArquivo, base64);
  aba.getRange(linha, 16).setValue(`[sound:${nomeArquivo}]`);

  console.log(`✅ Voz ${vozId} confirmada para linha ${linha}: ${nomeArquivo}`);
  return { sucesso: true, nomeArquivo };
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────

function abrirSidebarAudio() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_audio')
    .setTitle('🔊 Preview de Áudio');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getDadosLinhaAtual() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linha = aba.getActiveCell().getRow();
  const hanzi = aba.getRange(linha, 3).getValue();
  const pinyin = aba.getRange(linha, 4).getValue();
  const audioTag = aba.getRange(linha, 16).getValue();

  if (!hanzi) return { linha, hanzi: "", pinyin: "", audioBase64: null };

  if (!audioTag || !audioTag.toString().includes('[sound:')) {
    return { linha, hanzi, pinyin, audioBase64: null, status: "sem_audio" };
  }

  const nomeArquivo = audioTag.toString().replace('[sound:', '').replace(']', '');

  try {
    const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const arquivos = folder.getFilesByName(nomeArquivo);

    if (!arquivos.hasNext()) {
      return { linha, hanzi, pinyin, audioBase64: null, status: "arquivo_nao_encontrado", nomeArquivo };
    }

    const base64 = Utilities.base64Encode(arquivos.next().getBlob().getBytes());
    return { linha, hanzi, pinyin, audioBase64: base64, nomeArquivo, status: "ok" };
  } catch (e) {
    return { linha, hanzi, pinyin, audioBase64: null, status: "erro", erro: e.message };
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

// ─── MENU ────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('HSK Tools')
    .addItem('🔊 Abrir Preview de Áudio', 'abrirSidebarAudio')
    .addItem('🎵 Gerar Áudios (lote)', 'gerarAudioLote')
    .addToUi();
}