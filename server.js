const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios'); // Importação do axios
require('dotenv').config();

// Configuração do OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== NOVA FUNÇÃO GitHub =====
async function getGitHubRepoContent(repoUrl) {
  try {
    const match = repoUrl.match(/github\.com\/(.*?)\/(.*?)(\.git|$)/);
    if (!match) throw new Error('URL do repositório inválida.');

    const owner = match[1];
    const repo = match[2];

    // Busca a árvore completa
    const treeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });

    const files = treeResponse.data.tree.filter(file =>
      file.type === 'blob' &&
      !file.path.includes('node_modules') &&
      !file.path.includes('.git') &&
      !file.path.endsWith('.md')
    );

    let fullContent = '';

    // Lê os arquivos (limite de 20 arquivos no início)
    for (const file of files.slice(0, 20)) {
      const fileResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
      });

      const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
      fullContent += `\n\n===== FILE: ${file.path} =====\n${content}\n`;
    }

    return fullContent;

  } catch (error) {
    console.error(error.message);
    throw new Error('Erro ao buscar conteúdo do GitHub.');
  }
}

// ===== ENDPOINT CORRIGIR ALTERADO =====
app.post('/corrigir', async (req, res) => {
  const { respostaUsuario, instrucao } = req.body;

  try {
    // Busca conteúdo do repositório
    const repoContent = await getGitHubRepoContent(respostaUsuario);

    const prompt = `
    O seguinte é o conteúdo do repositório do usuário extraído arquivo por arquivo:
    ${repoContent}
    `;

    const instruction = `
    ${instrucao}
    `;

    // OpenAI request
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
      max_tokens: 10000,
    });

    res.json({ correção: completion.data.choices[0].message.content.trim() });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Erro ao processar a resposta.' });
  }
});

// Inicialização do servidor
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));