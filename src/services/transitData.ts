import { getTransitLinesGeoJson, getTransitStopsGeoJson } from './gtfsApi';

/**
 * Load Klang Valley Rail Network GeoJSON data (lines and stops).
 * Uses the live backend GTFS API endpoints (/api/gtfs/geojson/lines, /api/gtfs/geojson/stops)
 * with graceful fallback to local data assets if offline.
 */
export async function loadRailNetworkData(): Promise<{ lines: unknown; stops: unknown }> {
  try {
    const [lines, stops] = await Promise.all([
      getTransitLinesGeoJson(),
      getTransitStopsGeoJson(),
    ]);
    return { lines, stops };
  } catch (error) {
    console.warn('[transitData] Backend GTFS GeoJSON request failed, falling back to local files:', error);

    const [linesResponse, stopsResponse] = await Promise.all([
      fetch('/data/kl_rail_lines.json'),
      fetch('/data/kl_rail_stops.json'),
    ]);

    if (!linesResponse.ok || !stopsResponse.ok) {
      throw new Error('Failed to fetch fallback GTFS data');
    }

    const [lines, stops] = await Promise.all([
      linesResponse.json(),
      stopsResponse.json(),
    ]);

    return { lines, stops };
  }
}

/**
 * Load rail stops GeoJSON directly.
 */
export async function loadRailStops(): Promise<unknown> {
  try {
    return await getTransitStopsGeoJson();
  } catch (error) {
    console.warn('[transitData] Backend GTFS stops request failed, falling back to local file:', error);
    const response = await fetch('/data/kl_rail_stops.json');
    if (!response.ok) throw new Error('Failed to fetch rail stop data');
    return response.json();
  }
}
