# ParkJom Support Module API Review Draft

> 这是审查稿，不是实现稿。本轮不修改 support 业务代码。
>
> 依据：`parkjom-hybrid-support-workflow.zh-CN.md`、当前 `ParkJom-Frontend`、同级 `ParkJomV2` 后端。

## 1. 结论先行

完整落地附档中的 hybrid support，建议按以下规模设计：

- **52 条 REST 路由**：20 条用户/共享路由，32 条管理员路由。
- **1 个实时通道**：建议 SignalR；若保持当前 frontend 的原生 `WebSocket`，则实现兼容的 `/api/support/ws`。
- **1 个内部 IoT 事件入口**：只允许设备/后台服务调用，不暴露给用户。
- **4 类后台任务**：P0/P1 escalation、通知发送、SLA 监控、重复问题 correlation。

当前 frontend 已经调用的兼容路由只有 **7 条**，后端目前是 **0 条**，因为 `ParkJomV2` 没有 support controller、model 或 migration。

当前 frontend 已调用的 7 条：

1. `GET /api/support/tickets/mine`
2. `POST /api/support/tickets`
3. `POST /api/support/tickets/{ticketId}/messages`
4. `GET /api/admin/support/tickets`
5. `POST /api/admin/support/tickets`
6. `POST /api/admin/support/tickets/{ticketId}/accept`
7. `POST /api/admin/support/tickets/{ticketId}/close`

这 7 条只能接通当前简化 ticket inbox，不能完成附档定义的 Conversation、Workflow、Incident、Dispute 和 on-call。

## 2. 当前代码的重要差距

### Frontend

- `src/features/support/api/supportTicketService.ts` 目前只有 ticket REST 调用；Quick Help 和 Live Chat 都在浏览器内存中运行。
- Quick Help 最后把 workflow 结果拼成一段普通 ticket message，没有传递真实的 `bookingId`、`parkingSpotId`、`vehicleId`、`paymentId`、IoT 状态或 workflow run。
- Live Chat 的消息目前是本地 state；点击 `Create tracked case` 时才把 transcript 拼成普通 ticket。
- `SupportWorkspace.tsx` 是当前实际使用的 admin ticket workspace；`AdminSupportDashboard.tsx` 仍是 mock UI，当前路由没有把它接上真实 API。
- frontend ticket status 只有 `Open | InProgress | Closed`，与附档要求的 `New、Assigned、Waiting for Customer、Waiting for Internal Team、Resolved、Reopened、Duplicate、Cancelled` 不一致。
- backend 的 `UserType` 是 `Admin | PropertyOwner | Renter`，frontend 需要映射成 `Admin | Owner | Commuter`，不能让客户端自行决定角色。

### Backend

- 没有 Support 相关 model、DTO、controller、service 或 migration。
- `PaymentController.cs` 和 `RefundController.cs` 当前为空文件；不能直接依赖一个现有 refund API。
- 有 `Booking`、`Transaction`、`AccessLog`、`IoTDevice`、`IoTStatusLog`，但没有 support context 聚合服务。
- IoT 目前只有实体，没有 heartbeat ingestion、gate command、remote override 或 on-call notification 实现。
- `ApplicationDbContext` 目前没有 Notification、Support 或 Investigation DbSet。
- `CloudinaryService` 已可上传图片和 private document，可复用，但 support 附件必须走私有权限和 support authorization。

## 3. 统一对象设计

附档的四种业务对象保留如下，不新增第五种“特殊 Ticket”：

| 对象 | 职责 | 是否面向客户 |
| --- | --- | --- |
| `Conversation` | Live Chat 多轮对话；可以直接关闭，也可以转 Ticket | 是 |
| `SupportTicket` | 需要负责人、状态、SLA、后续跟进的客户案件 | 是 |
| `OperationalIncident` | 停车场、闸门、IoT 或平台运营故障 | 仅通过 Ticket 显示摘要 |
| `DisputeInvestigation` | 付款、退款、重复扣款、身份安全、Owner payout 调查 | 仅通过 Ticket 显示客户可见进度 |

推荐关系：

