const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');

require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 📌 Rota do Puppeteer para capturar a página do Sicredi
app.get('/proxy-sicredi', async (req, res) => {
  try {
    console.log('Iniciando Puppeteer no Render...');

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/bin/chromium-browser', // 🔥 Caminho correto do Chromium
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
    await page.setDefaultNavigationTimeout(60000);

    await page.goto('https://sicredi-desafio-qe.readme.io/reference/home', {
      waitUntil: 'load',
    });

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
