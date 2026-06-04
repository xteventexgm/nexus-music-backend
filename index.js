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

// 3. ENDPOINT DE EXTRACCIÓN (El núcleo pesado: yt-dlp puro)
app.get('/api/stream', (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl || videoUrl === 'undefined' || !videoUrl.startsWith('http')) {
    return res.status(400).json({ error: 'La URL proporcionada no es válida.' });
  }

  console.log(`[Stream] Extrayendo audio con yt-dlp para: ${videoUrl}`);

  // Le decimos al celular que viene un flujo multimedia crudo
  res.setHeader('Content-Type', 'audio/mp4'); 
  res.setHeader('Transfer-Encoding', 'chunked');

  // Ejecutamos yt-dlp y capturamos el audio original
  const subprocess = youtubedl.exec(videoUrl, {
    format: 'bestaudio', // Trae el audio de mayor calidad sin gastar tiempo en conversiones
    output: '-',         // Símbolo mágico: Manda el archivo al stdout (consola) en lugar del disco duro
  }, { stdio: ['ignore', 'pipe', 'ignore'] });

  // Conectamos la salida de yt-dlp directamente a la respuesta del cliente
  subprocess.stdout.pipe(res);

  // Manejo de errores si el video está bloqueado globalmente
  subprocess.on('error', (error) => {
    console.error('Error interno de yt-dlp:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'No se pudo procesar el audio del video.' });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor encendido en el puerto ${PORT}`);
});