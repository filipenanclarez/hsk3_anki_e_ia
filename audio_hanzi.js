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

// ─── ABRE O MODAL ────────────────────────────────────────────────────

function abrirModalAudioHanzi() {
  const aba   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  const indiceGeral    = aba.getRange(linha, 1).getValue();  // A
  const hanzi          = aba.getRange(linha, 3).getValue();  // C
  const pinyin         = aba.getRange(linha, 4).getValue();  // D
  const pinyinNumerico = aba.getRange(linha, 5).getValue();  // E
  const audioTag       = aba.getRange(linha, 16).getValue(); // P
  const idDefinitivo   = aba.getRange(linha, 18).getValue(); // R

  if (!hanzi) {
    SpreadsheetApp.getUi().alert('Selecione uma linha com dados.');
    return;
  }

  const nomeDefinitivo = audioTag
    ? audioTag.toString().replace('[sound:', '').replace(']', '')
    : '';

  let audioBase64 = '';
  if (idDefinitivo && idDefinitivo.toString().trim() !== '') {
    try {
      const arquivo = DriveApp.getFileById(idDefinitivo.toString());
      audioBase64 = Utilities.base64Encode(arquivo.getBlob().getBytes());
    } catch(e) {
      console.log('Erro ao buscar áudio definitivo: ' + e.message);
    }
  }

  const template = HtmlService.createTemplateFromFile('modal_hanzi');
  template.linha          = linha;
  template.hanzi          = hanzi;
  template.pinyin         = pinyin;
  template.pinyinNumerico = pinyinNumerico;
  template.nomeDefinitivo = nomeDefinitivo;
  template.idDefinitivo   = idDefinitivo || '';
  template.temAudio       = audioBase64 !== '';
  template.audioBase64    = audioBase64;

  const html = template.evaluate()
    .setWidth(440)
    .setHeight(560);

  SpreadsheetApp.getUi().showModalDialog(html, `🔊 ${hanzi} — ${pinyin}`);
}

// ─── GERAÇÃO EM LOTE ─────────────────────────────────────────────────

function gerarAudioHanziLote() {
  const inicio = new Date();
  const aba    = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linhaInicial  = aba.getActiveCell().getRow();
  const tamanhoDoLote = 5;

  const TTS_API_KEY = PropertiesService.getScriptProperties().getProperty('TTS_API_KEY');
  const FOLDER_ID   = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folder      = DriveApp.getFolderById(FOLDER_ID);
  const vozPadrao   = PropertiesService.getScriptProperties().getProperty('TTS_VOICE') || 'cmn-CN-Wavenet-A';
  const velocidade  = parseFloat(PropertiesService.getScriptProperties().getProperty('TTS_SPEED') || '0.85');

  // Range começa na coluna A (1), 18 colunas até R
  const valores = aba.getRange(linhaInicial, 1, tamanhoDoLote, 18).getValues();

  console.log(`Linha inicial: ${linhaInicial}`);

  for (let i = 0; i < valores.length; i++) {
    let indiceGeral    = valores[i][0];  // A
    let hanzi          = valores[i][2];  // C
    let pinyinNumerico = valores[i][4];  // E
    let idDefinitivo   = valores[i][17]; // R

    if (!hanzi || !pinyinNumerico || pinyinNumerico.toString().trim() === '') {
      console.log(`   Linha ${i}: pulada (rode gerarPinyinNumerico primeiro)`);
      continue;
    }
    if (idDefinitivo && idDefinitivo.toString().trim() !== '') {
      console.log(`   Linha ${i}: ${hanzi} já tem áudio definitivo, pulando`);
      continue;
    }

    let nomeDefinitivo = `${HSK_PROJECT_ID}_idx${indiceGeral}_${pinyinNumerico.replace(/\s+/g, '_')}.mp3`;
    let ssml = `<speak><phoneme alphabet="pinyin" ph="${pinyinNumerico}">${hanzi}</phoneme></speak>`;

    console.log(`   Gerando áudio para ${hanzi} (${pinyinNumerico}) com ${vozPadrao}...`);
    let audioBase64 = chamarGoogleTTS(ssml, TTS_API_KEY, vozPadrao, velocidade);

    if (!audioBase64) {
      console.log(`   ⚠️ Falha ao gerar áudio para ${hanzi}`);
      continue;
    }

    let arquivo = salvarAudioNoDrive(folder, nomeDefinitivo, audioBase64);
    aba.getRange(linhaInicial + i, 16).setValue(`[sound:${nomeDefinitivo}]`); // P
    aba.getRange(linhaInicial + i, 18).setValue(arquivo.getId());              // R
    console.log(`   ✅ ${hanzi} → ${nomeDefinitivo} (ID: ${arquivo.getId()})`);
  }

  console.log(`🎵 Lote finalizado em ${((new Date() - inicio) / 1000).toFixed(2)}s`);
}

// ─── GERAÇÃO DE PREVIEWS (chamado pelo modal) ────────────────────────

