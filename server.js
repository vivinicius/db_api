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

/* ===========================================
    Função para buscar conteúdo do GitHub
=========================================== */
async function getGitHubRepoContent(repoUrl) {
  try {
    console.log('Buscando conteúdo do repositório GitHub:', repoUrl);

    const match = repoUrl.match(/github\.com\/(.*?)\/(.*?)(\.git|$)/);
    if (!match) throw new Error('URL do repositório GitHub inválida.');

    const owner = match[1];
    const repo = match[2];

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    };

    // Busca a árvore completa de arquivos (branch: main)
    const treeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, { headers });

    const files = treeResponse.data.tree.filter(file =>
      file.type === 'blob' &&
      file.path !== '.git' && // Não ignora arquivos com .git no nome
      !file.path.startsWith('.git/') && // Só ignora o diretório .git
      !file.path.includes('node_modules') &&
      !file.path.includes('target') &&
      !file.path.includes('.idea') &&
      !file.path.endsWith('.log') &&
      !file.path.endsWith('.env') &&
      !file.path.endsWith('.gif') &&
      !file.path.endsWith('.png') &&
      !file.path.endsWith('.img')
    );    

    let fullContent = '';

    for (const file of files.slice(0, 50)) { // Limite de 50 arquivos
      console.log(`Lendo arquivo GitHub: ${file.path}`);
      const fileResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, { headers });
      const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
      fullContent += `\n\n===== FILE: ${file.path} =====\n${content}\n`;
    }
    
    console.log('Todos os arquivos lidos com sucesso (GitHub).');
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

/* ===========================================
    Função para buscar conteúdo do GitLab
=========================================== */
async function getGitLabRepoContent(repoUrl) {
  try {
    console.log('Buscando conteúdo do repositório GitLab:', repoUrl);

    const match = repoUrl.match(/gitlab\.com\/(.*?)(\.git|$)/);
    if (!match) throw new Error('URL do repositório GitLab inválida.');

    const projectPath = encodeURIComponent(match[1]);

    const headers = {
      'PRIVATE-TOKEN': process.env.GITLAB_TOKEN,
    };

    // Buscar branch padrão
    const projectInfo = await axios.get(`https://gitlab.com/api/v4/projects/${projectPath}`, { headers });
    const defaultBranch = projectInfo.data.default_branch;
    console.log(`Branch padrão detectado: ${defaultBranch}`);

    let fullContent = '';

    // Função recursiva para percorrer pastas
    async function processDirectory(path = '') {
      const response = await axios.get(`https://gitlab.com/api/v4/projects/${projectPath}/repository/tree`, {
        headers,
        params: {
          recursive: false,
          ref: defaultBranch,
          path: path,
        }
      });

      const items = response.data;

      for (const item of items) {
        // === FILTRO para ignorar pastas ou arquivos desnecessários ===
        if (
          item.path.startsWith('.git/') || // Apenas o diretório .git
          item.path === '.git' ||          // Diretório .git raiz
          item.path.includes('node_modules') ||
          item.path.includes('target') ||
          item.path.includes('.idea') ||
          item.path.includes('.jsons') ||
          item.path.endsWith('.log') ||
          item.path.endsWith('.lock') ||
          item.path.endsWith('.gif') ||
          item.path.endsWith('.png') ||
          item.path.endsWith('.img')
        ) {
          console.log(`Ignorando: ${item.path}`);
          continue;
        }
        

        if (item.type === 'blob') {
          console.log(`Lendo arquivo: ${item.path}`);
          const fileResponse = await axios.get(`https://gitlab.com/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(item.path)}/raw`, {
            headers,
            params: {
              ref: defaultBranch,
            }
          });
          const content = fileResponse.data;
          fullContent += `\n\n===== FILE: ${item.path} =====\n${content}\n`;
        } else if (item.type === 'tree') {
          // Se for pasta, chama recursivamente
          await processDirectory(item.path);
        }
      }
    }

    // Inicia a busca do root
    await processDirectory();

    console.log('Todos os arquivos lidos com sucesso (GitLab).');

    // === Limitar tamanho total enviado para OpenAI ===
    if (fullContent.length > 25000) { // Ajuste esse limite como quiser
      console.log('Conteúdo muito grande, truncando...');
      fullContent = fullContent.substring(0, 25000);
    }

    return fullContent;

  } catch (error) {
    console.error('Erro ao buscar conteúdo do GitLab:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
      console.error(error.stack);
    }
    throw new Error('Erro ao buscar conteúdo do GitLab.');
  }
}

/* ===========================================
          Endpoint /corrigir
=========================================== */
app.post('/corrigir', async (req, res) => {
  const { respostaUsuario, instrucao } = req.body;

  try {
    console.log('Recebido pedido para corrigir:', respostaUsuario);

    let repoContent = '';

    if (respostaUsuario.includes('github.com')) {
      repoContent = await getGitHubRepoContent(respostaUsuario);
    } else if (respostaUsuario.includes('gitlab.com')) {
      repoContent = await getGitLabRepoContent(respostaUsuario);
    } else {
      throw new Error('URL de repositório não suportada. Use GitHub ou GitLab.');
    }

    console.log('Conteúdo do repositório recuperado com sucesso.');

    const prompt = `
O seguinte é o conteúdo do repositório do usuário extraído arquivo por arquivo:
${repoContent}
    `;

    const instruction = `
${instrucao}
    `;

    console.log('Enviando para OpenAI...');

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

/* ===========================================
          Inicialização do servidor
=========================================== */
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
