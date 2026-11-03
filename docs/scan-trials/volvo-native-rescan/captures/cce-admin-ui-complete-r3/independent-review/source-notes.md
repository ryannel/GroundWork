# CCE Admin UI independent preparation

Root read all twelve pinned files in source-review.json. The explorer draft is unsealed; no acceptance claim.

DELETE /api/users/roles/[cdsid]/[policyId] specialises createUsersDbHandler with mapped cdsid, policyId and
requestReference and policy-specific hasUserWriteAccess. The query.* mapper actually prefers a truthy resolved
route param, otherwise joins all search-param values with commas. Body mapping has separate whole parsed and
cloned JSON branches. Do not label every configured query.* value as an HTTP query parameter.

Wrapper requires Authorization, splits on a space, decodes its second token and requires decoded.upn. This
source does not verify signature or require the first token literally Bearer. When authenticated, it finds
actor by cdsid/upn with deletedAt absent, then authorises policy. Super-admin grants all flags. An exact role
prevents tree fallback; otherwise ADMIN_SERVICE_URI/v2/tree/policies?policyUid=... GET carries Authorization,
parses body and selects the first matching ancestor role. There is no response.ok check before parsing. For
policy-specific access, hasUserWriteAccess is support-only; admin has policy write but not this user-write flag.
Errors in verifyUserAccessForPolicy are caught/logged and return all flags false. Wrapper permission failure
is source401, not an assumed403. Actual target depends on configured URI.

Role removal validates a trimmed HTTPS ServiceNow link (hostname ends .service-now.com, no credentials,
non-root path or query). The operation finds the first removedRole, filters all matching roles, and only if
one existed records an audit event with actor.cdsid, target cdsid, role and previousValue. Regardless of role
existence it can still save the user; do not claim a not-found role404. Response contains cdsid/roles/superAdmin,
wrapped as {successful:true,response:...} at200 for truthy result. Error status uses err.status??500 and
cause.message before message; not a framework-specific guessed exception table.

updateUserWithAudit retries at most3 on Mongoose VersionError from user.save only. It reads target by cdsid;
missing/deleted returns404 unless createIfMissing true, which resets roles/superAdmin/created/deletedAt. It
invokes the provided operation with a conditional record callback that pushes validated audit entries into
user.pendingAuditLogs. save happens before awaited immediate deliverUserAuditLogs; delivery catches/logs its
own errors, so access change can return success while audit remains pending. Other save errors propagate;
three VersionErrors end in409. Actual model options set optimisticConcurrency:true but deployed concurrency
safety is not observed. Schema uses user-roles, optional created/updated/deletedAt, embedded pending audit list.

Delivery iterates pending entries, upserts audit by event _id with $setOnInsert, then $pulls that _id from user.
Its catch stops the current delivery loop and logs; duplicate delivery retries reuse event ID. Tombstone cleanup
deletes only when deletedAt exists and pendingAuditLogs.0 absent. No multi-document transaction is declared.
DbAuditLog declares access-audit-logs, filtering indexes and retainUntil TTL expireAfterSeconds0; source schema
and desired indexes are not evidence TTL deletion already happened. Entries set timestamp now and retention
using UTCFullYear+1, which is not a fixed365-day duration.

Startup validates env, awaits Mongo connect, starts immediate non-awaited delivery and registers30-second
interval, then unrefs it. deliveryRunning prevents overlap in this process only and resets in finally.
Background delivery queries pending/tombstoned users via lean cursor batchSize50 and awaits each delivery.
Process flag is not a cross-replica lock. Mongo cache reuses conn/promise; rejected promise is not reset in
this source. SSL/TLS options, pool10, socket45s and selection5s are declared config, not live guarantees.

Native acceptance must specialise the curried route, actual callback/actor/capture values and true runtime
host; querying all generic wrapper services at once would create false dependencies and payloads. A source
implementation-only replay is not registration-to-effect acceptance if its exposed entry is unbound.

Browser form and state source: AddSuperAdminPanel stores cdsid/requestReference, validates local email/domain/minimum length/existing-user and ServiceNow URL before source handleSubmit, resets then calls onSave. Parent callback scheduling is not eager execution. UserProvider methods dispatch request action, await httpJson/httpRaw, validate parsed responses where used, dispatch receive or catch/error. Request reference is URLSearchParams query data; role update is actual PUT payload. UserReducer received remove-from-policy removes the whole user row from the current list rather than editing a role in that row; removeSuperAdmin instead sets superAdmin false in its list. These are source UI state transitions, not extra database mutations or proof of React scheduling.
