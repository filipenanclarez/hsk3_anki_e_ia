const API_KEY = 'AIzaSyCf2Aq3S7Ts51FJZ1CLGuC4eLnaYtUPRtM'; // <--- Coloque sua chave entre as aspas
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function gerarPinyinNumerico() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 1. Descobre a linha exata onde o seu cursor está clicado
  const linhaInicial = aba.getActiveCell().getRow();
  
  // 2. Define o limite do lote
  const tamanhoDoLote = 5; 
  
  // 3. Lê estritamente as 5 linhas da Coluna D (coluna 4), a partir do seu cursor
  const intervaloPinyin = aba.getRange(linhaInicial, 4, tamanhoDoLote, 1);
  const valoresPinyin = intervaloPinyin.getValues();
  
  console.log(`Iniciando lote de ${tamanhoDoLote} linhas a partir da linha ${linhaInicial}.`);
  
  for (let i = 0; i < valoresPinyin.length; i++) {
    let pinyinComAcento = valoresPinyin[i][0];
    let linhaDestino = linhaInicial + i;
    let celulaDestino = aba.getRange(linhaDestino, 5); // Coluna E
    
    // Só consome a API se houver dado na Coluna D e se a Coluna E estiver vazia
    if (pinyinComAcento !== "" && celulaDestino.getValue() === "") {
      console.log(`Processando linha ${linhaDestino}...`);
      
      let pinyinNumerico = chamarIA(pinyinComAcento);
      celulaDestino.setValue(pinyinNumerico);
      
    } else {
      console.log(`Linha ${linhaDestino} pulada (D vazia ou E já preenchida).`);
    }
  }
  
  console.log("Lote concluído.");
}

function chamarIA(texto) {
  // A regra de negócio atualizada no prompt
  const prompt = `Converta o Pinyin com acentos para Pinyin numérico. 
  Regras de tom: 1º=1, 2º=2, 3º=3, 4º=4. 
  ATENÇÃO: Para o tom neutro, NÃO coloque número (exemplo: mā ma -> ma1 ma).
  Sempre separe as sílabas com um espaço.
  Retorne APENAS o JSON: {"resultado": "valor"}. 
  Entrada: ${texto}`;

  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": { "temperature": 0.1 }
  };

  const opcoes = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const resposta = UrlFetchApp.fetch(API_URL, opcoes);
    const codigoStatus = resposta.getResponseCode();
    const textoResposta = resposta.getContentText();
    
    if (codigoStatus !== 200) {
      console.log(`Erro da API: ${textoResposta}`);
      return "Erro de API";
    }

    const json = JSON.parse(textoResposta);
    
    if (!json.candidates || !json.candidates[0].content) {
      return "Erro de Formato";
    }

    const saidaBruta = json.candidates[0].content.parts[0].text;
    const jsonLimpo = saidaBruta.replace(/```json|```/g, "").trim();
    let resultadoBruto = JSON.parse(jsonLimpo).resultado;
    
    // A Regex continua aqui: se a IA por acaso cuspir "ba4ba", 
    // ela acha o "4" colado no "b" e separa para "ba4 ba".
    const pinyinFormatado = resultadoBruto.replace(/(\d)(?=[a-zA-Z])/g, "$1 ").replace(/\s+/g, " ").trim();
    
    return pinyinFormatado;
    
  } catch (e) {
    console.log("Erro: " + e.message);
    return "Erro Interno";
  }
}