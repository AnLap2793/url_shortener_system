---
title: URL Shortener System — C4 Views
status: draft
created: 2026-07-19
updated: 2026-07-19
source: ARCHITECTURE-SPINE.md
---

# URL Shortener System — C4 Views

`ARCHITECTURE-SPINE.md` thắng khi có xung đột. Các sơ đồ này phục vụ học system design và thảo luận implementation.

## 1. System Context

```mermaid
flowchart LR
    Marketer[Marketing team member]
    Visitor[Public visitor]
    Google[Google OAuth]
    Email[Transactional email provider]
    System[URL Shortener System]

    Marketer -->|Create/manage links; view analytics| System
    Visitor -->|Open short URL| System
    System -->|OAuth/OIDC| Google
    System -->|Verification email| Email
    System -->|HTTP 302 redirect| Visitor
```

## 2. Container View

```mermaid
flowchart TB
    Browser[Browser — React Router SPA]
    Visitor[Visitor browser/client]
    API[NestJS API and static host]
    Worker[Analytics worker]
    PG[(Managed PostgreSQL)]
    Google[Google OAuth]
    Email[Email provider]
    Metrics[Render logs and metrics sink]

    Browser -->|Same-origin HTTPS /api| API
    Visitor -->|GET /shortPath| API
    API -->|Sessions/OAuth| Google
    API -->|Verification messages| Email
    API -->|Drizzle SQL| PG
    Worker -->|Claim events, UPSERT facts, retention| PG
    PG -.->|LISTEN/NOTIFY wake signal| Worker
    API -->|JSON logs and metrics| Metrics
    Worker -->|JSON logs and metrics| Metrics
```

## 3. API Component View

```mermaid
flowchart LR
    Static[Static SPA handler]
    AuthHandler[Better Auth Node handler]
    Controllers[Nest controllers]
    Application[packages/application use cases]
    Redirect[Redirect use case]
    Links[Link management use cases]
    Analytics[Analytics query use cases]
    Actor[Session actor resolver]
    Repos[Drizzle repositories]
    PG[(PostgreSQL)]

    Static -.sibling handler.-> Controllers
    AuthHandler --> PG
    Controllers --> Actor
    Actor --> AuthHandler
    Controllers --> Application
    Application --> Redirect
    Application --> Links
    Application --> Analytics
    Redirect --> Repos
    Links --> Repos
    Analytics --> Repos
    Repos --> PG

    Note[Bootstrap: bodyParser false; mount /api/auth/*splat before JSON parser; then initialize remaining Nest middleware]:::note
    classDef note fill:#fff7e6,stroke:#8a5700,color:#624000;
    AuthHandler -.-> Note;
    Static -.-> Note;
```

Route precedence inside the API process:

```mermaid
flowchart TD
    Request[Incoming request] --> Reserved{Fixed reserved prefix or asset?}
    Reserved -->|/api/auth/*| Auth[Better Auth handler]
    Reserved -->|/api/*| Api[Nest API controller]
    Reserved -->|health or immutable static asset| System[System/static handler]
    Reserved -->|No| ShortPath{GET exact one root segment?}
    ShortPath -->|Yes| Registry[Lookup short_path_registry]
    Registry -->|active| Redirect[Redirect controller]
    Registry -->|tombstoned or absent| NotFound[404]
    ShortPath -->|No, browser route| Spa[React SPA index]
    ShortPath -->|No, unsupported| NotFound
```

## 4. Redirect and Capture Sequence

```mermaid
sequenceDiagram
    participant V as Visitor
    participant A as Nest API
    participant G as Local bot/GeoIP/UA rules
    participant P as PostgreSQL

    V->>A: GET /summer-sale-email
    A->>P: Indexed short_path lookup
    P-->>A: Active link + current destination
    A->>G: Recognized bot? derive dimensions
    G-->>A: human + country/city/device/browser or unknown
    A->>P: INSERT Click Event(UUID, UTC, UTM snapshot, dimensions)
    P-->>A: Commit
    alt Event commit succeeds
        P-->>A: Commit
        A-->>V: 302 Location + Cache-Control: no-store
    else Event commit fails after bounded retry
        P-->>A: Failure
        A-->>V: 503 Service Unavailable, no redirect
    end
```

Failure rules:

- Link missing/deleted/tombstoned: 404, no external redirect.
- Recognized bot/link preview: 302, no Click Event.
- Local enrichment failure: write `unknown`, continue.
- PostgreSQL lookup/pool/event commit failure: 503, no external redirect.

## 5. Worker and Aggregation Sequence

```mermaid
sequenceDiagram
    participant P as PostgreSQL
    participant W as Analytics worker
    participant M as Metrics/alerts

    P-->>W: NOTIFY event id (wake hint)
    loop Poll after wake or timeout
        W->>P: Claim pending rows FOR UPDATE SKIP LOCKED + lease
        P-->>W: Event batch
        W->>P: Transaction: INSERT processed UUID ON CONFLICT DO NOTHING RETURNING
        alt marker acquired and lease token current
            W->>P: UPSERT daily fact + mark processed
            P-->>W: Commit
        else marker already exists
            W->>P: Mark raw row processed without aggregate change
        else transient failure before attempt 5
            W->>P: Schedule retry with DB-clock available_at + backoff
        else attempt 5 exhausted
            W->>P: Mark dead-letter; replay allowed only before 30-day expiry
            W->>M: Alert dead-letter
        else raw/dead-letter reaches 30 days
            W->>P: Delete raw row; preserve processed UUID ledger
            W->>M: Emit reconciliation-loss metric if unprocessed
        end
    end
```

## 6. Deployment View

```mermaid
flowchart TB
    Internet[Internet]
    subgraph Singapore[Render Singapore region]
        Web[Web service — NestJS + React assets]
        Worker[Background worker]
        DB[(Managed PostgreSQL 18)]
        Deploy[Pre-deploy migration job]
        Logs[Render logs/metrics]

        Web <-->|Private network| DB
        Worker <-->|Private network| DB
        Deploy -->|Drizzle migrations once| DB
        Web --> Logs
        Worker --> Logs
    end

    Internet -->|HTTPS| Web
```

## 7. Core Data Relationships

```mermaid
erDiagram
    USER ||--o{ SHORT_LINK : owns
    SHORT_PATH ||--o| SHORT_LINK : maps_when_active
    SHORT_LINK ||--o{ CLICK_EVENT : receives
    SHORT_LINK ||--o{ DAILY_DIMENSION_FACT : aggregates
    PROCESSED_EVENT }o--|| SHORT_LINK : retained_ledger
    CLICK_EVENT }o--|| SHORT_LINK : receives

    SHORT_PATH {
      uuid id PK
      text short_path UK
      text state
      uuid active_link_id FK
    }
    SHORT_LINK {
      uuid id PK
      text owner_id FK
      uuid short_path_id FK
      text destination_url
      boolean active
    }
    CLICK_EVENT {
      uuid event_id PK
      uuid short_link_id FK
      timestamptz occurred_at
      text utm_source
      text utm_medium
      text utm_campaign
      text referrer_host
      text country
      text city
      text device
      text browser
      timestamptz available_at
      timestamptz lease_until
      uuid lease_token
      integer attempts
      text status
    }
    PROCESSED_EVENT {
      uuid event_id PK
      uuid short_link_id FK
      timestamptz processed_at
    }
    DAILY_DIMENSION_FACT {
      date utc_day
      uuid short_link_id FK
      text referrer_host
      text country
      text city
      text device
      text browser
      text utm_source
      text utm_medium
      text utm_campaign
      bigint click_count
    }
```