```text
Conversation 0..1 ─── SupportTicket 0..n
SupportTicket 0..n ─── OperationalIncident
SupportTicket 0..n ─── DisputeInvestigation
Conversation / Ticket / Incident / Dispute ─── Messages / Attachments / AuditEvents
```

一个 Ticket 负责客户沟通；Incident 负责恢复运营；Dispute 负责证据和决定。三者不能互相取代。

## 4. 建议新增的后端 Model

### 4.1 Conversation

`SupportConversation`

- `ConversationId`：Guid 或 long，内部主键。
- `ConversationReference`：`CON-YYYY-xxxxx`，对外显示。
- `CustomerUserId`、`Channel`、`Status`、`AssignedAdminUserId`。
- `CurrentBookingId`、`CurrentParkingSpotId`，可为空。
- `StartedAt`、`LastMessageAt`、`ClosedAt`、`CreatedAt`、`UpdatedAt`。
- `ContextSnapshotJson`：建立对话时保存的业务快照，不能只依赖未来会变化的 Booking 数据。

`SupportConversationMessage`

- `MessageId`、`ConversationId`、`SenderUserId`、`SenderRole`。
- `MessageType`：`Customer | Admin | System`。
- `Body`、`CreatedAt`、`IsInternal`。

### 4.2 Support Ticket

`SupportTicket`

- `TicketId`、`TicketReference`：`TKT-YYYY-xxxxx`。
- `TicketType`：`Preset | Custom`。
- `Source`：`QuickHelp | LiveChat | Admin | System`。
- `Category`：`ParkingAccess | Booking | Payment | Account | OwnerSupport | General`。
- `Priority`：`P0 | P1 | P2 | P3`。
- `CustomerUserId`、`CreatedByUserId`、`AssignedAdminUserId`、`AssignedTeam`。
- `ConversationId`、`WorkflowRunId`、`BookingId`、`ParkingSpotId`、`VehicleId`。
- `IncidentId`、`DisputeId`，或用 join table 支持多关联。
- `Status`、`AcceptedAt`、`FirstResponseAt`、`ResolvedAt`、`ClosedAt`。
- `FirstResponseDueAt`、`ResolutionDueAt`、`ResolutionCode`。
- `CreatedAt`、`UpdatedAt`。

`SupportTicketMessage` 和 `SupportAttachment` 建议独立成表，不要把整段 messages JSON 存在 Ticket 中。附件可复用 `MediaFile` 的 Cloudinary 存储，但必须额外记录 owner object、private/public 类型和 authorization scope。

### 4.3 Workflow

`SupportWorkflowDefinition`：workflow key、版本、是否启用、问题选项、问题 schema、检查步骤、routing rule、SLA、自动处理 action。

`SupportWorkflowRun`：run reference、customer、workflow/version、answers JSON、context snapshot、result、Ticket/Incident/Dispute IDs、idempotency key、started/completed timestamps。

固定的四个 workflow key：

- `parking-access`
- `booking`
- `payment-refund`
- `account-vehicle-owner`

第一版可以把 definition 放在后端 code/config，仍然要保存 `WorkflowRun`；不要只让 frontend 自己决定最终 outcome。

### 4.4 Incident

`OperationalIncident`

- `IncidentId`、`IncidentReference`：`INC-YYYY-xxxxx`。
- `IncidentType`、`Priority`、`Status`、`Title`、`Description`。
- `PropertyId`、`ParkingSpotId`、`IoTDeviceId`，可为空。
- `Source`：`QuickHelp | IoTMonitoring | TicketCorrelation | Admin`。
- `AssignedTeam`、`AssignedUserId`、`AffectedCustomerCount`。
- `AcknowledgedAt`、`ResolvedAt`、`EscalationLevel`、`NextEscalationAt`。
- `CorrelationKey`、`CreatedAt`、`UpdatedAt`。

建议用 `IncidentTicket` join table，因为一个故障可关联多个客户 Ticket。

### 4.5 Dispute / Investigation

`DisputeInvestigation`

