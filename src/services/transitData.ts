export async function loadRailNetworkData(): Promise<{ lines: unknown; stops: unknown }> {
  const [linesResponse, stopsResponse] = await Promise.all([
    fetch('/data/kl_rail_lines.json'),
    fetch('/data/kl_rail_stops.json'),
  ]);

  if (!linesResponse.ok || !stopsResponse.ok) {
    throw new Error('Failed to fetch GTFS data');
  }

  const [lines, stops] = await Promise.all([
    linesResponse.json(),
    stopsResponse.json(),
  ]);

  return { lines, stops };
}

export async function loadRailStops(): Promise<unknown> {
  const response = await fetch('/data/kl_rail_stops.json');
  if (!response.ok) throw new Error('Failed to fetch rail stop data');
  return response.json();
}
