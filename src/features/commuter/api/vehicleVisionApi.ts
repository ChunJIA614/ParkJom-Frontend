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

export interface BarrierPlateVerifyRequest {
  imageBase64: string;
  mimeType?: string;
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
