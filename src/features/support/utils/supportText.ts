/**
 * Support module text cleaner and English normalizer.
 * Ensures all text shown across Commuter, PropertyOwner, and Admin support views
 * is displayed strictly in clean, professional English.
 */

const CHINESE_TEXT_MAP: Array<[RegExp, string]> = [
  // Issue titles & codes
  [/道闸无法开启\s*[\/|、]\s*进出受阻/g, 'Barrier Gate Stuck / Entry Denied'],
  [/道闸打不开\s*[\/|、]\s*无法进出\s*(\(Cannot Enter or Exit Gate\))?/g, 'Gate Stuck / Cannot Enter or Exit'],
  [/预约车位被他人占用\s*(\(My Reserved Spot is Occupied\))?/g, 'Reserved Spot Occupied'],
  [/租客超时占车位未离场\s*(\(Renter Overstay \/ Blocking Spot\))?/g, 'Renter Overstay / Blocking Spot'],
  [/智能道闸\s*[\/|、]\s*硬件设备故障报修\s*(\(IoT Barrier Issue\))?/g, 'Smart Barrier / Hardware Issue'],
  [/智能道闸\s*[\/|、]\s*硬件故障报修/g, 'IoT Barrier / Hardware Fault'],
  [/重复扣款\s*[\/|、]\s*账单金额异常\s*(\(Duplicate or Unrecognized Charge\))?/g, 'Duplicate Charge / Billing Dispute'],
  [/未知扣款申诉/g, 'Unrecognized Charge Dispute'],
  [/申请退款\s*[\/|、]\s*订单取消协助\s*(\(Refund or Cancellation Request\))?/g, 'Refund or Cancellation Request'],
  [/申请订单退款/g, 'Refund Request'],
  [/车位收益结算与提现疑问\s*(\(Owner Payout Inquiry\))?/g, 'Host Payout & Revenue Inquiry'],
  [/其他咨询与反馈\s*(\(General Inquiry\))?/g, 'General Inquiry & Feedback'],
  [/其他业主支持咨询\s*(\(Other Host Support\))?/g, 'Other Host Inquiries'],
  [/客服求助工单\s*(\(Support Request\))?/g, 'Support Request'],

  // Issue descriptions
  [/到达车场道闸未抬杆或扫码[\/|、]车牌识别失败（支持一键自助抬杆或转紧急人工）。?/g, 'Barrier failed to open or license plate was not recognized upon arrival. Emergency self-unlock or human agent available.'],
  [/到达车位发现被其他车辆停占，请附上现场照片以便立即为您调配或全额退款。?/g, 'Reserved spot is occupied by an unauthorized vehicle. Attach a photo for immediate relocation or full refund.'],
  [/因故未能入场、设备故障导致无法停车或申请退还订单费用。?/g, 'Unable to park, facility malfunction, or requesting refund assistance for a booking charge.'],
  [/同一订单被扣款两次、支付成功未生成订单或超时费计算异议。?/g, 'Charged twice for the same booking, incorrect amount, or disputing overstay charges.'],
  [/当前预约已结束，但租客车辆仍停在车位上影响后续使用。?/g, 'Current booking has ended, but renter vehicle is still parked in the spot blocking subsequent reservations.'],
  [/道闸无法响应、传感器离线或硬件损坏需要检修。?/g, 'Barrier gate is unresponsive, sensor offline, or hardware failure requires on-site inspection.'],
  [/订单分账金额核对、平台佣金或钱包提现进度查询。?/g, 'Booking earnings breakdown, commission verification, or wallet payout timeline inquiries.'],
  [/车位审核、日历排期或账号相关问题。?/g, 'Spot verification, calendar scheduling, listing details, or account assistance.'],
  [/账号设置、绑定车牌修改或其他常规咨询。?/g, 'Account settings, license plate update, app feedback, or general support.'],

  // System message brackets & labels
  [/\[用户已确认解决[\/|、]关闭工单\]/g, '[Ticket Closed by Customer]'],
  [/\[退款已完成\s*[\/|、]\s*Refund Approved\]/g, '[Refund Approved]'],
  [/\[审核结果通知\s*[\/|、]\s*Claim Declined\]/g, '[Claim Declined]'],
  [/\[需补充信息\s*[\/|、]\s*More Info Needed\]/g, '[More Info Needed]'],
  [/\[现场故障已恢复\s*[\/|、]\s*Incident Resolved\]/g, '[Incident Resolved]'],
  [/\[请补充凭证\s*[\/|、]\s*Action Required\]/g, '[Action Required]'],
  [/问题已解决，用户自主关闭工单\s*(\(Closed by customer\))?/g, 'Issue resolved, closed by customer'],
  [/您的申诉已审核通过，已退还/g, 'Your claim has been approved and'],
  [/至您的平台钱包。说明：/g, 'has been refunded to your platform wallet. Note: '],
  [/您的费用申诉未通过审核。原因：/g, 'Your fee dispute was not approved. Reason: '],
  [/请在当前工单对话中补充相关信息或截图：/g, 'Please provide additional information or screenshots in this ticket conversation: '],
  [/关联的设备或现场问题（#([^）]+)）已处理完毕。/g, 'The linked hardware/on-site incident (#$1) has been resolved. '],

  // Common prefix / suffix
  [/关联订单：/g, 'Linked booking: '],
  [/，车位：/g, ', spot: '],
  [/，车牌：/g, ', plate: '],
  [/未知/g, 'Unknown'],
];

export function cleanSupportText(text?: string | null): string {
  if (!text) return '';
  let cleaned = text;
  for (const [pattern, replacement] of CHINESE_TEXT_MAP) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

export function formatUserStatusLabel(label?: string | null, fallback = 'In Progress'): string {
  if (!label) return fallback;
  if (/[\u4e00-\u9fff]/.test(label)) {
    if (label.includes('处理') || label.includes('进展')) return 'In Progress';
    if (label.includes('补充') || label.includes('需') || label.includes('待')) return 'Action Required';
    if (label.includes('解决')) return 'Resolved';
    if (label.includes('关闭')) return 'Closed';
    return fallback;
  }
  return label;
}
