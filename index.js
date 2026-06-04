const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search');
const youtubedl = require('youtube-dl-exec');

const app = express();
app.use(cors());
app.use(express.json());

// 1. ENDPOINT DE PRUEBA
app.get('/', (req, res) => {
  res.json({ mensaje: '🎶 Backend de Nexus Music con yt-dlp funcionando!' });
});

// 2. ENDPOINT DE BÚSQUEDA (Scraping rápido, sin cuotas ni API Keys)
app.get('/api/buscar', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Falta el parámetro de búsqueda (q)' });

    const resultados = await ytSearch(query);
    
    const dataLimpia = resultados.videos.slice(0, 20).map(video => ({
      id: video.videoId,
      title: video.title,
      duration: video.timestamp, // Formato "3:45"
      url: video.url,
      thumbnail: video.thumbnail
    }));

    res.json(dataLimpia);
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ error: 'Error interno al buscar' });
  }
});

// 3. ENDPOINT DE EXTRACCIÓN (Blindado contra colapsos)
app.get('/api/stream', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl || videoUrl === 'undefined' || !videoUrl.startsWith('http')) {
    return res.status(400).json({ error: 'La URL proporcionada no es válida.' });
  }

  console.log(`[Stream] Extrayendo audio con yt-dlp para: ${videoUrl}`);

  res.setHeader('Content-Type', 'audio/mp4'); 
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    // Cambiamos el ignore por 'pipe' en el stderr para poder LEER el error de YouTube
    const subprocess = youtubedl.exec(videoUrl, {
      format: 'bestaudio',
      output: '-',
      noWarnings: true,
      noCallHome: true
    }, { stdio: ['ignore', 'pipe', 'pipe'] });

    // Conectamos el audio al cliente
    subprocess.stdout.pipe(res);

    // Capturamos la verdadera razón del bloqueo y la imprimimos en Render
    subprocess.stderr.on('data', (data) => {
      console.error(`[yt-dlp ERROR REAL]: ${data.toString()}`);
    });

    // Obligamos a Node.js a esperar y atrapar cualquier colapso de yt-dlp
    await subprocess;

  } catch (error) {
    console.error('[Protección] yt-dlp falló, pero el servidor sigue vivo.');
    if (!res.headersSent) {
      res.status(500).json({ error: 'YouTube bloqueó la descarga en el servidor.' });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor encendido en el puerto ${PORT}`);
});