## Catalog response

I would **not invent the Redis value schema**. Keep the observed keyspace in the catalog, record any known purpose/access/TTL, and leave the serialized fields empty until evidence is found.

### Normalized example

```json
{
  "repository": "unknown",
  "revision": "unknown",
  "component": {
    "id": "unknown-component",
    "name": "Unknown component",
    "system": "unknown-system",
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
      "access": ["read"],
      "records": [
        {
          "id": "observed-keyspace",
          "name": "<observed redis key>",
          "kind": "keyspace",
          "keyPattern": "<observed key or pattern>",
          "ttl": "unknown",
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
      "reason": "The Redis key is observed, but the serialized fields were not resolved. Do not infer a DTO schema from a similarly named API model."
    }
  ]
}
```

### Missing-evidence handling

- Preserve the key/keyspace name and the observed purpose.
- Record access mode and TTL only when evidence exists.
- Leave `fields` empty when the serializer or record definition cannot be resolved.
- Surface the unresolved shape as an explicit gap instead of fabricating a schema.
- When evidence is later found, include `path`, `lines`, `revision`, and a precise `claim`.