- `DisputeId`、`DisputeReference`：`DSP-YYYY-xxxxx`。
- `DisputeType`：`DuplicateCharge | UnrecognizedCharge | Refund | OwnerPayout | AccountSecurity`。
- `Status`：`Opened | EvidenceReview | FinanceReview | DecisionReady | MoreInfo | Approved | Declined`。
- `CustomerUserId`、`TicketId`、`BookingId`、`PaymentId`、`TransactionId`。
- `Amount`、`Currency`、`Reason`、`AssignedTeam`、`AssignedUserId`。
- `Decision`、`DecisionReason`、`DecidedByUserId`、`DecidedAt`。

`DisputeEvidence`：private MediaFile、证据类别、来源、hash、上传人、上传时间、verified 状态。银行卡完整号码和密码永远不保存。

### 4.6 Audit / Notification / On-call

新增：

- `SupportAuditEvent`：每一次状态、分配、决定、退款、override 和证据动作的 append-only 记录。
- `SupportNotificationAttempt`：通知渠道、recipient、attempt、sent/failed、provider id、timestamps。
- `SupportOnCallSchedule`、`SupportOnCallResponder`：primary、backup、supervisor、manager、shift window、channels。

现有 `AccessLog` 可以继续记录系统动作，但不能代替 support 的业务审计时间线。

## 5. 52 条 REST API 逐一清单

所有 response 继续使用当前 frontend 已经读取的 envelope：

```json
{
  "code": 200,
  "success": true,
  "message": "...",
  "data": {}
}
```

所有需要登录的路由使用 `Authorization: Bearer <JWT>`。所有 admin 路由使用现有 `AdminOnly` policy。所有 create/run/message/action 路由必须写 `SupportAuditEvent`。

### A. 用户/共享路由：20 条

| ID | Method / route | 权限 | 作用和主要输入 | 返回 |
| --- | --- | --- | --- | --- |
| U-01 | `GET /api/support/context?bookingId=&vehicleId=` | Commuter/Owner | 取得当前用户可见的 booking、parking、vehicle、payment、access log、IoT 摘要；参数可空 | `SupportContextDto`，不得泄露无关用户资料 |
| U-02 | `GET /api/support/workflows` | 登录用户 | 取得启用的 Quick Help workflow 卡片 | workflow key、label、options、required questions |
| U-03 | `GET /api/support/workflows/{workflowKey}` | 登录用户 | 取得一个 workflow 的问题 schema 和允许答案 | version、steps、answer schema、SLA display |
| U-04 | `POST /api/support/workflows/{workflowKey}/runs` | Commuter/Owner | 执行 workflow；body 为 answers、bookingId、vehicleId、clientRequestId | `WorkflowRunResult`，包含 outcome、checks、ticket/incident/dispute refs |
| U-05 | `GET /api/support/workflow-runs/{runId}` | run 所属用户/Admin | 查询长时间自动检查的结果 | run 状态和最终关联对象 |
| U-06 | `POST /api/support/conversations` | Commuter/Owner | 建立 Live Chat；body 为 channel、initialMessage、bookingId 可选 | `ConversationDto` |
| U-07 | `GET /api/support/conversations` | Commuter/Owner | 列出自己的历史/进行中 Conversation；支持 status、page、pageSize | conversation summary page |
| U-08 | `GET /api/support/conversations/{conversationId}` | 所属用户/Admin | 取得对话详情、messages、context 摘要 | `ConversationDetailDto` |
| U-09 | `POST /api/support/conversations/{conversationId}/messages` | 所属用户 | 发送客户消息和 multipart attachments | 新 `ConversationMessageDto` |
| U-10 | `POST /api/support/conversations/{conversationId}/close` | 所属用户 | 客户主动结束一般咨询 | closed conversation |
| U-11 | `POST /api/support/conversations/{conversationId}/ticket` | 所属用户 | 当前 frontend 的 `Create tracked case`；将对话正式转 Ticket | `SupportTicketDto`，保留 ConversationId |
| U-12 | `GET /api/support/tickets/mine?status=&search=&page=&pageSize=` | Commuter/Owner | **当前 frontend 已调用**；列出自己的 Ticket | `data: SupportTicketSummary[]` |
| U-13 | `GET /api/support/tickets/{ticketId}` | Ticket customer/Admin | 取得 Ticket detail、messages、关联对象的客户可见摘要 | `SupportTicketDto` |
| U-14 | `POST /api/support/tickets` | Commuter/Owner | **当前 frontend 已调用**；multipart `subject`、`message`、`attachments[]`、context IDs 可选 | 新 Ticket + opening message |
| U-15 | `POST /api/support/tickets/{ticketId}/messages` | Ticket customer/Admin | **当前 frontend 已调用**；multipart `message`、`attachments[]` | 新 TicketMessage |
| U-16 | `POST /api/support/tickets/{ticketId}/reopen` | Ticket customer/Admin | 对已 resolved/closed 案件重新打开；body 为 reason | Reopened Ticket |
| U-17 | `GET /api/support/disputes/mine?status=&page=&pageSize=` | Dispute customer | 列出自己的 dispute 简要状态 | dispute summaries |
| U-18 | `GET /api/support/disputes/{disputeId}` | Dispute customer/Admin | 查看客户可见的调查进度；不返回内部证据/内部 note | `DisputeCustomerDto` |
| U-19 | `POST /api/support/disputes/{disputeId}/evidence` | Dispute customer | multipart 上传补充证据 | evidence metadata |
| U-20 | `GET /api/support/attachments/{attachmentId}` | 有 object access 的用户/Admin | 下载或查看 private attachment；服务端再检查 Ticket/Conversation/Dispute 权限 | file stream 或短时 signed URL |

