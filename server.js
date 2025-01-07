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
  const { pergunta, respostaUsuario } = req.body;

  try {
    const prompt = `
    Pergunta: ${pergunta}
    Resposta do usuário: ${respostaUsuario}
    Avalie a resposta do usuário. Indique se está correta e forneça explicações.
    Voce está avaliando um exercicio passado pra um candidado:
    Escrever Cenários em Gherkin para o Site Sauce Demo
    Neste exercício, o candidato deve criar um arquivo .feature com pelo menos 5 cenários usando a linguagem Gherkin para o site Sauce Demo.
    Esses cenários devem cobrir funcionalidades como login, logout, navegação e validações básicas.
    O objetivo é que o usuario copie o código abaixo e, com base no template inicial fornecido, escreva cenários adicionais para situações do site.
    Template inicial:
    Feature: Funcionalidades do site Sauce Demo

  # Cenário 1: Login com sucesso
  Scenario: Login com credenciais válidas
    Given que estou na página inicial
    When eu insiro o usuário "standard_user" e senha "secret_sauce"
    And clico no botão de login
    Then devo ser redirecionado para a página de produtos

  # Cenário 2: Login com credenciais inválidas
  Scenario: Login com credenciais inválidas
    Given que estou na página inicial
    When eu insiro o usuário "invalid_user" e senha "invalid_password"
    And clico no botão de login
    Then devo ver uma mensagem de erro dizendo "Epic sadface: Username and password do not match any user in this service."

    Lembrando que o usuario devera criar novos cenários e não enviar apenas os cenarios informados no template.
    Responda em no máximo 100 palavras. Não inclua justificativas adicionais.
    Responda tambem sempre em primeira pessoa.
    `;

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo', // Modelo atualizado
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

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
