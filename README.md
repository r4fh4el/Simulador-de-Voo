# Cesium Flight Simulator (Custom Models)

Este projeto é um simulador de voo em **CesiumJS**, com controle via teclado e suporte para diferentes modelos de avião (`.glb`).

---

## 🚀 Requisitos

- [Node.js](https://nodejs.org/) (testado em versões recentes, como v22+)
- NPM (vem junto com o Node.js)
- Pacote [`http-server`](https://www.npmjs.com/package/http-server) (para servir os arquivos localmente)

---

## 🔧 Instalação

Clone este repositório ou copie os arquivos para uma pasta local.

Instale as dependências mínimas:

```bash
npm install

Instale o http-server de forma global:

npm install -g http-server


Na raiz do projeto, rode:

http-server .

✈️ Controles de Voo

W / S → inclina o nariz para cima/baixo (pitch)

A / D → gira à esquerda/direita (yaw/heading)

Q / E → rolagem (roll)

↑ / ↓ → acelera / desacelera

R / F → acelera / desacelera (atalhos alternativos)

Espaço → pausa / retoma o voo

Controles de calibração

N / M → ajusta offset do nariz em passos de 15°

T → troca o eixo considerado como “frente” do avião (+X, −X, +Y, −Y, +Z, −Z)

🛩️ Escolhendo o Modelo

Na seção do código main.js onde se define o modelo, troque a linha:

const MODEL_URL_FALLBACK = "cessna_a-37b.glb";

por:

const MODEL_URL_FALLBACK = "sky_fighter_military_jet.glb";