### B. 管理员路由：32 条

| ID | Method / route | 作用和主要输入 | 返回 |
| --- | --- | --- | --- |
| A-01 | `GET /api/admin/support/dashboard` | command center 统计：waiting conversations、open tickets、active incidents、open disputes、SLA risk | dashboard metrics |
| A-02 | `GET /api/admin/support/conversations?status=&priority=&team=&search=&page=&pageSize=` | conversation queue，按 wait time/priority 排序 | conversation queue page |
| A-03 | `POST /api/admin/support/conversations/{conversationId}/messages` | admin reply 或 internal note；body 必须明确 `isInternal` | message dto |
| A-04 | `POST /api/admin/support/conversations/{conversationId}/close` | Reply and Close；必要时保存 closing reason | closed conversation |
| A-05 | `POST /api/admin/support/conversations/{conversationId}/workflow` | admin 将用户导向一个 preset workflow；body `workflowKey` | workflow run |
| A-06 | `POST /api/admin/support/conversations/{conversationId}/ticket` | **Create Ticket from Conversation**；body `subject、category、priority、assignedTeam、internalSummary` | Custom Ticket，自动带 conversation/history/context |
| A-07 | `GET /api/admin/support/tickets?status=&priority=&team=&assignee=&search=&page=&pageSize=` | admin inbox queue；**当前 frontend 已调用** | ticket page |
| A-08 | `GET /api/admin/support/tickets/{ticketId}` | 取得 admin full detail：internal notes、关联 incident/dispute、audit timeline | admin ticket dto |
| A-09 | `POST /api/admin/support/tickets` | **当前 frontend 已调用**；手动新建 Custom Ticket | custom ticket |
| A-10 | `POST /api/admin/support/tickets/{ticketId}/accept` | **当前 frontend 已调用**；接单并设置 assigned admin、acceptedAt | assigned ticket |
| A-11 | `POST /api/admin/support/tickets/{ticketId}/assign` | body `assignedAdminUserId`、`assignedTeam` | assignment result |
| A-12 | `POST /api/admin/support/tickets/{ticketId}/transition` | body `toStatus`、`reason`；统一处理状态机 | updated ticket |
| A-13 | `POST /api/admin/support/tickets/{ticketId}/close` | **当前 frontend 已调用**；兼容 close button，内部等价于 transition 到 Closed | closed ticket |
| A-14 | `POST /api/admin/support/tickets/{ticketId}/link-incident` | body `incidentId`；关联既有 operational incident | ticket relation |
| A-15 | `POST /api/admin/support/tickets/{ticketId}/link-dispute` | body `disputeId`；关联既有 investigation | ticket relation |
| A-16 | `GET /api/admin/support/incidents?status=&priority=&team=&page=&pageSize=` | incidents queue | incident page |
| A-17 | `GET /api/admin/support/incidents/{incidentId}` | incident detail、affected tickets、timeline、escalation state | incident detail |
| A-18 | `POST /api/admin/support/incidents` | admin 手动建立 incident；body title、priority、parkingSpotId、team、summary | incident |
| A-19 | `POST /api/admin/support/incidents/{incidentId}/acknowledge` | primary/admin acknowledge；停止当前 escalation timer | acknowledged incident |
| A-20 | `POST /api/admin/support/incidents/{incidentId}/assign` | body responder/team | assigned incident |
| A-21 | `POST /api/admin/support/incidents/{incidentId}/transition` | `Monitoring | Resolved | Closed`，要求 reason | updated incident |
| A-22 | `POST /api/admin/support/incidents/{incidentId}/access-override` | 对有效 booking 执行一次受审计的 gate/bollard override；body bookingId、reason、confirmation | command result + AccessLog |
| A-23 | `GET /api/admin/support/disputes?status=&type=&team=&page=&pageSize=` | dispute register | dispute page |
| A-24 | `GET /api/admin/support/disputes/{disputeId}` | 完整证据、交易、access log、internal notes、linked ticket | admin dispute detail |
| A-25 | `POST /api/admin/support/disputes/{disputeId}/evidence` | admin 上传或登记证据；支持 private files | evidence metadata |
| A-26 | `POST /api/admin/support/disputes/{disputeId}/request-evidence` | body customer message、required evidence、deadline；同步更新 Ticket | request result |
| A-27 | `POST /api/admin/support/disputes/{disputeId}/decision` | body `decision=ApproveReversal|Decline|NeedMoreInfo`、reason、amount；approve 时在同一 service transaction 执行 refund/ledger action | decision + financial result |
| A-28 | `POST /api/admin/support/disputes/{disputeId}/assign` | body team、assignee、review stage | assignment result |
| A-29 | `GET /api/admin/support/on-call` | 当前班次、primary/backup/supervisor、channels、next escalation | on-call status |
| A-30 | `POST /api/admin/support/on-call/test` | 测试 notification provider；不产生真实 incident | delivery attempts |
| A-31 | `PUT /api/admin/support/on-call/policy` | 更新 P0/P1 escalation delay、channels、roles；需更高权限审计 | policy |
| A-32 | `GET /api/admin/support/audit?objectType=&objectId=&page=&pageSize=` | 查看 support audit timeline；不允许修改或删除 | audit page |

