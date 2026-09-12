# Normalized discovery output

Workers return one JSON document. Omit unknown optional values; represent known gaps in
`gaps`.

```json
{
  "repository": "owner/repo",
  "revision": "full-commit-sha",
  "component": {
    "id": "canonical-id",
    "name": "Display name",
    "system": "system-id",
    "ownership": "internal",
    "role": "business-service"
  },
  "relations": [
    {
      "direction": "outbound",
      "target": "canonical-target-id",
      "role": "platform-service",
      "ownership": "external",
      "transport": "sdk",
      "operation": "Evaluate feature flag",
      "evidence": [
        {
          "path": "src/provider.ts",
          "lines": "12-24",
          "claim": "Calls the provider SDK",
          "revision": "full-commit-sha"
        }
      ]
    }
  ],
  "apis": [
    {
      "name": "Service API",
      "version": "v1",
      "method": "POST",
      "path": "/items",
      "requestType": "CreateItemRequest",
      "responseType": "Item",
      "evidence": []
    }
  ],
  "resources": [
    {
      "id": "items-db",
      "kind": "database",
      "technology": "PostgreSQL",
      "access": ["read", "write"],
      "records": [
        {
          "id": "items",
          "name": "items",
          "kind": "record",
          "keyPattern": "primary key: id",
          "ttl": null,
          "fields": [
            {
              "name": "id",
              "type": "uuid",
              "required": true,
              "description": "Stable item identifier"
            }
          ],
          "evidence": []
        }
      ]
    }
  ],
  "messages": [
    {
      "id": "item-created",
      "broker": "Kafka",
      "channel": "items.created",
      "direction": "outbound",
      "messageType": "ItemCreated",
      "fields": [],
      "delivery": {
        "ordering": "unknown",
        "retries": "unknown",
        "deadLetter": "unknown"
      },
      "evidence": []
    }
  ],
  "gaps": [
    {
      "area": "resources.items-db.records.items.fields",
      "reason": "The Redis key is observed but its serialized DTO was not resolved."
    }
  ]
}
```

## Allowed values

- `direction`: `inbound`, `outbound`
- `ownership`: `internal`, `external`
- `role`: `business-service`, `platform-service`, `external-provider`
- resource `kind`: `database`, `cache`, `object-storage`, `local-storage`, `queue`
- record `kind`: `document`, `record`, `keyspace`, `message`

## Evidence rules

- Use repository-relative paths.
- Include exact line ranges where available.
- Include the full commit SHA.
- State the claim supported by the evidence.
- Keep inference out of evidence. Put unresolved interpretation in `gaps`.

