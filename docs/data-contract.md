# Data Contract

The dashboard accepts a benchmark payload:

```json
{
  "ok": true,
  "meta": {},
  "data": {
    "interface": [],
    "events": [],
    "dictionary": []
  }
}
```

`data.interface` is the source of truth. `events` and `dictionary` can be empty arrays.

## Required Interface Fields

| Field | Notes |
| --- | --- |
| `date` | `YYYY-MM-DD` period date |
| `period_type` | Usually `monthly`, `quarterly`, or `annual` |
| `company_id` | Stable entity ID |
| `display_name` | UI label |
| `type` | Usually `competitor` or `benchmark` |
| `market` | Market/filter label |
| `revenue` | Numeric revenue value or `null` |
| `visits` | Numeric visit value or `null` |
| `data_type` | `actual`, `estimated`, or `forecast` |

## Optional Enriched Fields

- `market_share_revenue`
- `market_share_visits`
- `revenue_yoy_growth`
- `visits_yoy_growth`
- `revenue_mom_growth`
- `visits_mom_growth`
- `rank_revenue`
- `rank_visits`
- `revenue_per_visit`
- `revenue_share_vs_visit_share`
- `indexed_revenue`
- `indexed_visits`
- `forecast_scenario`
- `active`
- `color`
- `logo`
- event fields such as `event_summary`, `event_names`, `event_type`, `expected_impact`

Existing enriched metrics are preserved by default. Set `recalculateDerivedMetrics: true` in config or use an adapter that recalculates when source rows are simple.

## Minimum Simple Monthly Input

```json
[
  {
    "date": "2026-01-01",
    "company_id": "brand_a",
    "display_name": "Brand A",
    "market": "Demo Market",
    "revenue": 125000,
    "visits": 82000
  }
]
```

Convert this with `adaptSimpleMonthlyRows()` to produce an enriched benchmark payload.

## Enriched Payload Example

```json
{
  "ok": true,
  "meta": {
    "source": "Demo Connector"
  },
  "data": {
    "interface": [
      {
        "date": "2026-01-01",
        "period_type": "monthly",
        "company_id": "brand_a",
        "display_name": "Brand A",
        "type": "competitor",
        "market": "Demo Market",
        "revenue": 125000,
        "visits": 82000,
        "data_type": "estimated",
        "market_share_revenue": 0.42,
        "market_share_visits": 0.38,
        "rank_revenue": 1,
        "rank_visits": 2,
        "revenue_per_visit": 1.5244,
        "revenue_share_vs_visit_share": 0.04
      }
    ],
    "events": [],
    "dictionary": []
  }
}
```