### C. 内部事件入口：不计入 52 条公开 API

如果 IoT 设备或独立 monitoring service 通过 HTTP 送状态，增加：

`POST /api/internal/support/incidents/iot-events`

要求 service-to-service credential、签名或 mTLS、幂等 event ID、timestamp/replay protection。它可以创建或更新 P1/P0 Incident，并由后台 correlation service 关联现有 Tickets。若 IoT 和 API 在同一个进程，优先直接调用 application service，不必额外开放这个 HTTP route。

## 6. 关键 request/response 约定

### 6.1 Workflow run

```json
{
  "answers": {
    "issue": "exit",
    "trapped": "yes",
    "safetyRisk": "no"
  },
  "bookingId": 1182,
  "vehicleId": 42,
  "clientRequestId": "6e8c..."
}
```

后端必须重新查询资料，不信任 frontend 传来的 customer、parking、payment、IoT 状态。返回：

```json
{
  "runId": "...",
  "outcome": "OperationalIncidentAndTicket",
  "priority": "P0",
  "assignedTeam": "ParkingOperations",
  "checks": [
    { "name": "booking", "status": "valid" },
    { "name": "iot", "status": "offline" }
  ],
  "ticket": { "ticketId": "...", "ticketReference": "TKT-2026-00382" },
  "incident": { "incidentId": "...", "incidentReference": "INC-2026-00047" },
  "dispute": null,
  "customerMessage": "Emergency parking support has been notified."
}
```

### 6.2 Ticket create from frontend

当前 frontend 发送 `customerName`、`customerEmail`、`customerRole` 给 admin create route。后端不能直接信任这些字段：

