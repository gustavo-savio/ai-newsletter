# AI & Tech Newsletter

Newsletter simples e minimalista com noticias sobre tecnologia e inteligencia artificial. Interface limpa com cards clicaveis, inspirada em layouts de newsletters modernas.

## Stack

- Node.js com Express
- News API (API gratuita de noticias)
- HTML + CSS puro no front-end

## Requisitos

- Node.js 18+
- API key da [NewsAPI](https://newsapi.org/) (gratuita)

## Setup

Crie o arquivo `.env` na raiz do projeto:

```
NEWS_API_KEY=sua_chave_aqui
```

Instale as dependencias e inicie o servidor:

```bash
npm install
npm start
```

Acesse `http://localhost:3000`.

## Estrutura

```
public/
  index.html      # Front-end (JS dinamico que renderiza os cards)
  styles.css      # Estilos
server.js         # Servidor Express + proxy para News API
```

## Como funciona

O servidor expoe `/api/news`, que faz proxy para a News API (categoria tecnologia, 10 headlines). O front-end consome esse endpoint e renderiza cada noticia em um card clicavel com imagem, titulo e descricao, abrindo a fonte original em nova aba.

## Status do projeto

Este projeto esta em desenvolvimento ativo e sera evoluído ao longo dos próximos dias com novas funcionalidades e melhorias.
