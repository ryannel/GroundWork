# Groundwork catalog proposal

## Classification dimensions
- **Component**: internal business service
- **Outbound dependencies**:
  - LaunchDarkly — external **platform-service**, owned **external**, transported via **sdk/http**
  - Internal API A — **business-service**, owned **internal**, transported via **http**
  - Internal API B — **business-service**, owned **internal**, transported via **http**
  - Partner payment API — **external-provider**, owned **external**, transported via **http**
- **Data at rest**:
  - Redis — **cache**, accessed **read/write**, stores a separate **keyspace/record** shape

## Normalized example records
```json
{
  "repository": "ryannel-verbose-adventure",
  "revision": "f410533d5d071ba31ce08c8746463946c4ebd226",
  "component": {
    "id": "service",
    "name": "Service",
    "system": "unresolved",
    "ownership": "internal",
    "role": "business-service"
  },
  "relations": [
    {
      "direction": "outbound",
      "target": "launchdarkly",
      "role": "platform-service",
      "ownership": "external",
      "transport": "sdk",
      "operation": "Evaluate feature flags",
      "evidence": []
    },
    {
      "direction": "outbound",
      "target": "internal-api-a",
      "role": "business-service",
      "ownership": "internal",
      "transport": "http",
      "operation": "Call internal API A",
      "evidence": []
    },
    {
      "direction": "outbound",
      "target": "internal-api-b",
      "role": "business-service",
      "ownership": "internal",
      "transport": "http",
      "operation": "Call internal API B",
      "evidence": []
    },
    {
      "direction": "outbound",
      "target": "partner-payment-api",
      "role": "external-provider",
      "ownership": "external",
      "transport": "http",
      "operation": "Submit partner payment request",
      "evidence": []
    }
  ],
  "apis": [],
  "resources": [
    {
      "id": "redis-cache",
      "kind": "cache",
      "technology": "Redis",
      "access": ["read", "write"],
      "records": [
        {
          "id": "service-records",
          "name": "service:records:{id}",
          "kind": "keyspace",
          "keyPattern": "service:records:{id}",
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
      "area": "resources.redis-cache.records.service-records.fields",
      "reason": "Redis value schema was not provided, so the serialized record fields remain unresolved."
    },
    {
      "area": "component.system",
      "reason": "No Backstage or Atlas source was provided to resolve the canonical system boundary."
    }
  ]
}
```
