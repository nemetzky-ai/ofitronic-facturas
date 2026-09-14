const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: ['https://nemetzky-ai.github.io', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

app.post('/leer-factura', async (req, res) => {
  try {
    const { image, mediaType } = req.body;
    
    if (!image || !mediaType) {
      return res.status(400).json({ ok: false, error: 'Faltan campos image o mediaType' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image }
            },
            {
              type: 'text',
              text: `Sos un asistente de contabilidad paraguaya. Analizá esta factura y extraé los datos. Respondé SOLO con un JSON válido, sin texto adicional, sin backticks.

El JSON debe tener exactamente estos campos:
{
  "fecha": "YYYY-MM-DD o null",
  "proveedor": "razón social del emisor o null",
  "nroFactura": "número de factura formato 000-000-0000000 o null",
  "timbrado": "número de timbrado o null",
  "monto": número entero en guaraníes o null,
  "tipoPago": "Contado" o "Crédito" o null,
  "tipoFactura": "Electrónica" o "Física",
  "iva": "5%" o "10%" o "Exento" o null
}

Si no podés leer algún campo con certeza, usá null. El monto debe ser el TOTAL en guaraníes sin puntos ni comas.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    let parsed;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    console.log('Factura procesada:', parsed?.proveedor || 'sin proveedor');
    res.json({ ok: true, data: parsed });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Ofitronic API online', version: '1.1' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Ofitronic corriendo en puerto ${PORT}`));
