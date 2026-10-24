import {
  distanceMetersBetween,
  findConnectingBusRoutes,
  getRapidBusRoute,
  RapidBusRoute,
  RapidBusStop,
} from './rapidBusService';
import { RealtimeVehicle } from './gtfsRealtimeApi';
import stationData from '../features/commuter/data/mrt_lrt_stations.json';

export type JourneyLegMode = 'WALK' | 'BUS' | 'RAIL';
export type CommuterPreference = 'balanced' | 'less_walk' | 'fastest';

export interface JourneyStepInstruction {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  streetName?: string;
  icon?:
    | 'walk'
    | 'turn-left'
    | 'turn-right'
    | 'straight'
    | 'board-bus'
    | 'alight-bus'
    | 'station-entrance';
}

export interface JourneyLeg {
  legIndex: number;
  mode: JourneyLegMode;
  title: string;
  summary: string;
  fromName: string;
  fromCoords: { lat: number; lng: number };
  toName: string;
  toCoords: { lat: number; lng: number };
  distanceMeters: number;
  durationMinutes: number;
  geometry: [number, number][]; // [lat, lng] array
  steps: JourneyStepInstruction[];
  transitDetails?: {
    routeId: string;
    routeShortName: string;
    routeLongName: string;
    routeColor: string;
    headsign: string;
    numStops: number;
    boardingStopName: string;
    alightingStopName: string;
    intermediateStops: { name: string; lat: number; lng: number }[];
    liveVehicle?: {
      licensePlate: string;
      speedKmh: number;
      etaMinutes: number;
      distanceMeters?: number;
    };
  };
}

export interface GeneralizedCostBreakdown {
  totalCost: number; // J(r)
  timeCost: number; // T(r)
  walkBurdenCost: number; // lambda_w * W(r)
  transferCost: number; // lambda_x * X(r)
  uncertaintyCost: number; // lambda_u * U(r)
  fareCost: number; // lambda_c * C(r)
}

export interface MultimodalItinerary {
  id: string;
  title: string;
  subtitle: string;
  type: 'transit_feeder' | 'direct_walk';
  isRecommended: boolean;
  totalDurationMinutes: number;
  totalWalkDistanceMeters: number;
  totalTransitDistanceMeters: number;
  targetStationName: string;
  targetStationEntranceName: string;
  legs: JourneyLeg[];
  fullGeometry: [number, number][];
  bounds: [[number, number], [number, number]];
  savingsSummary?: string;
  costBreakdown: GeneralizedCostBreakdown;
  preference: CommuterPreference;
}

export interface CandidateStation {
  name: string;
  code: string;
  centroid: { lat: number; lng: number };
  entrance: { name: string; lat: number; lng: number };
  euclideanDistanceMeters: number;
}

export interface MultimodalPlanResult {
  origin: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
    exitCoords: { lat: number; lng: number };
    exitName: string;
  };
  candidateStations: CandidateStation[];
  recommendedItinerary: MultimodalItinerary;
  allItineraries: MultimodalItinerary[];
  preference: CommuterPreference;
}

// ── Weights for Generalized Cost Model J(r) ──
interface CostWeights {
  lambdaW: number; // Walk burden weight
  lambdaX: number; // Transfer penalty weight
  lambdaU: number; // Uncertainty weight
  lambdaC: number; // Monetary fare weight
}

const PREFERENCE_WEIGHTS: Record<CommuterPreference, CostWeights> = {
  balanced: {
    lambdaW: 1.2,
    lambdaX: 2.0,
    lambdaU: 1.0,
    lambdaC: 0.5,
  },
  less_walk: {
    lambdaW: 2.8,
    lambdaX: 1.0,
    lambdaU: 0.8,
    lambdaC: 0.5,
  },
  fastest: {
    lambdaW: 0.4,
    lambdaX: 1.5,
    lambdaU: 2.5,
    lambdaC: 0.2,
  },
};

