import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import { SUPPORT_API } from './supportApiConfig';
import type {
  AccessOverrideResult,
  AssignIncidentInput,
  CreateOperationalIncidentInput,
  ExecuteAccessOverrideInput,
  OperationalIncidentDetail,
  OperationalIncidentListResponse,
  SupportTicket,
  TransitionIncidentInput,
} from '../types';
import { normalizeTicket } from './supportTicketService';

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = (await response.json().catch(() => null)) as any;

  if (!payload) {
    throw new Error(fallback);
  }
  if (payload.success === false && payload.data === undefined) {
    throw new Error(payload?.message || fallback);
  }
  return (payload.data !== undefined ? payload.data : payload) as T;
}

/**
 * 1. Create Operational Incident
 * POST /api/admin/support/incidents
 */
export async function createOperationalIncident(
  token: string,
  input: CreateOperationalIncidentInput,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest(SUPPORT_API.ADMIN.INCIDENTS.CREATE, {
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
 * GET /api/admin/support/incidents?status=&priority=&team=&page=1&pageSize=25
 */
export async function listOperationalIncidents(
  token: string,
  page = 1,
  pageSize = 25,
  status?: string,
  priority?: string,
  team?: string,
): Promise<OperationalIncidentListResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status && status !== 'All') {
    query.set('status', status);
  }
  if (priority && priority !== 'All') {
    query.set('priority', priority);
  }
  if (team && team !== 'All') {
    query.set('team', team);
  }

  const response = await apiRequest(`${SUPPORT_API.ADMIN.INCIDENTS.LIST}?${query.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  const raw = await readJson<any>(response, 'Unable to load operational incidents.');

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
 * GET /api/admin/support/incidents/{incidentIdentifier}
 */
export async function getOperationalIncidentDetails(
  token: string,
  incidentId: number | string,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest(SUPPORT_API.ADMIN.INCIDENTS.DETAIL(incidentId), {
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
  const response = await apiRequest(SUPPORT_API.ADMIN.INCIDENTS.ACKNOWLEDGE(incidentId), {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: '{}',
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to acknowledge incident.');
}

/**
 * 4. Assign Incident Responder
 * POST /api/admin/support/incidents/{incidentId}/assign
 * JSON: { assignedUserId?, assignedTeam? }
 */
export async function assignIncidentResponder(
  token: string,
  incidentId: number | string,
  input: AssignIncidentInput,
): Promise<OperationalIncidentDetail> {
  const response = await apiRequest(SUPPORT_API.ADMIN.INCIDENTS.ASSIGN(incidentId), {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      assignedTeam: input.assignedTeam || 'ParkingOperations',
      ...(input.assignedUserId !== undefined ? { assignedUserId: Number(input.assignedUserId) } : {}),
    }),
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to assign incident responder.');
}

/**
 * 5. Execute Remote Gate Access Override
 * POST /api/admin/support/incidents/{incidentId}/access-override
 * JSON: { bookingId, reason, confirmation, action }
 */
export async function executeAccessOverride(
  token: string,
  incidentId: number | string,
  input: ExecuteAccessOverrideInput,
): Promise<AccessOverrideResult> {
  const response = await apiRequest(
    SUPPORT_API.ADMIN.INCIDENTS.ACCESS_OVERRIDE(incidentId),
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify({
        bookingId: Number(input.bookingId),
        reason: input.reason.trim(),
        confirmation: input.confirmation ?? true,
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
    SUPPORT_API.ADMIN.TICKETS.LINK_INCIDENT(String(ticketIdentifier).trim()),
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
    SUPPORT_API.ADMIN.INCIDENTS.LINK_TICKET(String(incidentIdentifier).trim()),
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
 * JSON: { toStatus, reason?, rootCause? }
 */
export async function transitionIncidentStatus(
  token: string,
  incidentId: number | string,
  input: TransitionIncidentInput,
): Promise<OperationalIncidentDetail> {
  const reasonText = (input.reason || input.rootCause || '').trim();
  const response = await apiRequest(SUPPORT_API.ADMIN.INCIDENTS.TRANSITION(incidentId), {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify({
      toStatus: input.toStatus,
      reason: reasonText,
      rootCause: reasonText,
    }),
  });

  return readJson<OperationalIncidentDetail>(response, 'Unable to transition incident status.');
}
