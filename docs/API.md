# ORSD API Reference

Base URL: `https://orsd.contextual-intelligence.org`

## Root

```
GET /
```

Returns dataset metadata, licensing info, and endpoint list.

## Health

```
GET /api/health
```

Returns service status and dependency checks.

**Response:**
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

**Response:**
```json
{
  "name": "Open Regulatory Signal Dataset (ORSD)",
  "version": "0.1",
  "stats": {
    "companies": 1240,
    "signals": 58200,
    "signal_types": ["FDA_510K", "FDA_PMA", "EUDAMED_CERTIFICATE"],
    "coverage": {
      "countries": ["US", "EU", "BR", "CN", "JP", "IN", "KR", "AU", "CA", "WHO"],
      "data_sources": 22
    }
  }
}
```

## Companies

```
GET /v1/companies
```

Returns all tracked companies with their regulatory signals.

**Response:**
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
    "version": "0.1",
    "updated_at": "2026-07-25T12:00:00.000Z"
  }
}
```

## Signals

```
GET /v1/signals?type=FDA_510K&limit=100&offset=0
```

Returns regulatory signals, filterable by type and paginated.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | Filter by signal type (e.g. `FDA_510K`) |
| `limit` | int | 100 | Results per page (max 1000) |
| `offset` | int | 0 | Pagination offset |

**Response:**
```json
{
  "data": [
    {
      "type": "FDA_510K",
      "date": "2026-06-15",
      "confidence": 0.95,
      "description": "510(k) K123456: Siemens Atellica IM Analyzer by Siemens Healthineers",
      "url": "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K123456"
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

## Rate Limiting

Public API: 100 requests/minute per IP. No authentication required for read endpoints.
