/**
 * The catalog is intentionally kept behind a small, replaceable contract.
 *
 * This fallback is a manually maintained list of common Malaysian makes and
 * models. It is not a copy of a third-party website catalog. Production can
 * replace it with the response from GET /vehicle/catalog (see
 * vehicleCatalogApi.ts) after the backend has refreshed an approved source.
 */
export interface VehicleCatalogEntry {
  brand: string;
  models: string[];
}

export const VEHICLE_CATALOG_FALLBACK: VehicleCatalogEntry[] = [
  {
    brand: 'Perodua',
    models: ['Axia', 'Alza', 'Aruz', 'Ativa', 'Bezza', 'Myvi', 'Viva'],
  },
  {
    brand: 'Proton',
    models: ['Saga', 'Persona', 'Iriz', 'Exora', 'X50', 'X70', 'X90', 'S70'],
  },
  {
    brand: 'Toyota',
    models: [
      'Vios', 'Yaris', 'Camry', 'Corolla Altis', 'Corolla Cross', 'Fortuner',
      'Hilux', 'Innova', 'Avanza', 'Alphard', 'Vellfire', 'Rush', 'Sienta',
    ],
  },
  {
    brand: 'Honda',
    models: ['City', 'Civic', 'Accord', 'CR-V', 'HR-V', 'BR-V', 'WR-V', 'Jazz', 'Odyssey'],
  },
  {
    brand: 'Nissan',
    models: ['Almera', 'Serena', 'X-Trail', 'Navara', 'Sylphy', 'Teana', 'Kicks'],
  },
  {
    brand: 'Mazda',
    models: ['Mazda 2', 'Mazda 3', 'CX-3', 'CX-30', 'CX-5', 'CX-8', 'MX-5'],
  },
  {
    brand: 'BMW',
    models: ['2 Series', '3 Series', '5 Series', 'X1', 'X3', 'X5', 'iX1'],
  },
  {
    brand: 'Mercedes-Benz',
    models: ['A-Class', 'C-Class', 'E-Class', 'GLA', 'GLC'],
  },
  {
    brand: 'Volkswagen',
    models: ['Polo', 'Vento', 'Jetta', 'Passat', 'Golf', 'Tiguan'],
  },
  {
    brand: 'Hyundai',
    models: ['i10', 'i20', 'Elantra', 'Kona', 'Tucson', 'Santa Fe'],
  },
  {
    brand: 'Kia',
    models: ['Picanto', 'Rio', 'Cerato', 'Seltos', 'Sportage', 'Sorento', 'Carnival'],
  },
  {
    brand: 'Mitsubishi',
    models: ['Attrage', 'ASX', 'Outlander', 'Triton', 'Xpander'],
  },
  {
    brand: 'Subaru',
    models: ['XV', 'Forester', 'BRZ', 'Outback'],
  },
  {
    brand: 'Isuzu',
    models: ['D-Max', 'MU-X'],
  },
  {
    brand: 'Ford',
    models: ['Ranger', 'Everest', 'Mustang', 'Fiesta'],
  },
  {
    brand: 'BYD',
    models: ['Atto 3', 'Dolphin', 'Seal', 'Sealion 7'],
  },
  {
    brand: 'Tesla',
    models: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  },
  {
    brand: 'MG',
    models: ['ZS', 'HS', '4', '5'],
  },
  {
    brand: 'Lexus',
    models: ['ES', 'NX', 'RX', 'UX'],
  },
  {
    brand: 'Volvo',
    models: ['XC40', 'XC60', 'XC90', 'S60'],
  },
];
