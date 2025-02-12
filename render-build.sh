#!/bin/bash
echo "Instalando Chromium no Render..."

# Atualiza os pacotes
apt-get update && apt-get install -y wget gnupg

# Instala o Chromium manualmente
apt-get install -y chromium-browser

echo "Chromium instalado com sucesso!"
