# Ies_Monitoring

Flask-based seismic monitoring platform (Swagger title: **EarthQuakeWatch API**) for:
- earthquake event ingestion/storage (keyed by SeisComP OID)
- ShakeMap job queueing (Celery + Redis) and product browsing
- publishing events to the IES WordPress site
- role-based user management
- JWT + API-key protected API access

---

## Core Features

- Manage seismic events (`/events`, `/api/events`, `/api/filter_event`)
- Queue ShakeMap by `seiscomp_oid` (`POST /api/shakemap`), poll job status
- View ShakeMap products on the event detail page (`/events/<seiscomp_oid>`):
  static images (`intensity`, `pga`, `pgv`, `psa0p3`, `psa1p0`, `psa3p0`) and
  an interactive Google Maps layer built from product JSON files
- Publish / unpublish events to WordPress (`/api/publish_event`, `/api/unpublish_event`)
- Manage users/roles/permissions (`/accounts`, `/api/accounts`, `/api/roles`)
- Manage notification recipients (email/phone APIs; no UI, nothing sends to them yet)

---

## Main Web Pages

| Path | Blueprint | Purpose |
|------|-----------|---------|
| `/` | app factory | Home |
| `/events` | `events` | Event list, create/edit/delete modals, filter |
| `/events/<seiscomp_oid>` | `events` | Event detail: ShakeMap status, generate, images, map, publish toggle |
| `/login` | `auth` | Login (+ forgot-password modal) |
| `/registration` | `auth` | Add user (needs `can_users` or `is_admin`; linked from `/accounts`) |
| `/reset_password/<token>` | `auth` | Password reset from email link (token valid 5 min) |
| `/change_password` | `auth` | Change own password |
| `/accounts` | `accounts` | User/role administration |

There is no standalone `/shakemap` page; ShakeMap UI lives on `/events/<seiscomp_oid>`.

Swagger UI: `/api`

---

## API Overview

All namespaces are mounted under `/api`. "Key or JWT" means `X-API-Key` **or** `Authorization: Bearer <access_token>`.

### Events
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/events` | public | Returns **404** when the table is empty |
| POST | `/api/events` | Key or JWT + `can_events` | Upsert by `seiscomp_oid` |
| PUT | `/api/events/<id>` | Key or JWT + `can_events` | `id` = primary key; `seiscomp_oid` is not editable |
| DELETE | `/api/events/<id>` | Key or JWT + `can_events` | Also deletes the related ShakeMap job |
| POST | `/api/filter_event` | public | Parameters are read from the **query string**: event_id, seiscomp_oid, location, area, ml_min/max, depth_min/max, start_time/end_time, shakemap_status |

### ShakeMap
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/shakemap` | Key or JWT + `can_shakemap` | Body `{seiscomp_oid}` → **202** `{status, job_id, task_id}`; **409** if already `waiting`/`running` |
| GET | `/api/shakemap/<seiscomp_oid>` | public | Job status + image list (`exists`, `url`) |
| GET | `/api/shakemap/<seiscomp_oid>/image/<image_type>` | public | `intensity`, `pga`, `pgv`, `psa0p3`, `psa1p0`, `psa3p0` (JPEG) |
| GET | `/api/shakemap/<seiscomp_oid>/product/<filename>` | public | Allowlist: `info.json`, `cont_mi.json`, `cont_pga.json`, `cont_pgv.json`, `cont_psa0p3.json`, `cont_psa1p0.json`, `cont_psa3p0.json`, `stationlist.json`, `rupture.json`, `mmi_legend.png` |

Files are read from `SHAKEMAP_BASE_PATH/<seiscomp_oid>/current/products/`.

### Publish (WordPress)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/publish_event` | Key or JWT + `can_events` | Body `{seiscomp_oid}`; needs `WP_PUBLISH_CODE` (else 500); WP error → 502 |
| POST | `/api/unpublish_event` | Key or JWT + `can_events` | Removes the `published_earthquakes` row |

