const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/leer-factura', async (req, res) => {
  try {
    const { image, mediaType } = req.body;
    
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

    res.json({ ok: true, data: parsed });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Ofitronic API online' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
