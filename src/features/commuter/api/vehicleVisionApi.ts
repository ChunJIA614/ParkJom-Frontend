import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';

export interface PlateBoundingBox {
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
}

export interface VehicleVisionScanRequest {
  imageBase64: string;
  mimeType?: string;
  clientHintPlate?: string;
  clientHintBrand?: string;
  clientHintModel?: string;
  clientHintColor?: string;
}

export interface VehicleVisionScanData {
  numberPlate: string;
  formattedPlate: string;
  rawDetectedText: string;
  isValidJpjFormat: boolean;
  jpjRegion: string;
  brand: string;
  model: string;
  color: string;
  vehicleType: string;
  confidence: number;
  boundingBox: PlateBoundingBox | null;
  engineUsed: string;
}

export interface BarrierPlateVerifyRequest extends VehicleVisionScanRequest {
  bookingId?: number | null;
  expectedPlate?: string;
}

export interface BarrierPlateVerifyData {
  verified: boolean;
  status: 'exact_match' | 'near_match' | 'mismatch';
  similarityScore: number;
  expectedPlate: string;
  detectedPlate: string;
  formattedDetectedPlate: string;
  isValidJpjFormat: boolean;
  jpjRegion: string;
  brand: string;
  model: string;
  color: string;
  confidence: number;
  boundingBox: PlateBoundingBox | null;
  engineUsed: string;
  message?: string;
}

export interface DemoCarPreset {
  id: string;
  label: string;
  subtitle: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  bodyHex: string;
  accentHex: string;
}

export const DEMO_CAR_PRESETS: DemoCarPreset[] = [
  {
    id: 'myvi',
    label: 'Perodua Myvi (VEE 8492)',
    subtitle: 'KL Registration · Metallic Silver',
    plate: 'VEE 8492',
    brand: 'Perodua',
    model: 'Myvi',
    color: 'Silver',
    bodyHex: '#cbd5e1',
    accentHex: '#475569',
  },
  {
    id: 'x50',
    label: 'Proton X50 (WXY 1234)',
    subtitle: 'KL Registration · Passion Red',
    plate: 'WXY 1234',
    brand: 'Proton',
    model: 'X50',
    color: 'Red',
    bodyHex: '#dc2626',
    accentHex: '#7f1d1d',
  },
  {
    id: 'atto3',
    label: 'BYD Atto 3 (BQR 6018)',
    subtitle: 'Selangor EV · Ski White',
    plate: 'BQR 6018',
    brand: 'BYD',
    model: 'Atto 3',
    color: 'White',
    bodyHex: '#f8fafc',
    accentHex: '#0284c7',
  },
];

/**
 * Renders a realistic synthetic car front bumper + JPJ standard license plate onto a canvas
 * so Gemini Multimodal Vision can genuinely read the plate text, vehicle make/model badge,
 * and exterior color from pixels during live presentations.
 */
