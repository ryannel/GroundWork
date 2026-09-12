# Datastore schema response

We observed a Redis keyspace, but the serialized value schema was not recovered from the available evidence. I did not invent fields. I preserved the keyspace/record boundary and left the value structure unresolved.

## Normalized example

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
  "relations": [],
  "apis": [],
  "resources": [
    {
      "id": "redis-cache",
      "kind": "cache",
      "technology": "Redis",
      "records": [
        {
          "id": "observed-keyspace",
          "name": "Observed Redis key",
          "kind": "keyspace",
          "keyPattern": "observed Redis key name",
          "ttl": null,
          "fields": [],
          "evidence": []
        }
      ]
    }
  ],
  "messages": [],
  "gaps": [
    {
      "area": "resources.redis-cache.records.observed-keyspace.fields",
      "reason": "The Redis key was observed, but the serialized fields/value schema could not be resolved from evidence."
    }
  ]
}
```

## Missing-evidence handling

- Keep the observed Redis key or key pattern.
- Leave `fields` empty instead of guessing a DTO.
- Capture the gap explicitly so later evidence can fill it in.
- If path/line/revision evidence becomes available, attach it under `evidence`.
- Evidence should include the repository-relative path, line range, claim, and full commit SHA.
