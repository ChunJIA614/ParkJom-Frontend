import { RAPID_KL_LINE_COLORS } from '@/services/gtfsApi';

export interface CoverageRoute {
  id: string;
  name: string;
  shortName: string;
  category: string;
  color: string;
}

// The shape dataset uses aliases; links use the route API's canonical IDs.
const ROUTE_ALIASES: Record<string, string> = {
  KJL: 'KJ', AGL: 'AG', SPL: 'SP', PH: 'SP', KGL: 'KG', PYL: 'PY', MRL: 'MR', SAL: 'SA',
};

/** Both the public API and bundled map can supply the landing page catalogue. */
export function buildRouteCatalog(rows: Array<Record<string, unknown>>): CoverageRoute[] {
  const routes = new Map<string, CoverageRoute>();
  for (const row of rows) {
    const suppliedId = String(row.routeId ?? row.route_id ?? '').trim();
    const id = ROUTE_ALIASES[suppliedId.toUpperCase()] ?? suppliedId;
    const shortName = String(row.shortName ?? row.route_short_name ?? id).trim();
    if (!id) continue;
    const brand = RAPID_KL_LINE_COLORS[shortName.toUpperCase()] ?? RAPID_KL_LINE_COLORS[id.toUpperCase()];
    const name = brand?.name ?? String(row.routeName ?? row.route_name ?? id).trim();
    const key = name.toLowerCase();
    if (routes.has(key)) continue; // Map shapes contain both travel directions.
    const suppliedColor = String(row.color ?? row.route_color ?? '');
    routes.set(key, {
      id,
      name,
      shortName: shortName || id,
      category: brand?.category ?? String(row.category ?? 'Rail'),
      color: brand?.color ?? (/^#[\da-f]{6}$/i.test(suppliedColor) ? suppliedColor : '#244b6a'),
    });
  }
  return [...routes.values()];
}
