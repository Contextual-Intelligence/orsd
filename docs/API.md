# ORSD API Reference

Base URL: `https://orsd.contextual-intelligence.org`

## Root

```
GET /
```

Returns dataset metadata, licensing info, and endpoint list.

```json
{
  "name": "Open Regulatory Signal Dataset (ORSD)",
  "version": "0.1",
  "endpoints": {
    "stats": "/v1/stats",
    "companies": "/v1/companies",
    "signals": "/v1/signals"
  }
}
```

## Health

```
GET /api/health
```

Returns service status and dependency checks.

```json
{
  "status": "ok",
  "timestamp": "2026-07-25T12:00:00.000Z",
  "checks": {
    "dgraph": "up"
  }
}
```

## Stats

```
GET /v1/stats
```

Returns dataset statistics.

```json
{
  "name": "Open Regulatory Signal Dataset (ORSD)",
  "version": "0.1",
  "stats": {
    "companies": 1240,
    "signals": 58200,
    "signal_types": ["FDA_510K", "FDA_PMA", "EUDAMED_CERTIFICATE", "WHO_PQ"],
    "coverage": {
      "countries": ["US", "EU", "BR", "CN", "JP", "IN", "KR", "AU", "CA", "WHO"],
      "data_sources": 22
    }
  },
  "_links": {
    "self": "https://orsd.contextual-intelligence.org/v1/stats",
    "companies": "https://orsd.contextual-intelligence.org/v1/companies",
    "signals": "https://orsd.contextual-intelligence.org/v1/signals"
  }
}
```

## Companies

```
GET /v1/companies
```

Returns all tracked companies with their regulatory signals.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 100 | Results per page (max 1000) |
| `offset` | int | 0 | Pagination offset |
| `segment` | string | — | Filter by segment (e.g. `IVD_MANUFACTURER`) |
| `region` | string | — | Filter by region (e.g. `EU`) |

```json
{
  "data": [
    {
      "normalizedName": "siemens-healthineers",
      "name": "Siemens Healthineers",
      "domain": "siemens-healthineers.com",
      "segment": "IVD_MANUFACTURER",
      "region": "EU",
      "hasSignal": [
        { "type": "FDA_510K", "date": "2026-06-15" }
      ]
    }
  ],
  "meta": {
    "total": 1240,
    "limit": 100,
    "offset": 0,
    "version": "0.1",
    "updated_at": "2026-07-25T12:00:00.000Z"
  }
}
```

## Signals

```
GET /v1/signals
```

Returns regulatory signals with pagination and filters.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | Filter by signal type (e.g. `FDA_510K`, `WHO_PQ`) |
| `source` | string | — | Filter by source (`fda`, `eudamed`, `who`, `clinicaltrials`, ...) |
| `jurisdiction` | string | — | Filter by jurisdiction (`US`, `EU`, `BR`, `CN`, `JP`, `IN`, `KR`, `AU`, `CA`, `WHO`) |
| `limit` | int | 100 | Results per page (max 1000) |
| `offset` | int | 0 | Pagination offset |

Invalid filter values return HTTP 400 with an explanatory message.

**Response:**

```json
{
  "data": [
    {
      "id": "a1b2c3d4e5f6...",
      "externalId": "K123456",
      "source": "fda",
      "jurisdiction": "US",
      "type": "FDA_510K",
      "title": "510(k) Premarket Notification",
      "date": "2026-06-15",
      "confidence": 0.95,
      "description": "510(k) K123456: Siemens Atellica IM Analyzer by Siemens Healthineers",
      "url": "https://www.accessdata.fda.gov/...",
      "companyName": "siemens healthineers",
      "productName": "Atellica IM Analyzer",
      "productCode": "ABC",
      "metadata": ["clearanceType: Traditional", "state: CA"],
      "ingestedAt": "2026-06-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1234,
    "limit": 100,
    "offset": 0,
    "version": "0.1",
    "updated_at": "2026-07-25T12:00:00.000Z"
  }
}
```

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `invalid_filter` | Filter value contains invalid characters or failed allow-list check |
| 404 | `not_found` | Route does not exist |
| 503 | `database_unavailable` | Dgraph is unreachable or query failed |

## Rate Limiting

Public API: 100 requests/minute per IP. No authentication required for read endpoints.
