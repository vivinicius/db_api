const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config(); // Para usar variáveis de ambiente

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuração do OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // Use a variável de ambiente
});
const openai = new OpenAIApi(configuration);

app.post('/corrigir', async (req, res) => {
  const { pergunta, respostaUsuario } = req.body;
  try {
    const prompt = `
    Pergunta: ${pergunta}
    Resposta do usuário: ${respostaUsuario}
    Avalie a resposta do usuário. Indique se está correta e forneça explicações.
    `;

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é um avaliador de respostas de programação.' },
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
