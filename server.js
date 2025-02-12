const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const puppeteer = require('puppeteer');

require('dotenv').config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 📌 Rota para corrigir respostas do usuário
app.post('/corrigir', async (req, res) => {
  const { respostaUsuario, instrucao } = req.body;

  try {
    const instruction = `${instrucao}`;
    const prompt = `${respostaUsuario}`;
  
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
    });

    res.json({ correção: completion.data.choices[0].message.content.trim() });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao processar a resposta.' });
  }
});

// 📌 Rota do Puppeteer para capturar a página do Sicredi
app.get('/proxy-sicredi', async (req, res) => {
  try {
    console.log('Iniciando Puppeteer no Render...');

    // Configuração para usar o Chrome instalado no sistema
    const browser = await puppeteer.launch({
      headless: 'new', 
      executablePath: '/usr/bin/google-chrome-stable', // Caminho para o Chrome instalado
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', 
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });

    const page = await browser.newPage();
    
    // Aumenta o tempo limite para evitar falhas no carregamento
    await page.setDefaultNavigationTimeout(60000);

    await page.goto('https://sicredi-desafio-qe.readme.io/reference/home', {
      waitUntil: 'load', // Espera a página carregar completamente
    });

    // Captura o HTML renderizado
    const content = await page.content();
    await browser.close();

    res.send(content);
  } catch (error) {
    console.error('Erro ao carregar página com Puppeteer:', error);
    res.status(500).json({ error: 'Erro ao carregar a página.' });
  }
});

// Inicialização do servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