1. 已登录客户创建时，CustomerUserId 必须从 JWT 取得。
2. Admin 从 Conversation 创建时，CustomerUserId 必须从 Conversation 取得。
3. 只有正式支持“代客/未注册客户”时才允许 email-based customer，并且要单独建 guest policy。
4. `createdByUserId`、`createdByRole`、`source`、`ticketType`、priority 上限和 team routing 由后端决定或校验。

### 6.3 Pagination

当前 ticket list frontend 直接期待 `data` 是数组。第一阶段为了接通现有 UI，可以保持：

```json
{ "data": [ ...tickets ] }
```

正式版建议改为：

```json
{
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 25,
    "totalCount": 0,
    "totalPages": 0,
    "hasNextPage": false
  }
}
```

这需要同步修改 `supportTicketService.ts`，否则不要在后端悄悄改变当前 list shape。

## 7. 四个 Quick Help Workflow 的后端规则

### 7.1 `parking-access`

输入：`enter | exit | validation`，access 场景额外要求 `trapped` 和 `safetyRisk`。

后端检查：当前 booking、booking owner、parking spot/property、vehicle、相关 transaction/payment、IoT device status、last heartbeat、最近 AccessLog。没有有效 booking 时不能让客户端自行指定别人的 booking。

- trapped 或 safety risk = yes：创建 P0 Incident + customer Ticket，立即通知 primary。
- gate/device offline：创建 P1 Incident + Ticket，team=`ParkingOperations`。
- gate online 但 booking validation 失败：创建 High Ticket，team=`ParkingOperations`。
- 只有存在真正的 booking revalidation/access service 时才能自动解决；目前后端没有这个 service，不能先返回“已恢复”。
- `access-override` 必须要求有效 booking、admin 权限、理由、幂等 command ID，并写 AccessLog 和 SupportAuditEvent。

### 7.2 `booking`

选项：`missing | location | cancel | time | expired | other`。

- 状态可由后端确认且无需修改 = 自动解释/修复结果，保存 WorkflowRun。
- 需要工作人员修改 = Support Ticket，默认 Customer Support。
- 同一 parking/booking error 在短时间内达到 correlation threshold = 新建或关联 Operational Incident，并将相关 Tickets 加入 incident。
- 客户不能通过 workflow body 直接改 Booking 状态。

### 7.3 `payment-refund`

选项：`paid-missing | refund | failed | duplicate | unknown | other`。

- 一般 refund status = Ticket，team=`Payments`。
- Payment 成功但 booking 不存在 = High Ticket，team=`Payments`，必须带 transaction/payment evidence。
- duplicate 或 unrecognized charge = Dispute + Ticket；unrecognized charge 暂停自动 refund。
- 大面积 payment failure = correlation service 创建 Operational Incident。
- approve reversal 只能由 `A-27` 进入 Wallet/Stripe/Transaction service；不要让 frontend 直接调用一个任意金额 refund endpoint。

当前 `Payment` model 主要代表 wallet top-up，而 booking 金融记录在 `Transaction`。Support context 至少要能关联 `TransactionId`；如要精确关联 gateway payment，需补充 Payment 与 Booking/Transaction 的关系。

### 7.4 `account-vehicle-owner`

选项：`account-access | vehicle | verification | payout | listing | payout-dispute | security`。

- 普通 account/vehicle/verification = Support Ticket，Customer Support。
- Owner payout status = Ticket，Owner Support。
- Owner payout dispute = Dispute + Ticket。
- account security / impersonation = Dispute + Ticket，team=`TrustAndSafety`；限制自动退款和敏感资料查看。

## 8. 状态机和权限规则

### Ticket

```text
New -> Assigned -> InProgress -> WaitingForCustomer -> InProgress
                              -> WaitingForInternalTeam -> InProgress
                              -> Resolved -> Closed
Resolved -> Reopened -> Assigned
New -> Duplicate
New -> Cancelled
```

- Admin `accept` 只能接 `New`/`Open` 案件。
- 当前 frontend 已假设：Admin 未 accept 不能 reply；后端必须强制这个规则。
- Closed 默认只读；reopen 要求 reason。
- 客户只能操作自己的 Conversation/Ticket/Dispute；不能改变 priority、team、assignee、incident、dispute decision。
- Admin 可以读全局，但只能通过 transition/assign/decision service 改状态，不能直接 patch 任意列。

