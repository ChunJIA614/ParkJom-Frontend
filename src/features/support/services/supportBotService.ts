import type { SupportConversationMessage } from '../types';

export interface AutobotContext {
  userName: string;
  isOwner: boolean;
  bookingSpotName?: string | null;
  bookingRef?: string | null;
  vehiclePlate?: string | null;
  walletBalance?: number;
}

const STORAGE_PREFIX = 'parkjom.autobot.messages.';

export function loadPersistedBotMessages(conversationId: number | string): SupportConversationMessage[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${conversationId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistBotMessage(conversationId: number | string, message: SupportConversationMessage): void {
  try {
    const existing = loadPersistedBotMessages(conversationId);
    if (!existing.some((m) => String(m.messageId) === String(message.messageId))) {
      const updated = [...existing, message];
      localStorage.setItem(`${STORAGE_PREFIX}${conversationId}`, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Failed to persist bot message:', err);
  }
}

export function createAutobotMessage(
  conversationId: number | string,
  body: string,
): SupportConversationMessage {
  return {
    messageId: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` as any,
    conversationId: Number(conversationId) || 0,
    senderUserId: 0,
    senderName: 'ParkJom Support Bot',
    senderRole: 'Bot',
    messageType: 'Bot',
    body,
    isInternal: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Knowledge Base for Frequent Inquiries and Quick Answers
 */
export function generateAutobotReply(prompt: string, context: AutobotContext): string {
  const norm = (prompt || '').toLowerCase().trim();
  const name = context.userName ? context.userName.split(' ')[0] : 'there';
  const balance = context.walletBalance !== undefined ? `RM ${context.walletBalance.toFixed(2)}` : 'RM 0.00';

  // ── OWNER PROMPTS ──

  if (norm.includes('bay sensor calibration') || (norm.includes('sensor') && norm.includes('calibration'))) {
    return `Hello ${name}! I've logged your request regarding **Bay Sensor Calibration** for your host property.

While an operations specialist is reviewing your telemetry, here is the immediate diagnostic procedure:

1. **Zero-Load Clearance**: Ensure the parking bay is completely vacated of all vehicles, cones, or physical obstacles.
2. **Force Calibration Reset**: Navigate to **Owner Dashboard → Configure Parking**, find the affected bay, and toggle its status to 'Maintenance' for 30 seconds. This instructs the IoT controller to re-zero its geomagnetic and ultrasonic baseline.
3. **Inspect Sensor Hardware**: Check the overhead camera or physical floor detector for dust, cobwebs, or parking stall line reflections.
4. **Verify Gateway Status**: Check the telemetry bar above to ensure your Gate IoT Gateway shows **'Online & Synced'**. If it missed heartbeats for >10 minutes, power cycle the sub-gateway adapter.

*Note: Your inquiry has been routed to our hardware desk. If the bay still shows false occupancy after recalibration, a field technician will join this chat.*`;
  }

  if (norm.includes('barrier controller offline') || (norm.includes('barrier') && norm.includes('offline')) || norm.includes('controller offline')) {
    return `Hello ${name}! We have detected an **IoT Barrier Controller Disruption** alert for your listed site.

Here are the priority troubleshooting steps:

1. **Power Cycle Sub-Gateway**: Disconnect power from the ESP32 barrier controller / gateway for 15 seconds, then reconnect. Ensure the green link LED transitions from solid to blinking.
2. **Uplink Check**: Confirm the local 2.4GHz Wi-Fi or 4G LTE SIM card has an active Internet connection. If the gateway cannot reach the cloud, barriers automatically switch to local fallback mode.
3. **Emergency Manual Override**: If incoming commuters are waiting, use the physical master key on the barrier cabinet to unlock the clutch and raise the boom arm manually.
4. **Traffic Safety**: Verify that the safety loop detector under the driveway is not jammed, which can prevent the arm from closing.

*A Priority P1 hardware incident has been logged for our site operations team. A technician is on standby to assist.*`;
  }

  if (norm.includes('overstay') || norm.includes('overstayed')) {
    return `Hello ${name}! Overstay violations disrupt scheduled reservations. Here is the automated enforcement action:

1. **Submit Offending Plate**: Please reply in this chat with the offending vehicle's **license plate number** and bay number.
2. **Automated Commuter Warning**: Our system will immediately cross-reference the booking and dispatch an urgent high-priority SMS and Push notification to the vehicle owner with an overstay penalty warning.
3. **Incoming Booking Protection**: If another commuter has reserved this bay shortly, click **'Escalate to Ticket'** on the left panel so our operations desk can reassign the incoming commuter to a neighboring vacant spot.
4. **Host Payout Credit**: Once overstay penalty fees are billed and collected from the commuter, the full compensation will be credited directly to your host payout balance.

*An enforcement officer has been alerted to review plate records.*`;
  }

  if (norm.includes('payout') || norm.includes('withdrawal') || norm.includes('settlement')) {
    return `Hello ${name}! Here is the latest status for your **Host Payouts & Earnings**:

1. **Settlement Schedule**: Rental proceeds are reconciled on the 1st and 15th of each calendar month. Bank transfers are deposited within 1–3 business days.
2. **Bank Account Verification**: Check **Owner Dashboard → Settings** to confirm your bank name, account holder name, and account number are accurate and match your NRIC/SSM.
3. **Current Balance**: Your pending payout balance currently reflects **${balance}**.
4. **Delayed Payouts**: If a requested payout has remained 'Pending' for more than 48 hours, reply with your Payout Reference number or click **'Escalate to Ticket'** for the finance team.

*A finance support representative has been notified of your inquiry.*`;
  }

  if (norm.includes('false occupied') || (norm.includes('sensor') && norm.includes('false'))) {
    return `Hello ${name}! For **Sensor False Occupancy** (bay displayed as occupied when empty):

1. **Clear Bay**: Ensure the ground detector is completely uncovered.
2. **Re-sync Telemetry**: In your Owner Dashboard, trigger a status sync or toggle the bay availability switch once.
3. **Check Ultrasonic Beam**: Ensure there is no parked bicycle, shopping cart, or debris inside the bay perimeter.
4. **Remote Recalibration**: Reply below with the exact Bay Label (e.g., 'Bay B-12') so our tech desk can remotely re-flash the sensitivity threshold.`;
  }

  // ── COMMUTER PROMPTS ──

  if (norm.includes('barrier not opening') || norm.includes('cannot enter') || norm.includes('cannot exit') || norm.includes('gate not opening')) {
    const spot = context.bookingSpotName ? ` at **${context.bookingSpotName}**` : '';
    return `Hello ${name}! If the barrier is not opening${spot}:

1. **Stop at the Yellow Sensor Line**: Position your vehicle directly in front of the entry camera without rolling forward prematurely, so the camera can scan your front license plate.
2. **Use Digital QR Pass**: Open **Commuter Dashboard → Parking Pass** and present your digital QR code 15–20cm in front of the optical reader on the entry pillar.
3. **Plate Whitelist Verification**: Ensure you are driving the registered vehicle${context.vehiclePlate ? ` (${context.vehiclePlate})` : ''}. If you changed cars, reply with the new license plate below.
4. **Trapped Vehicle Emergency**: If the barrier is stuck and traffic is backing up, click **'Escalate to Ticket'** (Priority P0) or run the **Gate & Access Help** triage above so an on-duty admin can execute an immediate **Remote Gate Override**!

*An on-call access technician is monitoring this session.*`;
  }

  if (norm.includes('refund') || norm.includes('check refund status')) {
    return `Hello ${name}! Here is the information regarding your **Refund Status**:

1. **ParkJom Wallet Credits**: Approved refunds to your ParkJom Wallet are credited instantly (within 5–15 minutes). Your current wallet balance is **${balance}**.
2. **Credit / Debit Cards & Online Banking (FPX)**: Gateway card reversals take **3 to 7 business days** depending on your issuing bank's settlement cycle.
3. **Track Your Claim**: Navigate to the **Disputes & Refunds** tab in your dashboard to view the live case status, investigator notes, and attached refund receipts.
4. **Need Urgent Review?**: If your refund was approved over 7 days ago and has not appeared on your card statement, reply below with your Bank Name and Transaction ID.`;
  }

  if (norm.includes('license plate') || norm.includes('change plate') || norm.includes('plate not recognized')) {
    return `Hello ${name}! To resolve your **Vehicle License Plate** inquiry:

1. **Active Ongoing Booking**: If your booking is already underway, you cannot edit the plate number directly in the app. Please reply below with your **Correct License Plate Number** and **Booking Reference**, and our operator will manually update the barrier whitelist for you.
2. **Future Bookings**: You can add, edit, or set your default vehicle under **Commuter Dashboard → Vehicles**. Ensure there are no hyphens or spaces (e.g., 'VAA1234').
3. **Dirty / Tinted Plate**: If the camera failed to read your plate, use your digital QR pass from the **Parking Pass** tab on the entry scanner.`;
  }

  if (norm.includes('charged twice') || norm.includes('duplicate') || norm.includes('top-up discrepancy') || norm.includes('wallet')) {
    return `Hello ${name}! For payment or wallet balance discrepancies:

1. **Duplicate Card Debits**: If your bank statement shows two identical charges, one is typically a temporary pre-authorization hold that automatically drops off within 24–48 hours.
2. **Missing Wallet Top-Up**: Pull down to refresh your wallet balance. If funds have not reflected after 10 minutes, reply below with your **Bank Reference Number** or upload the receipt via the paperclip button.
3. **Formal Dispute**: You can also open a formal financial reversal claim under **Disputes & Refunds** for guaranteed investigation by our finance desk.

*Our finance support team has been notified of this transaction inquiry.*`;
  }

  // ── GENERAL FALLBACK AUTOBOT GREETING & TRIAGE ──

  return `Hello ${name}! Thank you for reaching out to ParkJom Support.

I've logged your message and attached your account telemetry${context.bookingSpotName ? ` (Active Booking: **${context.bookingSpotName}**)` : ''} to this live session.

**While a support specialist is being connected:**
- Feel free to reply below with any additional details, error codes, or physical site conditions.
- You can attach photos or documents (up to 10 MB) using the paperclip button.
- If this is an urgent on-site emergency, click **'Escalate to Ticket'** on the left to trigger immediate operational dispatch.

A human support agent will review your inquiry shortly!`;
}