function distSq(lat1: number, lon1: number, lat2: number, lon2: number) {
  return (lat1 - lat2) ** 2 + (lon1 - lon2) ** 2;
}

/**
 * Step 1: 确定停车位的真实起点 (Passable street exit rather than building center)
 */
export async function resolveParkingRealOrigin(origin: {
  name: string;
  lat: number;
  lng: number;
  address?: string;
}): Promise<{
  exitCoords: { lat: number; lng: number };
  exitName: string;
}> {
  try {
    const url = `https://router.project-osrm.org/nearest/v1/foot/${origin.lng},${origin.lat}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
        const wp = data.waypoints[0];
        const snappedLat = wp.location[1];
        const snappedLng = wp.location[0];
        const streetName = wp.name ? `via ${wp.name}` : 'Pedestrian Gate';
        return {
          exitCoords: { lat: snappedLat, lng: snappedLng },
          exitName: `${origin.name} (${streetName})`,
        };
      }
    }
  } catch (err) {
    console.debug('[MultimodalRouter] OSRM origin snap fallback:', err);
  }

  return {
    exitCoords: { lat: origin.lat, lng: origin.lng },
    exitName: `${origin.name} (Main Entrance)`,
  };
}

/**
 * Step 2: 找到候选 MRT/LRT 站点 (Spatial filtering & entrance determination)
 */
export function findCandidateTransitStations(
  originCoords: { lat: number; lng: number },
  targetStationHint?: string | null,
  maxCatchmentMeters = 3000,
): CandidateStation[] {
  const allStations = (stationData as any).features || [];
  const candidates: CandidateStation[] = [];

  for (const f of allStations) {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const sLat = coords[1];
    const sLng = coords[0];
    const rawName = String(f.properties?.name || f.properties?.['name:en'] || '');
    const cleanName = rawName
      .replace(/^(?:(?:AG|SP|KJ|KG|PY|MR|SA|KT|KB|KC|KA|KD)\d*\s*)+/i, '')
      .replace(/\s+(?:LRT|MRT|Station)$/i, '')
      .trim() || rawName;
    const ref = String(f.properties?.ref || '');

    const dist = distanceMetersBetween(originCoords.lat, originCoords.lng, sLat, sLng);
    const isTarget = targetStationHint && cleanName.toLowerCase().includes(targetStationHint.toLowerCase());

    if (dist <= maxCatchmentMeters || isTarget) {
      // Determine Station Entrance: Offset slightly towards pedestrian street link
      const entranceOffsetMeters = 25;
      const angle = Math.atan2(originCoords.lat - sLat, originCoords.lng - sLng);
      const entranceLat = sLat + (entranceOffsetMeters / 111320) * Math.sin(angle);
      const entranceLng =
        sLng + (entranceOffsetMeters / (111320 * Math.cos((sLat * Math.PI) / 180))) * Math.cos(angle);

      candidates.push({
        name: cleanName,
        code: ref,
        centroid: { lat: sLat, lng: sLng },
        entrance: {
          name: `${cleanName} - Entrance A (Pintu A)`,
          lat: entranceLat,
          lng: entranceLng,
        },
        euclideanDistanceMeters: Math.round(dist),
      });
    }
  }

  // Sort candidates: Target station first, then closest
  return candidates
    .sort((a, b) => {
      const aTarget = targetStationHint && a.name.toLowerCase().includes(targetStationHint.toLowerCase());
      const bTarget = targetStationHint && b.name.toLowerCase().includes(targetStationHint.toLowerCase());
      if (aTarget && !bTarget) return -1;
      if (!aTarget && bTarget) return 1;
      return a.euclideanDistanceMeters - b.euclideanDistanceMeters;
    })
    .slice(0, 3);
}

/**
 * Slices a road polyline geometry between two coordinate anchors.
 */
function slicePolylineBetween(
  coords: [number, number][],
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
): [number, number][] {
  if (!coords || coords.length === 0) {
    return [
      [p1.lat, p1.lng],
      [p2.lat, p2.lng],
    ];
  }

  let idx1 = 0;
  let minDist1 = Infinity;
  let idx2 = 0;
  let minDist2 = Infinity;

  for (let i = 0; i < coords.length; i++) {
    const d1 = distSq(coords[i][0], coords[i][1], p1.lat, p1.lng);
    if (d1 < minDist1) {
      minDist1 = d1;
      idx1 = i;
    }
    const d2 = distSq(coords[i][0], coords[i][1], p2.lat, p2.lng);
    if (d2 < minDist2) {
      minDist2 = d2;
      idx2 = i;
    }
  }

  if (idx1 <= idx2) {
    const slice = coords.slice(idx1, idx2 + 1);
    return slice.length > 0 ? slice : [[p1.lat, p1.lng], [p2.lat, p2.lng]];
  } else {
    const slice = coords.slice(idx2, idx1 + 1).reverse();
    return slice.length > 0 ? slice : [[p1.lat, p1.lng], [p2.lat, p2.lng]];
  }
}

/**
 * Fetch true pedestrian foot route via OSRM, with fallback.
 */
export async function getPedestrianWalkingRoute(
  start: { lat: number; lng: number; name?: string },
  end: { lat: number; lng: number; name?: string },
): Promise<{
  distanceMeters: number;
  durationMinutes: number;
  geometry: [number, number][];
  steps: JourneyStepInstruction[];
}> {
  const directDistance = distanceMetersBetween(start.lat, start.lng, end.lat, end.lng);

  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geom: [number, number][] = route.geometry.coordinates.map(
          ([lon, lat]: [number, number]) => [lat, lon] as [number, number],
        );

        const steps: JourneyStepInstruction[] = [];
        if (route.legs && route.legs[0]?.steps) {
          route.legs[0].steps.forEach((s: any) => {
            const maneuverType = s.maneuver?.type || 'turn';
            const modifier = s.maneuver?.modifier || '';
            const name = s.name ? `on ${s.name}` : '';
            let text = 'Walk straight';

            if (maneuverType === 'depart') {
              text = `Exit ${start.name || 'parking'} and proceed ${name}`.trim();
            } else if (maneuverType === 'arrive') {
              text = `Arrive at ${end.name || 'destination'}`;
            } else if (modifier.includes('left')) {
              text = `Turn left ${name}`.trim();
            } else if (modifier.includes('right')) {
              text = `Turn right ${name}`.trim();
            } else if (name) {
              text = `Continue ${name}`.trim();
            }

            steps.push({
              instruction: text,
              distanceMeters: Math.round(s.distance || 0),
              durationSeconds: Math.round(s.duration || 0),
              streetName: s.name || '',
              icon: modifier.includes('left')
                ? 'turn-left'
                : modifier.includes('right')
                ? 'turn-right'
                : 'walk',
            });
          });
        }

        return {
          distanceMeters: Math.round(route.distance),
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          geometry: geom.length > 0 ? geom : [[start.lat, start.lng], [end.lat, end.lng]],
          steps: steps.length > 0 ? steps : createFallbackSteps(start, end, directDistance),
        };
      }
    }
  } catch (err) {
    console.debug('[MultimodalRouter] OSRM fetch fallback:', err);
  }

  // Fallback: Average walk speed = 1.3 m/s (~4.7 km/h)
  const durationMins = Math.max(1, Math.round(directDistance / (1.3 * 60)));
  return {
    distanceMeters: Math.round(directDistance),
    durationMinutes: durationMins,
    geometry: [
      [start.lat, start.lng],
      [end.lat, end.lng],
    ],
    steps: createFallbackSteps(start, end, directDistance),
  };
}

function createFallbackSteps(
  start: { name?: string },
  end: { name?: string },
  distance: number,
): JourneyStepInstruction[] {
  return [
    {
      instruction: `Walk from ${start.name || 'parking bay'} towards ${end.name || 'destination'}`,
      distanceMeters: Math.round(distance),
      durationSeconds: Math.round(distance / 1.3),
      icon: 'walk',
    },
    {
      instruction: `Arrive at ${end.name || 'destination'} entrance`,
      distanceMeters: 0,
      durationSeconds: 0,
      icon: 'station-entrance',
    },
  ];
}

function computeBounds(
  coordinates: [number, number][],
): [[number, number], [number, number]] {
  if (!coordinates || coordinates.length === 0) {
    return [
      [3.13, 101.68],
      [3.14, 101.69],
    ];
  }
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  coordinates.forEach(([lat, lng]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Step 4: 广义成本模型计算 J(r)
 * J(r) = T(r) + lambda_w * W(r) + lambda_x * X(r) + lambda_u * U(r) + lambda_c * C(r)
 */
export function calculateGeneralizedCost(
  params: {
    totalDurationMinutes: number; // T(r)
    walkDistanceMeters: number; // For W(r)
    transferCount: number; // X(r)
    hasLiveTracking: boolean; // For U(r)
    liveEtaMinutes?: number;
    fareRm: number; // C(r)
  },
  preference: CommuterPreference = 'balanced',
): GeneralizedCostBreakdown {
  const weights = PREFERENCE_WEIGHTS[preference];

  // T(r): total duration
  const timeCost = params.totalDurationMinutes;

  // W(r): Walk burden. Normalized as walk distance / 100
  const W_r = params.walkDistanceMeters / 100;
  const walkBurdenCost = Number((weights.lambdaW * W_r).toFixed(2));

  // X(r): Transfer cost
  const X_r = params.transferCount;
  const transferCost = Number((weights.lambdaX * X_r).toFixed(2));

  // U(r): Uncertainty penalty
  let U_r = 0.5; // baseline walk
  if (params.transferCount > 0) {
    if (params.hasLiveTracking) {
      U_r = params.liveEtaMinutes && params.liveEtaMinutes <= 5 ? 1.0 : 2.5;
    } else {
      U_r = 5.0; // Static schedule penalty
    }
  }
  const uncertaintyCost = Number((weights.lambdaU * U_r).toFixed(2));

  // C(r): Fare cost
  const C_r = params.fareRm;
  const fareCost = Number((weights.lambdaC * C_r).toFixed(2));

  const totalCost = Number(
    (timeCost + walkBurdenCost + transferCost + uncertaintyCost + fareCost).toFixed(2),
  );

  return {
    totalCost,
    timeCost,
    walkBurdenCost,
    transferCost,
    uncertaintyCost,
    fareCost,
  };
}

/**
 * Complete Multimodal Route Generation Pipeline (OpenTripPlanner-inspired):
 * 1. Determine real origin
 * 2. Find candidate transit stations
 * 3. Generate candidate complete itineraries
 * 4. Score using Generalized Cost Model J(r)
 * 5. Output seamless linear journey
 */
export async function planMultimodalJourney(
  origin: { name: string; lat: number; lng: number; address?: string },
  destinationHint?: { name: string; lat: number; lng: number } | null,
  liveVehicles?: RealtimeVehicle[],
  preference: CommuterPreference = 'balanced',
): Promise<MultimodalPlanResult> {
  // 1. 确定真实起点 (Real passable street exit)
  const realOrigin = await resolveParkingRealOrigin(origin);

  // 2. 找到候选 MRT/LRT 站点 (Candidate stations)
  const candidateStations = findCandidateTransitStations(
    realOrigin.exitCoords,
    destinationHint?.name,
    3500,
  );

  const primaryStation = candidateStations[0] || {
    name: destinationHint?.name || 'Transit Station',
    code: 'STN',
    centroid: destinationHint || { lat: 3.0548, lng: 101.5919 },
    entrance: {
      name: `${destinationHint?.name || 'Station'} Entrance`,
      lat: destinationHint?.lat || 3.0548,
      lng: destinationHint?.lng || 101.5919,
    },
    euclideanDistanceMeters: 500,
  };

  const allItineraries: MultimodalItinerary[] = [];

  // 3. 为候选站点计算多种完整路线 (Generate candidate itineraries)
  for (const station of candidateStations.slice(0, 2)) {
    // ── Option A: 全程步行至车站入口 ──
    const directWalkData = await getPedestrianWalkingRoute(
      { ...realOrigin.exitCoords, name: realOrigin.exitName },
      station.entrance,
    );

    const directCost = calculateGeneralizedCost(
      {
        totalDurationMinutes: directWalkData.durationMinutes,
        walkDistanceMeters: directWalkData.distanceMeters,
        transferCount: 0,
        hasLiveTracking: true,
        fareRm: 0,
      },
      preference,
    );

    const directWalkLeg: JourneyLeg = {
      legIndex: 0,
      mode: 'WALK',
      title: 'Direct Walk',
      summary: `Walk ${directWalkData.distanceMeters}m directly to ${station.entrance.name}`,
      fromName: realOrigin.exitName,
      fromCoords: realOrigin.exitCoords,
      toName: station.entrance.name,
      toCoords: { lat: station.entrance.lat, lng: station.entrance.lng },
      distanceMeters: directWalkData.distanceMeters,
      durationMinutes: directWalkData.durationMinutes,
      geometry: directWalkData.geometry,
      steps: directWalkData.steps,
    };

    allItineraries.push({
      id: `itinerary-walk-${station.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: `Walk to ${station.name}`,
      subtitle: `${directWalkData.distanceMeters}m · ~${directWalkData.durationMinutes} min`,
      type: 'direct_walk',
      isRecommended: false,
      totalDurationMinutes: directWalkData.durationMinutes,
      totalWalkDistanceMeters: directWalkData.distanceMeters,
      totalTransitDistanceMeters: 0,
      targetStationName: station.name,
      targetStationEntranceName: station.entrance.name,
      legs: [directWalkLeg],
      fullGeometry: directWalkData.geometry,
      bounds: computeBounds(directWalkData.geometry),
      costBreakdown: directCost,
      preference,
    });

    // ── Option B: 停车位 → 步行 → 巴士接驳 → 步行 → 车站入口 ──
    const connectingRoutes = findConnectingBusRoutes(
      realOrigin.exitCoords,
      station.centroid,
      station.name,
      850,
      850,
    );

    if (connectingRoutes.length > 0) {
      const candidate = connectingRoutes[0];
      const route = candidate.route;
      const boardingStop = candidate.nearestStopToSpot?.stop;
      const alightingStop = candidate.nearestStopToStation?.stop;

      if (boardingStop && alightingStop && boardingStop.stopId !== alightingStop.stopId) {
        // Leg 1: Parking Exit ➔ Boarding Stop
        const leg1Walk = await getPedestrianWalkingRoute(
          { ...realOrigin.exitCoords, name: realOrigin.exitName },
          { lat: boardingStop.lat, lng: boardingStop.lon, name: `Bus Stop ${boardingStop.stopName}` },
        );

        const leg1: JourneyLeg = {
          legIndex: 0,
          mode: 'WALK',
          title: 'Walk to Bus Stop',
          summary: `Walk ${leg1Walk.distanceMeters}m to stop ${boardingStop.stopName}`,
          fromName: realOrigin.exitName,
          fromCoords: realOrigin.exitCoords,
          toName: boardingStop.stopName,
          toCoords: { lat: boardingStop.lat, lng: boardingStop.lon },
          distanceMeters: leg1Walk.distanceMeters,
          durationMinutes: leg1Walk.durationMinutes,
          geometry: leg1Walk.geometry,
          steps: leg1Walk.steps,
        };

        // Leg 2: Transit Feeder Bus from Boarding Stop to Alighting Stop
        const slicedBusCoords = slicePolylineBetween(
          route.coordinates,
          { lat: boardingStop.lat, lng: boardingStop.lon },
          { lat: alightingStop.lat, lng: alightingStop.lon },
        );

        // Intermediate stops
        let intermediateStops: { name: string; lat: number; lng: number }[] = [];
        if (route.stops && route.stops.length > 0) {
          const bIdx = route.stops.findIndex((s) => s.stopId === boardingStop.stopId);
          const aIdx = route.stops.findIndex((s) => s.stopId === alightingStop.stopId);
          if (bIdx !== -1 && aIdx !== -1) {
            const startIdx = Math.min(bIdx, aIdx);
            const endIdx = Math.max(bIdx, aIdx);
            intermediateStops = route.stops.slice(startIdx, endIdx + 1).map((s) => ({
              name: s.stopName,
              lat: s.lat,
              lng: s.lon,
            }));
          }
        }

        const numStops = Math.max(1, intermediateStops.length > 0 ? intermediateStops.length - 1 : 2);
        const busDistanceMeters = Math.round(
          distanceMetersBetween(boardingStop.lat, boardingStop.lon, alightingStop.lat, alightingStop.lon) * 1.35,
        );
        const busRideMinutes = Math.max(2, Math.round(numStops * 1.5));

        // Live GTFS-R Telemetry
        let liveVehicleMatch: JourneyLeg['transitDetails']['liveVehicle'] | undefined;
        if (liveVehicles && liveVehicles.length > 0) {
          const matchedVeh = liveVehicles.find(
            (v) => (v.routeId || '').trim().toUpperCase() === route.shortName.trim().toUpperCase(),
          );
          if (matchedVeh) {
            liveVehicleMatch = {
              licensePlate: matchedVeh.licensePlate || matchedVeh.vehicleId,
              speedKmh: Math.round(matchedVeh.speedKmh || 22),
              etaMinutes: matchedVeh.estimatedArrivalMinutes || 3,
              distanceMeters: matchedVeh.distanceMeters ? Math.round(matchedVeh.distanceMeters) : undefined,
            };
          }
        }

        const transitSteps: JourneyStepInstruction[] = [
          {
            instruction: `Board Rapid KL Route ${route.shortName} at stop ${boardingStop.stopName}`,
            distanceMeters: 0,
            durationSeconds: (liveVehicleMatch?.etaMinutes || 3) * 60,
            icon: 'board-bus',
          },
          {
            instruction: `Ride ${numStops} stop${numStops === 1 ? '' : 's'} towards ${station.name}`,
            distanceMeters: busDistanceMeters,
            durationSeconds: busRideMinutes * 60,
            icon: 'straight',
          },
          {
            instruction: `Alight at stop ${alightingStop.stopName}`,
            distanceMeters: 0,
            durationSeconds: 0,
            icon: 'alight-bus',
          },
        ];

        const leg2: JourneyLeg = {
          legIndex: 1,
          mode: 'BUS',
          title: `Bus ${route.shortName}`,
          summary: `Ride ${route.shortName} (${numStops} stops, ~${busRideMinutes} mins)`,
          fromName: boardingStop.stopName,
          fromCoords: { lat: boardingStop.lat, lng: boardingStop.lon },
          toName: alightingStop.stopName,
          toCoords: { lat: alightingStop.lat, lng: alightingStop.lon },
          distanceMeters: busDistanceMeters,
          durationMinutes: busRideMinutes,
          geometry: slicedBusCoords,
          steps: transitSteps,
          transitDetails: {
            routeId: route.routeId,
            routeShortName: route.shortName,
            routeLongName: route.longName,
            routeColor: route.color || '#008716',
            headsign: route.longName,
            numStops,
            boardingStopName: boardingStop.stopName,
            alightingStopName: alightingStop.stopName,
            intermediateStops,
            liveVehicle: liveVehicleMatch,
          },
        };

        // Leg 3: Alighting Stop ➔ Station Entrance
        const leg3Walk = await getPedestrianWalkingRoute(
          { lat: alightingStop.lat, lng: alightingStop.lon, name: `Bus Stop ${alightingStop.stopName}` },
          station.entrance,
        );

        const leg3: JourneyLeg = {
          legIndex: 2,
          mode: 'WALK',
          title: 'Walk to Station Entrance',
          summary: `Walk ${leg3Walk.distanceMeters}m to ${station.entrance.name}`,
          fromName: alightingStop.stopName,
          fromCoords: { lat: alightingStop.lat, lng: alightingStop.lon },
          toName: station.entrance.name,
          toCoords: { lat: station.entrance.lat, lng: station.entrance.lng },
          distanceMeters: leg3Walk.distanceMeters,
          durationMinutes: leg3Walk.durationMinutes,
          geometry: leg3Walk.geometry,
          steps: leg3Walk.steps,
        };

        // Step 5: 保证前一段终点与后一段起点正确衔接 (Continuous seamless stitching)
        const totalWalkDist = leg1Walk.distanceMeters + leg3Walk.distanceMeters;
        const waitTime = liveVehicleMatch?.etaMinutes || 3;
        const totalTransitDuration =
          leg1Walk.durationMinutes + waitTime + busRideMinutes + leg3Walk.durationMinutes;

        const combinedGeom: [number, number][] = [
          ...leg1.geometry,
          ...leg2.geometry,
          ...leg3.geometry,
        ];

        const savedWalkDist = Math.max(0, directWalkData.distanceMeters - totalWalkDist);
        const savingsText =
          savedWalkDist > 250
            ? `Saves ${(savedWalkDist / 1000).toFixed(1)}km walk`
            : undefined;

        // Step 4: 计算广义成本 J(r)
        const transitCost = calculateGeneralizedCost(
          {
            totalDurationMinutes: totalTransitDuration,
            walkDistanceMeters: totalWalkDist,
            transferCount: 1,
            hasLiveTracking: Boolean(liveVehicleMatch),
            liveEtaMinutes: liveVehicleMatch?.etaMinutes,
            fareRm: 1.0,
          },
          preference,
        );

        allItineraries.push({
          id: `itinerary-bus-${route.shortName.toLowerCase()}-${station.name.toLowerCase().replace(/\s+/g, '-')}`,
          title: `Bus ${route.shortName} + Walk`,
          subtitle: `~${totalTransitDuration} min · ${totalWalkDist}m walking`,
          type: 'transit_feeder',
          isRecommended: false,
          totalDurationMinutes: totalTransitDuration,
          totalWalkDistanceMeters: totalWalkDist,
          totalTransitDistanceMeters: busDistanceMeters,
          targetStationName: station.name,
          targetStationEntranceName: station.entrance.name,
          legs: [leg1, leg2, leg3],
          fullGeometry: combinedGeom,
          bounds: computeBounds(combinedGeom),
          savingsSummary: savingsText,
          costBreakdown: transitCost,
          preference,
        });
      }
    }
  }

  // Step 4: 根据广义成本 J(r) 升序排序，选择成本最低的最优路线
  allItineraries.sort((a, b) => a.costBreakdown.totalCost - b.costBreakdown.totalCost);

  if (allItineraries.length > 0) {
    allItineraries[0].isRecommended = true;
  }

  const recommendedItinerary = allItineraries[0];

  return {
    origin: {
      name: origin.name,
      lat: origin.lat,
      lng: origin.lng,
      address: origin.address,
      exitCoords: realOrigin.exitCoords,
      exitName: realOrigin.exitName,
    },
    candidateStations,
    recommendedItinerary,
    allItineraries,
    preference,
  };
}
