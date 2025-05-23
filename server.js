const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
require('dotenv').config();

// === Configuração do OpenAI ===
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ===========================================
  Função centralizada para ignorar arquivos/pastas
=========================================== */
function shouldIgnoreFile(path) {
  return (
    path.startsWith('.git/') || path === '.git' ||
    path.includes('node_modules') ||
    path.includes('target') ||
    path.includes('.idea') ||
    path.includes('cypress/results') ||       // Ignora relatórios Cypress
    path.includes('coverage') ||              // Ignora pastas de coverage
    path.includes('dist') ||                  // Ignora builds front-end
    path.includes('build') ||                 // Idem
    path.includes('reports') ||               // Relatórios genéricos
    path.includes('__snapshots__') ||         // Teste visual / Jest
    path.includes('__image_snapshots__') ||
    path.includes('.nyc_output') ||
    path.includes('.vscode') ||
    path.endsWith('.log') ||
    path.endsWith('.lock') ||
    path.endsWith('.gif') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.svg') ||
    path.endsWith('.webp') ||
    path.endsWith('.ico') ||
    path.endsWith('.woff') ||
    path.endsWith('.woff2') ||
    path.endsWith('.ttf') ||
    path.endsWith('.eot') ||
    path.endsWith('.otf') ||
    path.endsWith('.mp4') ||
    path.endsWith('.webm') ||
    path.endsWith('.pdf') ||
    path.endsWith('.env') ||
    path.endsWith('.DS_Store') ||
    path.endsWith('.yarn') ||
    path.endsWith('.gz') ||
    path.endsWith('.zip') ||
    path.endsWith('.7z') ||
    path.endsWith('.tar') ||
    path.endsWith('.rar') ||
    path.endsWith('.exe') ||
    path.endsWith('.dll')
  );
}

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

    const treeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, { headers });

    const files = treeResponse.data.tree.filter(file =>
      file.type === 'blob' &&
      !shouldIgnoreFile(file.path)
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
        if (shouldIgnoreFile(item.path)) {
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
          await processDirectory(item.path);
        }
      }
    }

    await processDirectory();

    console.log('Todos os arquivos lidos com sucesso (GitLab).');

    // === Limitar tamanho total enviado para OpenAI (opcional) ===
    if (fullContent.length > 100000) {
      console.log('Conteúdo muito grande, truncando...');
      fullContent = fullContent.substring(0, 100000);
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
