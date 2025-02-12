const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const proxy = require('express-http-proxy'); // Importa o proxy

require('dotenv').config();

// Configuração do OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Use uma variável de ambiente
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
  
    // Solicita resposta ao modelo GPT-4
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
    });

    // Retorna a resposta da API
    res.json({ correção: completion.data.choices[0].message.content.trim() });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao processar a resposta.' });
  }
});

// 📌 Adicionando Proxy Reverso para o site do Sicredi
app.use('/proxy', proxy('https://sicredi-desafio-qe.readme.io', {
  proxyReqOptDecorator(reqOpts) {
    reqOpts.headers['X-Frame-Options'] = 'ALLOWALL'; // Remove restrição do iframe (tentativa)
    return reqOpts;
  }
}));

// Inicialização do servidor
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
