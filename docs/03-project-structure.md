# 3. პროექტის სტრუქტურა

```text
Ies_Shakemap/
├── app.py                      # Flask entry (create_app + run)
├── requirements.txt
├── README.md
├── instruction.txt             # GE: operations ნოტები
├── conf_*.txt                  # gunicorn / celery / redis / migration tips
├── ies_monitoring_*.service    # systemd unit templates
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
    │   ├── notif_recips.py
    │   └── base.py             # create/save/delete helpers
    ├── services/
    │   ├── calc_shakemap.py    # sm_create + shake subprocess
    │   ├── wp_publish_client.py
    │   ├── mail.py / email_sender.py
    │   └── url_serializer.py   # password reset tokens
    ├── tasks/
    │   └── shakemap.py         # @celery.task run_shakemap
    ├── workers/
    │   └── run_shakemap.py
    ├── views/                  # HTML blueprints
    │   ├── events/
    │   ├── shakemap/
    │   ├── auth/
    │   └── accounts/
    ├── templates/              # Jinja
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
| ახალი HTML გვერდი | `src/views/*/routes.py` + `templates/` |
| DB ცხრილი | `src/models/` + migration |
| ShakeMap shell ლოგიკა | `src/services/calc_shakemap.py` |
| async job lifecycle | `src/api/calc_shakemap.py` + `src/tasks/shakemap.py` |
| უფლებები | `Role` flags + `src/utils/auth_utils.py` |
| env / DB URI | `src/config.py` |

## Frontend JS (მოკლე რუკა)

| ფაილი | როლი |
|-------|------|
| `static/js/events/*.js` | CRUD, filter, map |
| `static/js/shakemap/shakemap.js` | queue job, gallery, status |
| `static/js/auth/*.js` | login, registration, passwords |
| `static/js/accounts/*.js` | users/roles UI |
| `static/js/globalAccessControl.js` | client-side permission gates |
| `static/js/navbar.js` | ნავიგაცია |

## Tests & commands

```bash
python -m unittest discover tests
flask init_db --confirm-text RESET_DB
flask populate_db
flask db migrate -m "..."
flask db upgrade
```

## შემდეგი

→ [ლოკალური დაყენება](04-local-setup.md)
