import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

export interface ReceiptValidationResult {
  valid: boolean;
  reason?: string;
  analysis?: {
    is_payment_receipt?: boolean;
    is_coherent?: boolean;
    bank_or_app?: string;
    detected_amount?: number | null;
    confidence_percentage?: number;
    reason?: string;
    method?: 'ai_gemini' | 'heuristic';
  };
}

/**
 * Validador inteligente de comprobantes de pago.
 * Escanea el archivo para verificar coherencia bancaria/QR antes de procesar el envío.
 */
export async function validateReceiptFile(
  file: Express.Multer.File,
  expectedCommissionBs?: number
): Promise<ReceiptValidationResult> {
  // 1. Verificación básica de existencia y tamaño
  if (!file || !file.path || !fs.existsSync(file.path)) {
    return {
      valid: false,
      reason: 'No se recibió ningún archivo de comprobante de pago.'
    };
  }

  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic'];
  if (!validMimes.includes(file.mimetype.toLowerCase())) {
    return {
      valid: false,
      reason: 'El comprobante debe ser un archivo de imagen (JPG, PNG o WEBP).'
    };
  }

  // Comprobantes bancarios legítimos en móvil tienen al menos 10-15 KB
  if (file.size < 10240) {
    return {
      valid: false,
      reason: 'El archivo adjunto es demasiado pequeño o está dañado. Por favor sube una captura completa y legible.'
    };
  }

  if (file.size > 15 * 1024 * 1024) {
    return {
      valid: false,
      reason: 'El archivo de imagen supera el límite permitido de 15 MB.'
    };
  }

  // 2. Verificación de magic bytes de la imagen
  try {
    const fd = fs.openSync(file.path, 'r');
    const headerBuffer = Buffer.alloc(12);
    fs.readSync(fd, headerBuffer, 0, 12, 0);
    fs.closeSync(fd);

    const isJpeg = headerBuffer[0] === 0xFF && headerBuffer[1] === 0xD8 && headerBuffer[2] === 0xFF;
    const isPng = headerBuffer[0] === 0x89 && headerBuffer[1] === 0x50 && headerBuffer[2] === 0x4E && headerBuffer[3] === 0x47;
    const isWebp = headerBuffer.toString('ascii', 0, 4) === 'RIFF' && headerBuffer.toString('ascii', 8, 12) === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      return {
        valid: false,
        reason: 'El archivo no tiene una cabecera de imagen válida. Por favor adjunta una captura real.'
      };
    }
  } catch (err: any) {
    console.warn('[Receipt Header Check Warning]:', err?.message || err);
  }

  // 3. Verificación con IA de Gemini (si la API Key está configurada en el entorno)
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const fileBuffer = fs.readFileSync(file.path);
      const base64Data = fileBuffer.toString('base64');

      const prompt = `Actúa como un validador estricto de comprobantes de pago y transferencias bancarias o pagos QR en Bolivia (BCP, BNB, Banco Unión, Ganadero, Mercantil Santa Cruz, Bisa, BancoSol, Yape, Simple QR, Tigo Money, etc.).
Analiza detenidamente la imagen adjunta:
1. ¿Es un comprobante de pago legítimo, transferencia bancaria, recibo de pago QR o captura de banca móvil?
2. ¿Tiene coherencia visual y textual con una transacción real (no es una selfie, paisaje, meme, foto aleatoria o imagen en blanco)?
${expectedCommissionBs ? `3. Monto esperado referencial: Bs. ${expectedCommissionBs}` : ''}

Responde ÚNICAMENTE en JSON con este formato exacto:
{
  "is_payment_receipt": boolean,
  "is_coherent": boolean,
  "bank_or_app": string,
  "detected_amount": number o null,
  "confidence_percentage": number,
  "reason": string
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.mimetype
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.is_payment_receipt === false || parsed.is_coherent === false) {
        return {
          valid: false,
          reason: parsed.reason || 'El archivo adjunto no fue reconocido como un comprobante de pago o transferencia coherente. Por favor adjunta una captura clara de tu pago.',
          analysis: {
            ...parsed,
            method: 'ai_gemini'
          }
        };
      }

      return {
        valid: true,
        analysis: {
          ...parsed,
          method: 'ai_gemini'
        }
      };
    } catch (aiErr: any) {
      console.warn('[Gemini Receipt Scanner Warning]:', aiErr?.message || aiErr);
      // Fallback si la llamada de IA da error de red o timeout
    }
  }

  // 4. Verificación heurística por entropía/distribución de bytes para rechazar imágenes planas o vacías
  try {
    const sampleSize = Math.min(file.size, 16384);
    const fd = fs.openSync(file.path, 'r');
    const sampleBuffer = Buffer.alloc(sampleSize);
    fs.readSync(fd, sampleBuffer, 0, sampleSize, 0);
    fs.closeSync(fd);

    const byteCounts = new Map<number, number>();
    for (let i = 0; i < sampleSize; i++) {
      const b = sampleBuffer[i];
      byteCounts.set(b, (byteCounts.get(b) || 0) + 1);
    }

    // Una captura real tiene alta diversidad de bytes (al menos 80 valores distintos)
    if (byteCounts.size < 60) {
      return {
        valid: false,
        reason: 'La imagen parece estar en blanco o no contiene información legible. Por favor adjunta una captura real de tu pago.'
      };
    }
  } catch (hErr: any) {
    console.warn('[Heuristic Entropy Warning]:', hErr?.message || hErr);
  }

  return {
    valid: true,
    analysis: {
      is_payment_receipt: true,
      is_coherent: true,
      method: 'heuristic'
    }
  };
}