### Auth
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/login` | public | JSON `{access_token}`; refresh token set as HttpOnly cookie (path `/api/refresh`) |
| POST | `/api/refresh` | refresh JWT | Returns new `access_token` |
| POST | `/api/logout` | public | Clears refresh cookie |
| POST | `/api/registration` | JWT + `can_users` or `is_admin` | Creates user with a given `role_name` |

### Accounts / Roles / Passwords
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/user` | JWT | Current user |
| PUT | `/api/user/<uuid>` | JWT (own uuid only) | Update name/lastname |
| GET | `/api/accounts` | JWT + `can_users` | User list |
| PUT | `/api/accounts/<uuid>` | JWT + `can_users` | Change user's role |
| GET / POST | `/api/roles` | JWT + `can_users` | List / create role |
| GET / PUT | `/api/roles/<role_id>` | JWT + `can_users` | Get / update role |
| POST | `/api/request_reset_password` | public | Sends reset link by email (60 s throttle) |
| PUT | `/api/reset_password` | token | Token from email, max age 5 min |
| PUT | `/api/change_password` | JWT | Requires current password |

### Notification recipients
| Method | Path | Auth |
|--------|------|------|
| GET / POST | `/api/phone_recipients` | JWT + `can_users` |
| GET / PUT / DELETE | `/api/phone_recipients/<id>` | JWT + `can_users` |
| GET / POST | `/api/email_recipients` | JWT + `can_users` |
| GET / PUT / DELETE | `/api/email_recipients/<id>` | JWT + `can_users` |

---

## Authentication Modes

1) **API Key**
- Header: `X-API-Key: <API_KEY>`
- Used for internal/system integrations (e.g. SeisComP)
- A valid key passes every `have_permission(...)` check
- ShakeMap jobs started with the key are attributed to the user `api_user@iliauni.edu.ge`; that user **must exist** (created by `flask populate_db`), otherwise `POST /api/shakemap` returns 500

