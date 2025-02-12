#!/bin/bash
echo "Instalando Chrome no Render..."

# Atualiza os pacotes
apt-get update && apt-get install -y wget gnupg

# Adiciona a chave do repositório do Google Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -

# Adiciona o repositório do Google Chrome
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list

# Instala o Google Chrome
apt-get update && apt-get install -y google-chrome-stable

echo "Chrome instalado com sucesso!"
