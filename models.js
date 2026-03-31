function listarMeusModelos() {
  const API_KEY = 'AIzaSyCf2Aq3S7Ts51FJZ1CLGuC4eLnaYtUPRtM'; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const resposta = UrlFetchApp.fetch(url);
    const json = JSON.parse(resposta.getContentText());
    
    console.log("=== MODELOS DISPONÍVEIS PARA A SUA CHAVE ===");
    
    // Varre a lista e imprime apenas os que suportam geração de texto
    json.models.forEach(modelo => {
      if (modelo.supportedGenerationMethods && modelo.supportedGenerationMethods.includes("generateContent")) {
        console.log(`Nome para usar na URL: ${modelo.name}`);
      }
    });
    
  } catch (e) {
    console.log("Erro ao buscar a lista: " + e.message);
  }
}