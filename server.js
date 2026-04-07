import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.static("public"));

app.get("/api/news", async (req, res) => {
  try {
    const url = `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=10&apiKey=${process.env.NEWS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar notícias" });
  }
});

app.listen(3000, () => {
  console.log("http://localhost:3000");
});