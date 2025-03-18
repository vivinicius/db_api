const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
require('dotenv').config(); // Carrega as variáveis do .env

// Configuração do OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// === Função para buscar conteúdo do GitHub ===
async function getGitHubRepoContent(repoUrl) {
  try {
    console.log('Buscando conteúdo do repositório:', repoUrl);

    const match = repoUrl.match(/github\.com\/(.*?)\/(.*?)(\.git|$)/);
    if (!match) throw new Error('URL do repositório inválida.');

    const owner = match[1];
    const repo = match[2];

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    };

    console.log(`Buscando árvore de arquivos do repo ${owner}/${repo}...`);

    // Busca a árvore completa de arquivos (branch: main)
    const treeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
      headers,
    });

    console.log('Árvore de arquivos recuperada com sucesso.');

    const files = treeResponse.data.tree.filter(file =>
      file.type === 'blob' &&
      !file.path.includes('node_modules') &&
      !file.path.includes('.git') &&
      !file.path.includes('target') &&
      !file.path.includes('.idea') &&
      !file.path.endsWith('.log') &&
      !file.path.endsWith('.env')
    );    

    console.log(`Encontrados ${files.length} arquivos. Iniciando leitura...`);

    let fullContent = '';

    for (const file of files.slice(0, 20)) { // Limite inicial 20 arquivos
      console.log(`Lendo arquivo: ${file.path}`);
      const fileResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
        headers,
      });

      const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
      fullContent += `\n\n===== FILE: ${file.path} =====\n${content}\n`;
    }

    console.log('Todos os arquivos lidos com sucesso.');

    return fullContent;

  } catch (error) {
    console.error('Erro ao buscar conteúdo do GitHub:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
      console.error(error.stack);
    }
    throw new Error('Erro ao buscar conteúdo do GitHub.');
  }
}

// === Endpoint /corrigir ===
app.post('/corrigir', async (req, res) => {
  const { respostaUsuario, instrucao } = req.body;

  try {
    console.log('Recebido pedido para corrigir:', respostaUsuario);

    // Busca conteúdo do GitHub
    const repoContent = await getGitHubRepoContent(respostaUsuario);
    console.log('Conteúdo do repositório recuperado com sucesso.');

    const prompt = `
O seguinte é o conteúdo do repositório do usuário extraído arquivo por arquivo:
${repoContent}
    `;

    const instruction = `
${instrucao}
    `;

    console.log('Enviando para OpenAI...');

    // Chamada para OpenAI
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o', 
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    });

    console.log('Resposta da OpenAI recebida com sucesso.');

    res.json({ correção: completion.data.choices[0].message.content.trim() });

  } catch (error) {
    console.error('Erro ao corrigir:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
      console.error(error.stack);
    }
    res.status(500).json({ error: 'Erro ao corrigir a resposta.' });
  }
});

// Inicialização do servidor
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
