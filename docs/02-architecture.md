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

1. `CORS(app)` (Flask-CORS, ყველა origin)
2. იტვირთება `Config` (`.env`)
3. logging (`src/logger`)
4. route `/` (home) + context processor (`google_maps_api_key` template-ებში)
5. extensions: `db`, `migrate`, `jwt`, RESTX `api` (ყველა namespace `path='/api'`)
6. blueprints (HTML): `auth`, `accounts`, `events` — ცალკე `shakemap` blueprint არ არის
7. CLI: `init_db`, `populate_db`
8. 404/500 handlers (HTML template)

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
        ├─ SeismicEvent by OID            (არ არის → 404)
        ├─ job უკვე waiting/running       → 409
        ├─ create/update ShakemapJob → status=waiting
        │    (API key-ით: job.uuid = api_user@iliauni.edu.ge-ს uuid)
        └─ run_shakemap.delay(job_id) → 202 {status, job_id, task_id}

Celery task run_shakemap(job_id):
        │
        ├─ status=running
        ├─ build parsed_data from SeismicEvent
        ├─ run_shakemap_worker → calc_shakemap (subprocess bash + conda)
        └─ status=generated | failed (+ error, finished_at)

GET /api/shakemap/<oid>                       (საჯარო) job status + images[]
GET /api/shakemap/<oid>/image/<type>          (საჯარო) intensity|pga|pgv|psa0p3|psa1p0|psa3p0
GET /api/shakemap/<oid>/product/<filename>    (საჯარო) allowlist: info.json, cont_*.json,
                                                        stationlist.json, rupture.json, mmi_legend.png
        │
        └─ files under SHAKEMAP_BASE_PATH/{oid}/current/products/
```

სტატუსები: `pending` (job ჯერ არ არსებობს) → `waiting` → `running` → `generated` | `failed`.

### UI მხარე

`/events/<seiscomp_oid>` (`templates/events/eventDetail.html`):

- `static/js/events/eventDetail.js` — სტატუსის badge, „Generate“ (`POST /api/shakemap`, `can_shakemap`), polling `GET /api/shakemap/<oid>`-ზე სანამ job `waiting`/`running`-ია, სურათების toolbar, publish toggle (`can_events`)
- `static/js/shakemap/map.js` — Google Maps ფენები (Intensity, PGA, PGV, PSA) `product/<filename>` ფაილებიდან, ეპიცენტრი, სადგურები, rupture, legend

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

API key-ით job-ზე იწერება სპეციალური მომხმარებელი `api_user@iliauni.edu.ge`. ეს user **აუცილებლად** უნდა არსებობდეს DB-ში (`flask populate_db` ქმნის) — თორემ `POST /api/shakemap` API key-ით 500-ს აბრუნებს.

Frontend: `access_token` ინახება `localStorage`-ში; `static/js/globalAccessControl.js` ვადაგასვლისას ავტომატურად იძახებს `/api/refresh`-ს და `hasPermission()`-ით მალავს/აჩენს ღილაკებს (`is_admin` frontend-ზე ყველა უფლებად ითვლება, backend-ზე — არა; იქ მოწმდება კონკრეტული flag).

## Publish ნაკადი

```text
POST /api/publish_event { seiscomp_oid }
  → API key ან JWT + can_events
  → WP_PUBLISH_CODE ცარიელია → 500
  → wp_publish_client.publish_eq(...)   (WP id = event_id, ან seiscomp_oid თუ event_id არ არის)
  → WP შეცდომა → 502
  → PublishedEarthquake row (create/update, wp_response)

POST /api/unpublish_event { seiscomp_oid }
  → unpublish_eq(...)
  → delete PublishedEarthquake row
```

WP endpoint: `WP_AJAX_URL` hardcoded-ია `src/services/wp_publish_client.py`-ში (`https://ies-staging.iliauni.edu.ge/wp-admin/admin-ajax.php`). Production საიტზე გადასასვლელად კოდის შეცვლაა საჭირო.

## concurrency და უარყოფითი გარანტიები

- Celery: `worker_concurrency=1` — ერთდროულად ერთი ShakeMap (CLI-ის `--concurrency` ამას გადაფარავს)
- soft/hard time limits: 540 / 600 წამი
- `worker_prefetch_multiplier=1`, `worker_max_tasks_per_child=100`, `worker_max_memory_per_child≈200MB`
- იგივე `seiscomp_oid`-ზე `waiting`/`running` → **409** (არ იდუბლირება რიგში)

## Swagger

RESTX Api doc: **`/api`**  
Authorizations: `JsonWebToken`, `ApiKeyAuth` (`src/config.py` + `src/extensions.py`).

## შემდეგი

→ [პროექტის სტრუქტურა](03-project-structure.md)
