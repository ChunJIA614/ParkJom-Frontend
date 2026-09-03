import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  AccessOverrideResult,
  AssignIncidentInput,
  CreateOperationalIncidentInput,
  ExecuteAccessOverrideInput,
  OperationalIncidentDetail,
  OperationalIncidentItem,
  OperationalIncidentListResponse,
  SupportTicket,
  TransitionIncidentInput,
} from '../types';
import { normalizeTicket } from './supportTicketService';

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    success?: boolean;
    message?: string;
    data?: T;
  } | null;

  if (!payload || payload.success === false || payload.data === undefined) {
    throw new Error(payload?.message || fallback);
  }
  return payload.data;
}

/**
 * 1. Create Operational Incident
 * POST /api/admin/support/incidents
 */
export async function createOperationalIncident(
  token: string,
  input: CreateOperationalIncidentInput,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest('/admin/support/incidents', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority || 'P0',
      incidentType: input.incidentType || 'GateOffline',
      propertyId: input.propertyId ?? null,
      assignedTeam: input.assignedTeam || 'ParkingOperations',
      initialTicketReference: input.initialTicketReference?.trim() || null,
    }),
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to create operational incident.');
}

/**
 * 2. List Operational Incidents
 * GET /api/admin/support/incidents?page=1&pageSize=20
 */
export async function listOperationalIncidents(
  token: string,
  page = 1,
  pageSize = 20,
  status?: string,
): Promise<OperationalIncidentListResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status && status !== 'All') {
    query.set('status', status);
  }

  const response = await apiRequest(`/admin/support/incidents?${query.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  const raw = await readJson<any>(response, 'Unable to load operational incidents.');

  // Normalize if raw is wrapped in items or an array
  if (Array.isArray(raw)) {
    return {
      items: raw,
      page: 1,
      pageSize: raw.length,
      totalCount: raw.length,
      totalPages: 1,
      hasNextPage: false,
    };
  }

  return {
    items: Array.isArray(raw?.items) ? raw.items : [],
    page: raw?.page ?? page,
    pageSize: raw?.pageSize ?? pageSize,
    totalCount: raw?.totalCount ?? 0,
    totalPages: raw?.totalPages ?? 1,
    hasNextPage: raw?.hasNextPage ?? false,
  };
}

/**
 * 2b. Get Operational Incident Details
 * GET /api/admin/support/incidents/{incidentId}
 */
export async function getOperationalIncidentDetails(
  token: string,
  incidentId: number | string,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest(`/admin/support/incidents/${encodeURIComponent(String(incidentId))}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to retrieve incident details.');
}

/**
 * 3. Acknowledge Incident

 * POST /api/admin/support/incidents/{incidentId}/acknowledge
 */
export async function acknowledgeIncident(
  token: string,
  incidentId: number | string,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest(`/admin/support/incidents/${encodeURIComponent(String(incidentId))}/acknowledge`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: '{}',
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to acknowledge incident.');
}

/**
 * 4. Assign Incident Responder
 * POST /api/admin/support/incidents/{incidentId}/assign
 * JSON: { assignedTeam, assignedUserId }
 */
export async function assignIncidentResponder(
  token: string,
  incidentId: number | string,
  input: AssignIncidentInput,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest(`/admin/support/incidents/${encodeURIComponent(String(incidentId))}/assign`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      assignedTeam: input.assignedTeam || 'ParkingOperations',
      assignedUserId: Number(input.assignedUserId),
    }),
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to assign incident responder.');
}

/**
 * 5. Execute Remote Gate Access Override
 * POST /api/admin/support/incidents/{incidentId}/access-override
 * JSON: { bookingId, reason, action }
 */
export async function executeAccessOverride(
  token: string,
  incidentId: number | string,
  input: ExecuteAccessOverrideInput,
): Promise<AccessOverrideResult> {
  const response = await apiRequest(
    `/admin/support/incidents/${encodeURIComponent(String(incidentId))}/access-override`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        bookingId: Number(input.bookingId),
        reason: input.reason.trim(),
        action: input.action || 'RemoteOpenGate',
      }),
    },
  );

  return readJson<AccessOverrideResult>(response, 'Unable to execute gate access override.');
}

/**
 * 6a. Link Incident to Ticket (from Ticket perspective)
 * POST /api/admin/support/tickets/{ticketIdentifier}/link-incident
 * JSON: { incidentId?: number, incidentReference?: string }
 */
export async function linkTicketToIncident(
  token: string,
  ticketIdentifier: number | string,
  incidentIdentifier: number | string,
): Promise<SupportTicket> {
  const incStr = String(incidentIdentifier).trim();
  const isNumeric = /^\d+$/.test(incStr);
  const body = isNumeric
    ? { incidentId: Number(incStr), incidentReference: incStr }
    : { incidentReference: incStr };

  const response = await apiRequest(
    `/admin/support/tickets/${encodeURIComponent(String(ticketIdentifier).trim())}/link-incident`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify(body),
    },
  );

  const raw = await readJson<any>(response, 'Unable to link ticket to incident.');
  return normalizeTicket(raw);
}

/**
 * 6b. Link Ticket to Incident (from Incident perspective)
 * POST /api/admin/support/incidents/{incidentIdentifier}/link-ticket
 * JSON: { ticketId?: number, ticketReference?: string }
 */
export async function linkTicketFromIncident(
  token: string,
  incidentIdentifier: number | string,
  ticketIdentifier: number | string,
): Promise<OperationalIncidentDetail> {
  const tktStr = String(ticketIdentifier).trim();
  const isNumeric = /^\d+$/.test(tktStr);
  const body = isNumeric
    ? { ticketId: Number(tktStr), ticketReference: tktStr }
    : { ticketReference: tktStr };

  const response = await apiRequest(
    `/admin/support/incidents/${encodeURIComponent(String(incidentIdentifier).trim())}/link-ticket`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify(body),
    },
  );

  return readJson<OperationalIncidentDetail>(response, 'Unable to link ticket to incident.');
}

/**
 * 7. Transition Incident Status
 * POST /api/admin/support/incidents/{incidentId}/transition
 * JSON: { toStatus, rootCause }
 */
export async function transitionIncidentStatus(
  token: string,
  incidentId: number | string,
  input: TransitionIncidentInput,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest(`/admin/support/incidents/${encodeURIComponent(String(incidentId))}/transition`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      toStatus: input.toStatus,
      rootCause: input.rootCause.trim(),
    }),
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to transition incident status.');
}