2) **JWT**
- Header: `Authorization: Bearer <access_token>`
- Identity = `User.uuid`; claims include `role` and `permissions`
- Access token ~1 h, refresh token ~15 days
- Permission flags on `Role`: `is_admin`, `can_users`, `can_shakemap`, `can_events`
  (server-side checks use the specific flag; `is_admin` alone only grants `/api/registration`.
  The frontend's `hasPermission()` treats `is_admin` as all permissions.)

---

## ShakeMap Job Statuses

| Status | Meaning |
|--------|---------|
| `pending` | No job exists yet (computed by `SeismicEvent.shakemap_status`) |
| `waiting` | Queued in Celery |
| `running` | Worker is executing `sm_create` + `shake` |
| `generated` | Finished successfully |
| `failed` | Error stored in `shakemap_jobs.error` |

---

## Documentation

Step-by-step technical docs (Georgian): [`docs/README.md`](docs/README.md).

## Project Structure

```text
app.py                  # flask_app = create_app()
docs/                   # Stage-based project documentation (Georgian)
src/
  __init__.py           # App factory (CORS, logging, extensions, blueprints, CLI)
  config.py             # Environment-based config (Config, TestConfig)
  extensions.py         # db / migrate / jwt / RESTX api instances
  celery_app.py         # Celery + FlaskTask (app context)
  commands.py           # Flask CLI commands (init_db, populate_db)
  api/                  # REST resources
  api/nsmodels/         # RESTX namespaces, parsers, models
  models/               # SQLAlchemy models
  services/             # ShakeMap subprocess, mail, WP publish client, tokens
  tasks/                # Celery tasks (run_shakemap)
  workers/              # Worker wrapper around calc_shakemap
  views/                # Blueprints: auth, accounts, events
  templates/            # Jinja templates
  static/               # JS/CSS/images
  utils/                # auth helpers, validators
  logger/               # Logging configuration
migrations/             # Alembic migrations
tests/                  # unittest
instruction.txt         # Operations notes (Georgian)
conf_*.txt              # Gunicorn/Celery/Redis/Migration notes
ies_monitoring_*.service# systemd unit templates
reset_db.sh             # init_db + populate_db helper (see Known Issues)
```

---

## Requirements

- Python 3.10+
- Redis (Celery broker/backend)
- MySQL (production/development), SQLite (testing default)
- Conda env with ShakeMap (`sm_create`, `shake`) on the worker host

Python dependencies are listed in `requirements.txt`.

---

## Environment Variables

Set in `.env` (loaded by `src/config.py` from the current working directory). Full table: [`docs/05-environment.md`](docs/05-environment.md).

- `APP_ENV` (`production` | `development` | `testing`, default `testing`)
- `MY_SECRET_KEY`, `API_KEY`, `JWT_SECRET_KEY`
- `MYSQL_HOST`, `MYSQL_DATABASE`, `DEV_MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- `SQLALCHEMY_DATABASE_URI` (override for any env), `PROD_/DEV_/TEST_SQLALCHEMY_DATABASE_URI`
- `SHAKEMAP_BASE_PATH`, `CONDA_EXE`, `SHAKEMAP_CONDA_ENV`
- `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`
- `WP_PUBLISH_CODE`
- `GOOGLE_MAPS_API_KEY`

---

## Local Run

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Default dev server: `http://0.0.0.0:5000` (debug).

---

## Celery Worker Run

In a separate terminal (Redis running):

```bash
celery -A src.celery_app.celery_app worker --loglevel=info
```

Concurrency is set to 1 in `src/celery_app.py`; time limits 540 s soft / 600 s hard.

---

## Database Commands

```bash
# Recreate schema (destructive). In production also requires --force.
flask init_db --confirm-text RESET_DB

# Seed sample data: 1 event, roles Admin/API_USER/User, admin + api_user users
flask populate_db
```

Migrations:

```bash
flask db migrate -m "your message"
flask db upgrade
```

---

## Logging

Application logs are written under `logs/` (created automatically, rotated):

| File | Loggers |
|------|---------|
| `events.log` | `app.events` (events + publish) |
| `filters.log` | `app.filters` |
| `auth.log` | `app.auth` (auth + accounts) |
| `shakemap.log` | `app.shakemap`, `app.shakemap_api` |
| `run_shakemap.log` | `app.run_shakemap` |
| `requests.log` | `werkzeug` |

`app.calc_shakemap` and `app.notifications` have no handler, so only WARNING+ messages reach the root logger (stderr / journald).

---

## Testing

```bash
python -m unittest discover tests
```

`TestConfig` uses in-memory SQLite. Current coverage: config loading, `/` returns 200, empty `GET /api/events` returns 404.

---

## Known Issues

- `ies_monitoring_main.service` has two `ExecStart=` lines (Celery `--concurrency=2` + Gunicorn) with `Type=simple`; systemd refuses such a unit. Run only Gunicorn in the main unit (the corrected unit is in `conf_gunicorn.txt`) and Celery only in `ies_monitoring_celery.service`.
- `reset_db.sh` calls `flask init_db` without `--confirm-text RESET_DB`, so it stops at the confirmation check.
- `WP_AJAX_URL` in `src/services/wp_publish_client.py` is hardcoded to the staging host `ies-staging.iliauni.edu.ge`.
- `MYSQL_PASSWORD` has a non-empty hardcoded default in `src/config.py`; always set it in `.env`.
- `JWT_COOKIE_SECURE = True` is always on, so the refresh cookie needs HTTPS (or a browser that treats `localhost` as secure).
- Email after ShakeMap is disabled in `src/workers/run_shakemap.py`; `SendNotification` model has no API or writer yet.

---

## Notes

- `event_id` is optional in seismic events; ShakeMap and publish flows depend on `seiscomp_oid`.
- For production/systemd setup, see `instruction.txt` and `conf_*.txt`.
