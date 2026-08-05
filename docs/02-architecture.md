# 2. არქიტექტურა

## მაღალი დონის სურათი

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  SeisComP /     │     │  Flask app           │     │  MySQL / SQLite │
│  integrations   │────▶│  (Gunicorn / dev)    │────▶│  (SQLAlchemy)   │
│  X-API-Key      │     │  RESTX + Jinja UI    │     └─────────────────┘
└─────────────────┘     └──────────┬───────────┘
                                   │
                    enqueue job    │
                                   ▼
                         ┌─────────────────┐
                         │  Redis          │
                         │  broker/backend │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐     ┌──────────────────┐
                         │  Celery worker  │────▶│  ShakeMap tools  │
                         │  concurrency=1  │     │  sm_create/shake │
                         └─────────────────┘     │  disk products   │
                                                 └──────────────────┘

                         ┌─────────────────┐
                         │  WordPress AJAX │
                         │  publish/unpub  │
                         └─────────────────┘
```

## Flask app factory

შესასვლელი წერტილი: `app.py` → `src.create_app()`.

`create_app()`:

1. იტვირთება `Config` (`.env`)
2. logging (`src/logger`)
3. extensions: `db`, `migrate`, `jwt`, RESTX `api`
4. blueprints (HTML): events, shakemap, auth, accounts
5. CLI: `init_db`, `populate_db`
6. 404/500 handlers

JWT identity = `User.uuid`; token-ში claims: role + permissions.

## ფენები

| ფენა | პაკეტი | პასუხისმგებლობა |
|------|--------|-----------------|
| HTTP pages | `src/views/` | route → Jinja template |
| HTTP API | `src/api/` | REST resources, auth, validation |
| Schemas | `src/api/nsmodels/` | parsers, models, namespaces (Swagger) |
| Domain/models | `src/models/` | SQLAlchemy tables + relationships |
| Services | `src/services/` | external/side-effect logic (ShakeMap, mail, WP) |
| Tasks | `src/tasks/` | Celery entrypoints |
| Workers | `src/workers/` | thin wrappers around services |
| Utils | `src/utils/` | auth helpers, validators |
| Config | `src/config.py`, `src/extensions.py` | settings, singletons |

**წესი:** API რესურსი არ უშვებს პირდაპირ `sm_create`-ს — ქმნის `ShakemapJob`-ს და აბრუნებს Celery task-ს. გამოთვლა = worker-ში.

## ძირითადი request/job ნაკადი (ShakeMap)

```text
POST /api/shakemap { seiscomp_oid }
        │
        ├─ is_authorized_request()  (API key ან JWT)
        ├─ have_permission("can_shakemap")
        ├─ SeismicEvent by OID
        ├─ create/update ShakemapJob → status=waiting
        └─ run_shakemap.delay(job_id) → 202 + task_id

Celery task run_shakemap(job_id):
        │
        ├─ status=running
        ├─ build parsed_data from SeismicEvent
        ├─ run_shakemap_worker → calc_shakemap (subprocess bash + conda)
        └─ status=generated | failed (+ error, finished_at)

GET /api/shakemap/<oid>
GET /api/shakemap/<oid>/image/<pga|pgv|intensity>
        │
        └─ files under SHAKEMAP_BASE_PATH/{oid}/current/products/
```

## Auth ნაკადი

```text
POST /api/login
  → access_token (JSON)
  → refresh_token (HttpOnly cookie, path=/api/refresh)

POST /api/refresh  (refresh JWT cookie/header)
  → ახალი access_token

API call:
  X-API-Key: <API_KEY>     → სისტემური access (have_permission = True)
  ან
  Authorization: Bearer …  → User.role.check_permission(...)
```

API key-ით job-ზე იწერება სპეციალური მომხმარებელი `api_user@iliauni.edu.ge` (თუ არსებობს DB-ში).

## Publish ნაკადი

```text
POST /api/publish_event { seiscomp_oid }
  → can_events
  → wp_publish_client.publish_eq(...)
  → PublishedEarthquake row

POST /api/unpublish_event
  → unpublish_eq(...)
  → delete PublishedEarthquake row
```

## concurrency და უარყოფითი გარანტიები

- Celery: `worker_concurrency=1` — ერთდროულად ერთი ShakeMap
- soft/hard time limits: ~9 / 10 წუთი
- იგივე `seiscomp_oid`-ზე `waiting`/`running` → **409** (არ იდუბლირება რიგში)

## Swagger

RESTX Api doc: **`/api`**  
Authorizations: `JsonWebToken`, `ApiKeyAuth` (`src/config.py` + `src/extensions.py`).

## შემდეგი

→ [პროექტის სტრუქტურა](03-project-structure.md)
