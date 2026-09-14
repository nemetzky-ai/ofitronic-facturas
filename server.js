const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.options('*', cors());
app.use(express.json({ limit: '32mb' }));

app.post('/leer-factura', async (req, res) => {
  try {
    const { image, mediaType } = req.body;

    if (!image || !mediaType) {
      return res.status(400).json({ ok: false, error: 'Faltan campos image o mediaType' });
    }

    const esPdf = String(mediaType).toLowerCase().includes('pdf');
    console.log(`Procesando ${esPdf ? 'PDF' : 'imagen'}: ${mediaType}, tamaño: ${image.length} chars`);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ERROR: ANTHROPIC_API_KEY no configurada');
      return res.status(500).json({ ok: false, error: 'API key no configurada' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            esPdf
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: image } }
              : { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
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
  "iva": monto del IVA en guaraníes como número entero, o null,
  "tasaIva": "5%" o "10%" o "Exento" o null,
  "ruc": "RUC del EMISOR con guion y dígito verificador, ej 80000519-8, o null",
  "cdc": "el CDC de 44 dígitos, sin espacios, o null"
}

Reglas importantes:
- El RUC que necesito es el del EMISOR de la factura, no el del cliente (Carmen Nemetz / 3717062-7 es el cliente, ignoralo).
- El CDC aparece en las facturas electrónicas al pie, cerca del QR, como un número largo de 44 dígitos agrupado en bloques. Devolvelo TODO junto sin espacios.
- "monto" es el TOTAL de la factura en guaraníes, entero, sin puntos ni comas.
- "iva" es el monto del IVA liquidado, entero. Si dice "TOTAL IVA 188.991", devolvé 188991.
- Si no podés leer algún campo con certeza, usá null.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log('Respuesta Anthropic:', JSON.stringify(data).substring(0, 200));
    
    if (data.error) {
      console.error('Error de Anthropic:', data.error);
      return res.status(500).json({ ok: false, error: data.error.message });
    }

    const text = data.content?.[0]?.text || '';
    console.log('Texto recibido:', text.substring(0, 200));
    
    let parsed;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!parsed) {
      return res.json({ ok: false, error: 'No se pudo parsear la respuesta: ' + text.substring(0, 100) });
    }

    console.log('Resultado:', JSON.stringify(parsed));
    res.json({ ok: true, data: parsed });

  } catch (err) {
    console.error('Error general:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Ofitronic API online', version: '1.3', acepta: ['imagen', 'pdf'] }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Ofitronic corriendo en puerto ${PORT}`));