function gerarPreviewsHanzi(linha) {
  const aba            = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const indiceGeral    = aba.getRange(linha, 1).getValue();  // A
  const hanzi          = aba.getRange(linha, 3).getValue();  // C
  const pinyinNumerico = aba.getRange(linha, 5).getValue();  // E
  const idsSalvos      = aba.getRange(linha, 17).getValue(); // Q

  if (!hanzi || !pinyinNumerico || pinyinNumerico.toString().trim() === '') {
    return { erro: 'Pinyin numérico ausente. Rode gerarPinyinNumerico primeiro.' };
  }

  const TTS_API_KEY        = PropertiesService.getScriptProperties().getProperty('TTS_API_KEY');
  const PREVIEWS_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('AUDIO_PREVIEWS_FOLDER_ID');
  const folderPreviews     = DriveApp.getFolderById(PREVIEWS_FOLDER_ID);
  const velocidade         = parseFloat(PropertiesService.getScriptProperties().getProperty('TTS_SPEED') || '0.85');

  let nomeBase = `${HSK_PROJECT_ID}_idx${indiceGeral}_${pinyinNumerico.replace(/\s+/g, '_')}`;
  let ssml     = `<speak><phoneme alphabet="pinyin" ph="${pinyinNumerico}">${hanzi}</phoneme></speak>`;

  // Mapa de IDs já salvos: { sufixo: id }
  let mapaIds = {};
  if (idsSalvos && idsSalvos.toString().trim() !== '') {
    idsSalvos.toString().split('|').forEach(par => {
      let [sufixo, id] = par.split(':');
      if (sufixo && id) mapaIds[sufixo] = id;
    });
  }

  let previews    = [];
  let mapaIdsNovo = { ...mapaIds };

  for (let v of VOZES) {
    let nomeArquivo = `${nomeBase}_${v.sufixo}.mp3`;

    // Já tem ID salvo — busca base64 do Drive
    if (mapaIds[v.sufixo]) {
      console.log(`   Preview já existe: ${v.sufixo}`);
      try {
        let arquivo = DriveApp.getFileById(mapaIds[v.sufixo]);
        let base64  = Utilities.base64Encode(arquivo.getBlob().getBytes());
        previews.push({ sufixo: v.sufixo, vozLabel: v.label, base64, nomeArquivo, gerado: false });
      } catch(e) {
        console.log(`   ⚠️ Erro ao buscar preview ${v.sufixo}: ${e.message}`);
        previews.push({ sufixo: v.sufixo, vozLabel: v.label, base64: null, nomeArquivo, erro: 'Erro ao buscar arquivo' });
      }
      continue;
    }

    // Gera novo e salva na pasta de previews
    console.log(`   Gerando preview ${v.id} para ${hanzi}...`);
    let base64 = chamarGoogleTTS(ssml, TTS_API_KEY, v.id, velocidade);

    if (!base64) {
      console.log(`   ⚠️ Falha no TTS para ${v.id}`);
      previews.push({ sufixo: v.sufixo, vozLabel: v.label, base64: null, nomeArquivo, erro: 'Falha ao gerar' });
      continue;
    }

    let arquivo = salvarAudioNoDrive(folderPreviews, nomeArquivo, base64);
    mapaIdsNovo[v.sufixo] = arquivo.getId();

    let base64Final = Utilities.base64Encode(Utilities.base64Decode(base64));
    previews.push({ sufixo: v.sufixo, vozLabel: v.label, base64: base64Final, nomeArquivo, gerado: true });
  }

  // Salva IDs na coluna Q no formato "sufixo:id|sufixo:id|..."
  let valorQ = Object.entries(mapaIdsNovo).map(([s, id]) => `${s}:${id}`).join('|');
  aba.getRange(linha, 17).setValue(valorQ);

  return { previews };
}

// ─── CONFIRMAÇÃO DA VOZ ESCOLHIDA (chamado pelo modal) ───────────────

function confirmarVozHanzi(linha, sufixo) {
  const aba            = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const indiceGeral    = aba.getRange(linha, 1).getValue();  // A
  const pinyinNumerico = aba.getRange(linha, 5).getValue();  // E
  const idsSalvos      = aba.getRange(linha, 17).getValue(); // Q
  const idAnterior     = aba.getRange(linha, 18).getValue(); // R

  const FOLDER_ID         = PropertiesService.getScriptProperties().getProperty('AUDIO_FOLDER_ID');
  const folderDefinitivos = DriveApp.getFolderById(FOLDER_ID);

  // Encontra ID do preview escolhido
  let idPreview = null;
  if (idsSalvos && idsSalvos.toString().trim() !== '') {
    idsSalvos.toString().split('|').forEach(par => {
      let [s, id] = par.split(':');
      if (s === sufixo) idPreview = id;
    });
  }

  if (!idPreview) return { sucesso: false, erro: 'ID do preview não encontrado.' };

  let nomeDefinitivo = `${HSK_PROJECT_ID}_idx${indiceGeral}_${pinyinNumerico.replace(/\s+/g, '_')}.mp3`;

  // Remove definitivo anterior
  if (idAnterior && idAnterior.toString().trim() !== '') {
    try { DriveApp.getFileById(idAnterior.toString()).setTrashed(true); }
    catch(e) { console.log('Aviso ao remover anterior: ' + e.message); }
  }

  // Copia preview para pasta definitivos
  let arquivoPreview = DriveApp.getFileById(idPreview);
  let blob = arquivoPreview.getBlob().copyBlob();
  blob.setName(nomeDefinitivo);
  let novoArquivo = folderDefinitivos.createFile(blob);

  // Atualiza P e R
  aba.getRange(linha, 16).setValue(`[sound:${nomeDefinitivo}]`); // P
  aba.getRange(linha, 18).setValue(novoArquivo.getId());          // R

  console.log(`✅ Voz confirmada: ${sufixo} → ${nomeDefinitivo}`);
  return { sucesso: true, nomeDefinitivo, idDefinitivo: novoArquivo.getId() };
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
      method: "post", contentType: "application/json",
      payload: JSON.stringify(payload), muteHttpExceptions: true
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
  let blob = Utilities.newBlob(Utilities.base64Decode(base64), 'audio/mpeg', nomeArquivo);
  return folder.createFile(blob);
}