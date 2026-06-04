const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search'); // Mantenemos yt-search porque busca rapidísimo sin bloqueos

const app = express();
app.use(cors());
app.use(express.json());

// 1. ENDPOINT DE PRUEBA
app.get('/', (req, res) => {
  res.json({ mensaje: '🎶 Backend de Nexus Music (Modo Proxy) funcionando!' });
});

// 2. ENDPOINT DE BÚSQUEDA
app.get('/api/buscar', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Falta el parámetro de búsqueda' });

    const resultados = await ytSearch(query);
    const dataLimpia = resultados.videos.slice(0, 20).map(video => ({
      id: video.videoId,
      title: video.title,
      duration: video.timestamp,
      url: video.url,
      thumbnail: video.thumbnail
    }));

    res.json(dataLimpia);
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ error: 'Error interno al buscar' });
  }
});

// 3. ENDPOINT DE EXTRACCIÓN (El Matchmaker Definitivo)
app.get('/api/stream', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl || videoUrl === 'undefined' || !videoUrl.startsWith('http')) {
    return res.status(400).json({ error: 'La URL proporcionada no es válida.' });
  }

  console.log(`[Stream] Buscando ruta segura de audio para: ${videoUrl}`);

  try {
    // Extraemos el ID
    let videoId = '';
    const u = new URL(videoUrl);
    if (u.hostname.includes('youtu.be')) {
      videoId = u.pathname.slice(1);
    } else {
      videoId = u.searchParams.get('v');
    }

    // Matriz de servidores comunitarios (Inmunes a Bots)
    const servidores = [
      'https://pipedapi.tokhmi.xyz',
      'https://pipedapi.syncpundit.io',
      'https://piped-api.garudalinux.org',
      'https://pipedapi.kavin.rocks'
    ];

    for (const base of servidores) {
      try {
        console.log(`Probando enlace con: ${base}...`);
        
        // Al usar fetch en Node.js, ignoramos todas las reglas molestas de CORS del celular
        const response = await fetch(`${base}/streams/${videoId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.audioStreams && data.audioStreams.length > 0) {
            const stream = data.audioStreams.find(s => s.mimeType.includes('m4a') || s.mimeType.includes('mp4')) || data.audioStreams[0];
            
            console.log(`¡Éxito! Redirigiendo el celular al audio...`);
            
            // LA MAGIA HTTP 302:
            // Le decimos al reproductor de tu celular: "El audio no está en Render, está en esta URL segura, ¡ve a buscarlo ahí!"
            // El celular (<audio> y el Descargador) seguirán la redirección de forma automática y transparente.
            return res.redirect(302, stream.url);
          }
        }
      } catch (e) {
        console.log(`Falló ${base}, saltando al siguiente...`);
      }
    }

    throw new Error('Todos los espejos fallaron.');

  } catch (error) {
    console.error('[Error] No se pudo obtener el audio:', error.message);
    res.status(500).json({ error: 'Error al conectar con los servidores de música.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor proxy encendido en el puerto ${PORT}`);
});