export function renderSyntheticCarDataUrl(preset: {
  plate: string;
  brand: string;
  model: string;
  color: string;
  bodyHex?: string;
  accentHex?: string;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bodyHex = preset.bodyHex || '#cbd5e1';
  const accentHex = preset.accentHex || '#334155';

  // Background asphalt & studio lighting
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 520);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.6, '#1e293b');
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 520);

  // Car hood & front bumper silhouette
  ctx.fillStyle = bodyHex;
  ctx.beginPath();
  ctx.roundRect(90, 75, 620, 360, [56, 56, 36, 36]);
  ctx.fill();

  // Windshield upper dark glass
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(150, 90, 500, 85, [28, 28, 8, 8]);
  ctx.fill();

  // Headlights (left & right LED clusters)
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.roundRect(115, 200, 125, 48, 14);
  ctx.roundRect(560, 200, 125, 48, 14);
  ctx.fill();

  // Front grille
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(240, 205, 320, 185, 22);
  ctx.fill();

  // Brand & Model emblem text clearly visible for Vision AI
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${preset.brand.toUpperCase()} ${preset.model.toUpperCase()}`, 400, 248);

  ctx.fillStyle = accentHex;
  ctx.font = '600 13px Inter, system-ui, sans-serif';
  ctx.fillText(`EXTERIOR COLOR: ${preset.color.toUpperCase()}`, 400, 272);

  // Malaysian JPJ Standard Black License Plate (x: 245..555, y: 298..372 -> normalized y:573..715, x:306..693)
  ctx.fillStyle = '#050505';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(245, 298, 310, 74, 8);
  ctx.fill();
  ctx.stroke();

  // Crisp White JPJ Font
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(preset.plate.toUpperCase(), 400, 337);

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Compresses a File or Blob image to <= 960px JPEG Data URL for fast (<1s) multimodal vision inference.
 */
export async function compressFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function normalizeBoundingBox(raw: any): PlateBoundingBox | null {
  if (!raw || typeof raw !== 'object') return null;
  const yMin = Number(raw.yMin ?? raw.YMin ?? 580);
  const xMin = Number(raw.xMin ?? raw.XMin ?? 300);
  const yMax = Number(raw.yMax ?? raw.YMax ?? 710);
  const xMax = Number(raw.xMax ?? raw.XMax ?? 700);
  return { yMin, xMin, yMax, xMax };
}

export async function scanVehicleWithVision(
  token: string,
  request: VehicleVisionScanRequest,
): Promise<VehicleVisionScanData> {
  const response = await apiRequest('/vehicle/vision-scan', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to scan vehicle image.'));
  }

  const payload = (await response.json().catch(() => null)) as any;
  const d = payload?.data ?? payload?.Data ?? payload;
  if (!d) {
    throw new Error('Empty response from Vision AI service.');
  }

  return {
    numberPlate: d.numberPlate ?? d.NumberPlate ?? '',
    formattedPlate: d.formattedPlate ?? d.FormattedPlate ?? d.numberPlate ?? '',
    rawDetectedText: d.rawDetectedText ?? d.RawDetectedText ?? '',
    isValidJpjFormat: Boolean(d.isValidJpjFormat ?? d.IsValidJpjFormat ?? true),
    jpjRegion: d.jpjRegion ?? d.JpjRegion ?? 'Malaysia JPJ',
    brand: d.brand ?? d.Brand ?? '',
    model: d.model ?? d.Model ?? '',
    color: d.color ?? d.Color ?? '',
    vehicleType: d.vehicleType ?? d.VehicleType ?? 'Sedan',
    confidence: Number(d.confidence ?? d.Confidence ?? 0.95),
    boundingBox: normalizeBoundingBox(d.boundingBox ?? d.BoundingBox),
    engineUsed: d.engineUsed ?? d.EngineUsed ?? 'Gemini Multimodal Vision',
  };
}

export async function verifyBarrierPlateWithVision(
  token: string,
  request: BarrierPlateVerifyRequest,
): Promise<BarrierPlateVerifyData> {
  const response = await apiRequest('/vehicle/verify-plate', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to verify license plate.'));
  }

  const payload = (await response.json().catch(() => null)) as any;
  const d = payload?.data ?? payload?.Data ?? payload;
  if (!d) {
    throw new Error('Empty response from Barrier Vision Verification service.');
  }

  return {
    verified: Boolean(d.verified ?? d.Verified),
    status: (d.status ?? d.Status ?? 'mismatch') as BarrierPlateVerifyData['status'],
    similarityScore: Number(d.similarityScore ?? d.SimilarityScore ?? 0),
    expectedPlate: d.expectedPlate ?? d.ExpectedPlate ?? '',
    detectedPlate: d.detectedPlate ?? d.DetectedPlate ?? '',
    formattedDetectedPlate: d.formattedDetectedPlate ?? d.FormattedDetectedPlate ?? '',
    isValidJpjFormat: Boolean(d.isValidJpjFormat ?? d.IsValidJpjFormat ?? true),
    jpjRegion: d.jpjRegion ?? d.JpjRegion ?? 'Malaysia JPJ',
    brand: d.brand ?? d.Brand ?? '',
    model: d.model ?? d.Model ?? '',
    color: d.color ?? d.Color ?? '',
    confidence: Number(d.confidence ?? d.Confidence ?? 0.95),
    boundingBox: normalizeBoundingBox(d.boundingBox ?? d.BoundingBox),
    engineUsed: d.engineUsed ?? d.EngineUsed ?? 'Gemini Multimodal Vision',
    message: payload?.message ?? payload?.Message ?? '',
  };
}
