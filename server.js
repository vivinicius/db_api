const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');

require('dotenv').config();

// Configuração do OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Use uma variável de ambiente
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/corrigir', async (req, res) => {
  const {respostaUsuario, instrucao } = req.body;

  try {

    const instruction = `
    ${instrucao}
    `;

    const prompt = `
    ${respostaUsuario}
    `;
  
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo', // Modelo atualizado
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
    });

    res.json({ correção: completion.data.choices[0].message.content.trim() });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao processar a resposta.' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
