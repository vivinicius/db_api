const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');
const chromium = require('chromium'); // 🔥 Importa o Chromium instalado no projeto

require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 📌 Rota para correção de respostas com OpenAI
app.post('/corrigir', async (req, res) => {
  const { respostaUsuario, instrucao } = req.body;

  try {
    const instruction = `${instrucao}`;
    const prompt = `${respostaUsuario}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
    });

    res.json({ correção: completion.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Erro ao processar resposta:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao processar a resposta.' });
  }
});

// 📌 Rota do Puppeteer para capturar a página do Sicredi
app.get('/proxy-sicredi', async (req, res) => {
  try {
    console.log('Iniciando Puppeteer no Render...');

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: chromium.path, // 🔥 Usa o Chromium instalado no projeto
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
    await page.setDefaultNavigationTimeout(240000);

    console.log('Carregando página...');
    await page.goto('https://sicredi-desafio-qe.readme.io/reference/home', {
      waitUntil: 'networkidle0', // 🔥 Espera todos os scripts carregarem
    });

    console.log('Aguardando 5 segundos para garantir carregamento...');
    await page.waitForTimeout(5000);

    console.log('Fazendo scroll para carregar elementos dinâmicos...');
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });

    console.log('Aguardando mais 3 segundos para carregamento completo...');
    await page.waitForTimeout(3000);

    console.log('Capturando conteúdo renderizado...');
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