### Incident

```text
Open -> Acknowledged -> Monitoring -> Resolved -> Closed
Open -> Acknowledged -> Escalated
```

P0/P1 的 acknowledge 必须停止对应 escalation timer，但不应自动关闭 Incident。

### Dispute

```text
Opened -> EvidenceReview -> FinanceReview -> DecisionReady
DecisionReady -> Approved | Declined | MoreInfo
MoreInfo -> EvidenceReview
```

Approved 的退款/账本动作必须幂等、可审计、不可用普通 Ticket close 代替。

## 9. Realtime、通知和 24/7 后台任务

### Realtime

建议增加：

`/hubs/support`

事件统一为：`conversation.created`、`conversation.updated`、`message.created`、`ticket.created`、`ticket.updated`、`ticket.closed`、`incident.created`、`incident.updated`、`dispute.updated`、`notification.updated`。

当前 frontend 的 `supportRealtime.ts` 使用原生 WebSocket 和 `access_token` query string，不会直接兼容 SignalR。两种方案只能选一种：

1. **推荐**：后端 SignalR + frontend 改用 `@microsoft/signalr`。
2. **兼容当前代码**：实现原生 WebSocket endpoint，并维持当前 `{ type, ticketId, occurredAt }` frame，同时补 conversation/incident/dispute event。

REST 必须永远是 source of truth；realtime 断线时继续用当前 10 秒 fallback refresh。

### 后台任务

1. `IncidentEscalationWorker`：创建后立即通知 primary，2 分钟未 acknowledge 通知 backup，5 分钟通知 supervisor，之后继续升级 manager。
2. `SupportNotificationWorker`：push、SMS、phone、email、internal messaging provider 的 retry、dedupe、delivery log。
3. `SupportSlaWorker`：检查 first response / resolution deadline，更新 at-risk 指标并产生通知。
4. `SupportCorrelationWorker`：按 parking spot、device、payment error、时间窗口聚合重复 Ticket，创建/更新 Incident。

如果没有实际的 provider 和 on-call schedule，产品只能承诺“24/7 可提交”，不能承诺“24/7 真人立即回复”。

## 10. 依赖现有 ParkJomV2 的改动清单

后端实现顺序建议：

1. 新增上述 support models、enums、DTOs、DbSets 和 migration。
2. 新增 `SupportAuthorizationService`、`SupportContextService`、`SupportWorkflowService`、`SupportTicketService`、`ConversationService`。
3. 新增 `IncidentService`、`DisputeService`、`SupportNotificationService` 和 `OnCallService`。
4. 给 `ApplicationDbContext` 加 foreign keys、index、unique reference、idempotency unique constraint。
5. 复用 `CloudinaryService`，但为 support attachment 增加 private download authorization。
6. 将 booking、transaction、access log、IoT 查询封装进 `SupportContextService`，不要在 controller 里拼接跨模块查询。
7. 将 refund、wallet reversal、platform ledger 动作封装进 finance service，由 Dispute decision 调用，不让 controller 自己改余额。
8. 让所有状态改变写 `SupportAuditEvent`，同时按现有习惯写 `AccessLog`。
9. 加入 SignalR 或原生 WebSocket，以及四个 hosted worker。
10. frontend 再把 Quick Help、Live Chat、Admin dashboard 的 mock state 替换成这些 API。

## 11. 必须先确认的审查点

1. 是否接受完整版本的 **52 REST routes**，还是先只做当前 frontend 可接通的 7 条 ticket routes？
2. Realtime 选 SignalR，还是保留当前原生 WebSocket？
3. ParkJom 是否已有 SMS、电话、Push、Email、内部通讯 provider 和 on-call 排班资料？
4. IoT gate/bollard 是否已有可调用的 command service？如果没有，`access-override` 只能先做审计记录，不能宣称真的开闸。
5. Admin 从 Conversation 建 Ticket 时，是否保证 customer 一定已经存在于 `Users`？当前建议是必须存在，不接受客户端伪造姓名/邮箱。
6. Refund 的最终资金来源是 wallet reversal、Stripe reversal，还是两者按 Payment 状态分别处理？这会影响 `Dispute decision` 的 transaction boundary。

