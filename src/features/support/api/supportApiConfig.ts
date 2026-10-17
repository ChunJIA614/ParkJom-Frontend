export const SUPPORT_API = {
  // ==================== 1. User Endpoints (Commuter & PropertyOwner) ====================
  USER: {
    // Get user active support context (active booking, canSelfUnlockGate, quick issue cards, recent bookings/vehicles/spots)
    GET_CONTEXT: '/api/support/context', // GET ?bookingId=&vehicleId=

    // Get role-specific quick issue templates (Commuter vs PropertyOwner)
    GET_TEMPLATES: '/api/support/templates', // GET

    // Emergency self-service gate unlock (immediate self-rescue without ticket)
    SELF_UNLOCK_GATE: '/api/support/gate-unlock', // POST { bookingId?: number, action?: 'Enter' | 'Exit' }

    // My support tickets list (supports filtering: Processing, ActionRequired, Resolved, Closed)
    GET_MY_TICKETS: '/api/support/tickets/mine', // GET ?status=&search=

    // Support ticket detail (conversation stream, image attachments, embedded RefundSummary)
    GET_TICKET_DETAIL: (ticketId: string | number) => `/api/support/tickets/${encodeURIComponent(String(ticketId))}`, // GET

    // 1-Click ticket creation (supports multipart/form-data for image uploads)
    CREATE_TICKET: '/api/support/tickets', // POST (FormData: issueCode, message, bookingId?, claimAmount?, attachments?)

    // Send ticket message / submit evidence attachments (supports multipart/form-data)
    SEND_MESSAGE: (ticketId: string | number) => `/api/support/tickets/${encodeURIComponent(String(ticketId))}/messages`, // POST (FormData: message, attachments?)

    // Customer self-resolve/close ticket
    CLOSE_TICKET: (ticketId: string | number) => `/api/support/tickets/${encodeURIComponent(String(ticketId))}/close`, // POST { reason?: string }

    // Reopen resolved or closed ticket
    REOPEN_TICKET: (ticketId: string | number) => `/api/support/tickets/${encodeURIComponent(String(ticketId))}/reopen`, // POST { reason: string }

    // View protected ticket attachment
    GET_ATTACHMENT: (attachmentId: string | number) => `/api/support/attachments/${encodeURIComponent(String(attachmentId))}`, // GET
  },

  // ==================== 2. Admin Endpoints (Admin Only) ====================
  ADMIN: {
    // Dashboard & Audit logs
    DASHBOARD: '/api/admin/support/dashboard', // GET
    AUDIT_LOGS: '/api/admin/support/audit', // GET ?objectType=&objectId=&page=1&pageSize=50

    // Ticket Management
    TICKETS: {
      LIST: '/api/admin/support/tickets', // GET ?status=&priority=&team=&assignee=&search=&page=1&pageSize=100
      DETAIL: (ticketIdentifier: string | number) => `/api/admin/support/tickets/${encodeURIComponent(String(ticketIdentifier))}`, // GET (supports ticketId or TKT-2026-XXXXX)
      CREATE: '/api/admin/support/tickets', // POST (FormData)
      ACCEPT: (ticketId: string | number) => `/api/admin/support/tickets/${encodeURIComponent(String(ticketId))}/accept`, // POST
      ASSIGN: (ticketId: string | number) => `/api/admin/support/tickets/${encodeURIComponent(String(ticketId))}/assign`, // POST { assignedAdminUserId?, assignedTeam? }
      TRANSITION: (ticketId: string | number) => `/api/admin/support/tickets/${encodeURIComponent(String(ticketId))}/transition`, // POST { toStatus, reason?, resolutionCode? }
      CLOSE: (ticketId: string | number) => `/api/admin/support/tickets/${encodeURIComponent(String(ticketId))}/close`, // POST { reason? }
      LINK_INCIDENT: (ticketIdentifier: string | number) => `/api/admin/support/tickets/${encodeURIComponent(String(ticketIdentifier))}/link-incident`, // POST { incidentId?, incidentReference? }
      LINK_DISPUTE: (ticketIdentifier: string | number) => `/api/admin/support/tickets/${encodeURIComponent(String(ticketIdentifier))}/link-dispute`, // POST { disputeId?, disputeReference? }
    },

    // Operational Incident Management
    INCIDENTS: {
      LIST: '/api/admin/support/incidents', // GET ?status=&priority=&team=&page=1&pageSize=25
      DETAIL: (incidentIdentifier: string | number) => `/api/admin/support/incidents/${encodeURIComponent(String(incidentIdentifier))}`, // GET (supports incidentId or INC-2026-XXXXX)
      CREATE: '/api/admin/support/incidents', // POST
      ACKNOWLEDGE: (incidentId: string | number) => `/api/admin/support/incidents/${encodeURIComponent(String(incidentId))}/acknowledge`, // POST
      ASSIGN: (incidentId: string | number) => `/api/admin/support/incidents/${encodeURIComponent(String(incidentId))}/assign`, // POST { assignedUserId?, assignedTeam? }
      TRANSITION: (incidentId: string | number) => `/api/admin/support/incidents/${encodeURIComponent(String(incidentId))}/transition`, // POST { toStatus, reason? }
      ACCESS_OVERRIDE: (incidentId: string | number) => `/api/admin/support/incidents/${encodeURIComponent(String(incidentId))}/access-override`, // POST { bookingId, reason, confirmation }
      LINK_TICKET: (incidentIdentifier: string | number) => `/api/admin/support/incidents/${encodeURIComponent(String(incidentIdentifier))}/link-ticket`, // POST { ticketId?, ticketReference? }
    },

    // Financial Disputes & Refund Audits
    DISPUTES: {
      LIST: '/api/admin/support/disputes', // GET ?status=&type=&team=&page=1&pageSize=25
      DETAIL: (disputeId: string | number) => `/api/admin/support/disputes/${encodeURIComponent(String(disputeId))}`, // GET
      UPLOAD_EVIDENCE: (disputeId: string | number) => `/api/admin/support/disputes/${encodeURIComponent(String(disputeId))}/evidence`, // POST (FormData: evidenceType, description?, file)
      REQUEST_EVIDENCE: (disputeId: string | number) => `/api/admin/support/disputes/${encodeURIComponent(String(disputeId))}/request-evidence`, // POST { requiredEvidence, customerMessage, deadline? }
      DECISION: (disputeId: string | number) => `/api/admin/support/disputes/${encodeURIComponent(String(disputeId))}/decision`, // POST { decision: 'ApproveReversal'|'Decline'|'NeedMoreInfo', reason, amount? }
      ASSIGN: (disputeId: string | number) => `/api/admin/support/disputes/${encodeURIComponent(String(disputeId))}/assign`, // POST { assignedUserId?, assignedTeam?, status? }
    },

    // 24/7 On-Call & Escalation Policies
    ON_CALL: {
      STATUS: '/api/admin/support/on-call', // GET
      TEST_NOTIFICATION: '/api/admin/support/on-call/test', // POST { channel, recipient, message? }
      UPDATE_POLICY: '/api/admin/support/on-call/policy', // PUT
    },
  },

  // ==================== 3. Real-Time Communication (SignalR / WebSocket) ====================
  REALTIME: {
    SIGNALR_HUB: '/hubs/support',
    WEBSOCKET: '/api/support/ws', // ?access_token=JWT_TOKEN
  },
} as const;
