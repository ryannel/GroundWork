# Model contract fixture: system map

- example/orders: read at `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` on 2026-11-06T00:00:00Z.

## Orders (`dom:orders`)

### Ordering (`sys:ordering`)

Confirm orders and arrange delivery.

- `svc:ordering` Ordering API — example/orders/apps/ordering
- `app:shop` Shop — example/orders/apps/ordering
- `st:orders` Orders database — example/orders/apps/ordering
- `st:unknown-owner` Unowned fixture cache — example/orders/apps/ordering
- `top:confirmed` Order confirmations — example/orders/apps/ordering

## Recorded exchanges

- `svc:ordering` → `st:orders`: read via `sch:order` at `h:confirm#load`.
- `svc:ordering` → `st:orders`: write via `sch:order#status` at `h:confirm#tx/save`.
- `svc:ordering` → `ext:payments`: call via `api:charge` at `h:confirm#lines/reserve`.
- `svc:ordering` → `st:orders`: read via `sch:order` at `h:confirm#enrich/order`.
- `svc:ordering` → `ext:payments`: call via `api:charge` at `h:confirm#enrich/payment`.
- `svc:ordering` → `top:confirmed`: publish via `msg:confirmed` at `h:confirm#deliver/send`.
- `svc:ordering` → `svc:ordering`: causes via `h:on-confirmed` at `h:confirm#deliver/send`.
- `app:shop` → `svc:ordering`: call via `api:confirm` at `h:click#submit`.
- `top:confirmed` → `svc:ordering`: consume via `msg:confirmed` at `sub:on-confirmed`.
- `app:shop` → `svc:ordering`: call via `gql:order` at `gql:order`.
- `svc:ordering` → `ext:notifications`: call via `ext:notifications` at `rel:notifications`.

## Gaps

- `st:unknown-owner`: No cited resource owner is recorded.
- `top:confirmed`: No cited resource owner is recorded.
- `api:legacy`: No caller is recorded.
- `api:legacy`: No handler detail is recorded.
- `api:order-query`: No handler detail is recorded.
- `api:grpc-confirm`: No caller is recorded.
- `api:grpc-confirm`: No handler detail is recorded.
- `api:charge`: No handler detail is recorded.
- `job:nightly`: No handler detail is recorded.
- `job:unknown`: No handler detail is recorded.
- `job:unknown`: No schedule or trigger is recorded.
- `sch:confirm#unknown`: No field type is recorded.
- `sys:ordering`: The stated connection has no recorded execution backing.
