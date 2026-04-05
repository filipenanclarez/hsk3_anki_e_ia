/**
 * Módulo de Áudio - Geração TTS e Preview via Sidebar
 */

const VOZES = [
  { id: 'cmn-CN-Wavenet-A', label: 'Wavenet A (feminina)' },
  { id: 'cmn-CN-Wavenet-B', label: 'Wavenet B (masculina)' },
  { id: 'cmn-CN-Wavenet-C', label: 'Wavenet C (feminina)' },
  { id: 'cmn-CN-Wavenet-D', label: 'Wavenet D (masculina)' }
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
    let pinyinAcento = valores[i][1];
    let audioExistente = valores[i][13];

    if (!hanzi || !pinyinAcento || pinyinAcento.toString().trim() === "") {
      console.log(`   Linha ${i}: pulada (sem hanzi ou pinyin)`);
      continue;
    }
    if (audioExistente && audioExistente.toString().trim() !== "") {
      console.log(`   Linha ${i}: ${hanzi} já tem áudio, pulando`);
      continue;
    }

    let pinyinSsml = converterAcentoParaNumero(pinyinAcento);
    let ssml = `<speak><phoneme alphabet="pinyin" ph="${pinyinSsml.replace(/\s+/g, "")}">${hanzi}</phoneme></speak>`;

    console.log(`   Gerando áudio para ${hanzi} (${pinyinSsml}) com ${vozPadrao}...`);
    let audioBase64 = chamarGoogleTTS(ssml, TTS_API_KEY, vozPadrao, velocidade);

    if (!audioBase64) {
      console.log(`   ⚠️ Falha ao gerar áudio para ${hanzi}`);
      continue;
    }

    let nomeArquivo = `hsk_${pinyinSsml.replace(/\s+/g, "_")}.mp3`;
    salvarAudioNoDrive(folder, nomeArquivo, audioBase64);
    aba.getRange(linhaInicial + i, 16).setValue(`[sound:${nomeArquivo}]`);
    console.log(`   ✅ ${hanzi} → ${nomeArquivo}`);
  }

  console.log(`🎵 Áudios gerados em ${((new Date() - inicio) / 1000).toFixed(2)}s`);
}

// ─── GERAÇÃO DE ALTERNATIVAS (chamada pela sidebar) ──────────────────

function gerarAudiosAlternativos(linha) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const hanzi = aba.getRange(linha, 3).getValue();
  const pinyinAcento = aba.getRange(linha, 4).getValue();

  if (!hanzi || !pinyinAcento) return { erro: "Linha sem hanzi ou pinyin." };

  const TTS_API_KEY = PropertiesService.getScriptProperties().getProperty('TTS_API_KEY');
  const velocidade = parseFloat(PropertiesService.getScriptProperties().getProperty('TTS_SPEED') || '0.85');
  const pinyinSsml = converterAcentoParaNumero(pinyinAcento);
  const ssml = `<speak><phoneme alphabet="pinyin" ph="${pinyinSsml.replace(/\s+/g, "")}">${hanzi}</phoneme></speak>`;

  let alternativas = [];
  for (let v of VOZES) {
    console.log(`   Gerando alternativa ${v.id} para ${hanzi}...`);
    let base64 = chamarGoogleTTS(ssml, TTS_API_KEY, v.id, velocidade);
    alternativas.push({
      vozId: v.id,
      vozLabel: v.label,
      base64: base64 || null,
      erro: base64 ? null : "Falha ao gerar"
    });
  }

  return { hanzi, pinyin: pinyinAcento, pinyinSsml, alternativas };
}

// ─── CONFIRMAÇÃO DA VOZ ESCOLHIDA (chamada pela sidebar) ─────────────

function confirmarVozEscolhida(linha, vozId, base64) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const pinyinAcento = aba.getRange(linha, 4).getValue();
  const pinyinSsml = converterAcentoParaNumero(pinyinAcento);

  const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folder = DriveApp.getFolderById(FOLDER_ID);

  let nomeArquivo = `hsk_${pinyinSsml.replace(/\s+/g, "_")}.mp3`;
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

function converterAcentoParaNumero(pinyin) {
  const mapaVogais = {
    'ā':'a1','á':'a2','ǎ':'a3','à':'a4',
    'ē':'e1','é':'e2','ě':'e3','è':'e4',
    'ī':'i1','í':'i2','ǐ':'i3','ì':'i4',
    'ō':'o1','ó':'o2','ǒ':'o3','ò':'o4',
    'ū':'u1','ú':'u2','ǔ':'u3','ù':'u4',
    'ǖ':'v1','ǘ':'v2','ǚ':'v3','ǜ':'v4',
    'ü':'v'
  };

  return pinyin.split(/\s+/).map(silaba => {
    let resultado = silaba;
    let tom = '';
    for (let [acento, substituicao] of Object.entries(mapaVogais)) {
      if (resultado.includes(acento)) {
        tom = substituicao.slice(-1);
        resultado = resultado.replace(acento, substituicao.slice(0, -1));
        break;
      }
    }
    return resultado + tom;
  }).join(' ');
}

// ─── MENU ────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('HSK Tools')
    .addItem('🔊 Abrir Preview de Áudio', 'abrirSidebarAudio')
    .addItem('🎵 Gerar Áudios (lote)', 'gerarAudioLote')
    .addToUi();
}