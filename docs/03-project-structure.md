# 3. პროექტის სტრუქტურა

```text
Ies_Shakemap/
├── app.py                      # flask_app = create_app(); dev run :5000
├── requirements.txt
├── README.md                   # EN: მიმოხილვა + სრული API ცხრილი
├── instruction.txt             # GE: operations ნოტები
├── conf_*.txt                  # gunicorn / celery / redis / migration tips
├── ies_monitoring_main.service # systemd: Gunicorn (იხ. known issues)
├── ies_monitoring_celery.service # systemd: Celery worker
├── reset_db.sh                 # init_db + populate_db (იხ. 04-local-setup)
├── docs/                       # ეს დოკუმენტაცია
├── migrations/                 # Alembic
├── tests/                      # unittest
└── src/
    ├── __init__.py             # create_app factory
    ├── config.py               # Config, TestConfig
    ├── extensions.py           # db, migrate, jwt, restx api
    ├── celery_app.py           # Celery + FlaskTask
    ├── commands.py             # flask init_db, populate_db
    ├── api/                    # REST resources
    │   ├── nsmodels/           # namespaces, parsers, models
    │   ├── seismic_event.py
    │   ├── calc_shakemap.py
    │   ├── publish_event.py
    │   ├── auth.py
    │   ├── accounts.py
    │   ├── filters.py
    │   └── notif_recips.py
    ├── models/
    │   ├── seismic_event.py
    │   ├── celery_jobs.py      # ShakemapJob
    │   ├── users.py            # User, Role
    │   ├── notif_recips.py     # PhoneRecipient, EmailRecipient,
    │   │                       # PublishedEarthquake, SendNotification
    │   └── base.py             # create/save/delete helpers
    ├── services/
    │   ├── calc_shakemap.py    # sm_create + shake subprocess
    │   ├── wp_publish_client.py
    │   ├── mail.py             # SMTP (password reset)
    │   ├── email_sender.py     # ShakeMap email (ამჟამად არ გამოიძახება)
    │   └── url_serializer.py   # password reset tokens
    ├── tasks/
    │   └── shakemap.py         # @celery.task run_shakemap
    ├── workers/
    │   └── run_shakemap.py
    ├── views/                  # HTML blueprints
    │   ├── events/             # /events, /events/<seiscomp_oid>
    │   ├── auth/               # /login, /registration, /reset_password/<token>, /change_password
    │   └── accounts/           # /accounts
    ├── templates/              # Jinja (base, navbar, index, 404/500, events/, auth/, accounts/, macros/)
    ├── static/                 # css, js, img
    ├── utils/
    │   ├── auth_utils.py       # is_authorized_request, have_permission
    │   └── validators.py
    └── logger/
```

## სად რა იძებნება

| კითხვა | სად ნახო |
|--------|----------|
| ახალი API endpoint | `src/api/` + რეგისტრაცია `src/api/__init__.py` + schema `nsmodels/` |
| ახალი HTML გვერდი | `src/views/*/routes.py` + `templates/` (ახალი blueprint → `src/views/__init__.py` + `BLUEPRINTS` `src/__init__.py`-ში) |
| ShakeMap UI | `templates/events/eventDetail.html` + `static/js/events/eventDetail.js` + `static/js/shakemap/map.js` |
| WP publish | `src/api/publish_event.py` + `src/services/wp_publish_client.py` |
| ლოგების ფაილები | `src/logger/logging_config.py` |
| DB ცხრილი | `src/models/` + migration |
| ShakeMap shell ლოგიკა | `src/services/calc_shakemap.py` |
| async job lifecycle | `src/api/calc_shakemap.py` + `src/tasks/shakemap.py` |
| უფლებები | `Role` flags + `src/utils/auth_utils.py` |
| env / DB URI | `src/config.py` |

## Frontend JS (მოკლე რუკა)

| ფაილი | როლი |
|-------|------|
| `static/js/events/events.js` | ივენთების სია, create ღილაკის permission gate |
| `static/js/events/createEvent.js`, `editEvent.js`, `deleteEvent.js` | CRUD modals (`/api/events`) |
| `static/js/events/filterEvent.js` | ფილტრი (`/api/filter_event`) |
| `static/js/events/map.js` | ივენთების Google Map |
| `static/js/events/eventDetail.js` | detail გვერდი: ShakeMap status/generate/polling, სურათები, publish toggle |
| `static/js/shakemap/map.js` | ShakeMap Google Maps ფენები `product/<filename>`-დან |
| `static/js/auth/*.js` | login, registration, forget/reset/change password, user modal |
| `static/js/accounts/*.js` | users/roles UI |
| `static/js/globalAccessControl.js` | JWT decode, `hasPermission()`, auto refresh, `makeApiRequest()` |
| `static/js/navbar.js` | ნავიგაცია (Home, Earthquakes, Login/Logout) |

`/accounts` და `/change_password`-ზე გადასვლა ხდება user modal-იდან (`auth/user.js`), `/registration`-ზე — `/accounts`-ის „Add User“ ღილაკიდან.

## Tests & commands

ტესტები (`tests/test_app.py`) ამჟამად ფარავს მხოლოდ: `TestConfig` ჩატვირთვას, `/` → 200, ცარიელი `GET /api/events` → 404.

```bash
python -m unittest discover tests
flask init_db --confirm-text RESET_DB
flask populate_db
flask db migrate -m "..."
flask db upgrade
```

## შემდეგი

→ [ლოკალური დაყენება](04-local-setup.md)
