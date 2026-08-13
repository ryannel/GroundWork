# Surfaces

## Capability Core

The core owns dispatch domain logic, the order and delivery stores, and the partner
contracts. Deployment is `hosted`: surfaces reach it over HTTP through a gateway.
Contracts live in `docs/architecture/api/`.

## Surface Registry

### web-app

| Field | Value |
|---|---|
| type | graphical-ui |
| platform | web |
| status | active |
| core access | http-gateway |
| auth | session cookie via gateway |
| scaffold | nextjs-app |
| test medium | playwright |
| design track | docs/design-system.md § Graphical UI |

### driver-app

| Field | Value |
|---|---|
| type | graphical-ui |
| platform | mobile |
| status | active |
| core access | http-gateway |
| auth | device token via gateway |
| scaffold | manual |
| test medium | flutter-integration |
| design track | docs/design-system.md § Graphical UI |

## Capability Ledger

| Capability | web-app | driver-app |
|---|---|---|
