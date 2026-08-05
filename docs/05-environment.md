# 5. გარემოს ცვლადები

იტვირთება `src/config.py`-დან (`.env` root-ში, `python-dotenv`).

## აპლიკაცია

| ცვლადი | default / შენიშვნა | სავალდებულო |
|--------|--------------------|-------------|
| `APP_ENV` | `testing` — `production` \| `development` \| `testing` | დიახ (valid value) |
| `MY_SECRET_KEY` | Flask secret | production: დიახ |
| `API_KEY` | `X-API-Key` header-ისთვის | production: დიახ |
| `JWT_SECRET_KEY` | JWT ხელმოწერა (ძლიერი მნიშვნელობა) | production: დიახ |
| `GOOGLE_MAPS_API_KEY` | რუკა frontend-ში | UI maps-ისთვის |

JWT ქცევა კოდში:

- access ≈ 1 საათი
- refresh ≈ 15 დღე
- refresh cookie path: `/api/refresh`
- `JWT_COOKIE_SECURE = True` (HTTPS production)

## ბაზა

| ცვლადი | შენიშვნა |
|--------|----------|
| `MYSQL_HOST` | default `localhost` |
| `MYSQL_DATABASE` | prod DB name |
| `DEV_MYSQL_DATABASE` | dev DB name |
| `MYSQL_USER` / `MYSQL_PASSWORD` | credentials |
| `SQLALCHEMY_DATABASE_URI` | სრული override (ნებისმიერ env-ში) |
| `PROD_SQLALCHEMY_DATABASE_URI` | prod override |
| `DEV_SQLALCHEMY_DATABASE_URI` | dev override |
| `TEST_SQLALCHEMY_DATABASE_URI` | default: `sqlite:///.../db.sqlite` |

`APP_ENV`-ის მიხედვით ირჩევა URI. უცნობი `APP_ENV` → `ValueError`.

## ShakeMap

| ცვლადი | შენიშვნა |
|--------|----------|
| `SHAKEMAP_BASE_PATH` | products root; default `~/shakemap_profiles/default/data` |
| `CONDA_EXE` | მაგ. `/home/sysop/miniconda3/bin/conda` |
| `SHAKEMAP_CONDA_ENV` | default `shakemap` |
| `SHAKEMAP_GLOBAL_LOCK_FILE` | optional lock path (operations docs) |

გამოთვლა: `src/services/calc_shakemap.py` → bash + conda activate + `sm_create` + `shake`.

## Celery / Redis

| ცვლადი | default |
|--------|---------|
| `REDIS_URL` | `redis://127.0.0.1:6379/0` (fallback) |
| `CELERY_BROKER_URL` | `REDIS_URL` ან redis db0 |
| `CELERY_RESULT_BACKEND` | redis db1 (default pattern) |

კონფიგი: `src/celery_app.py`.

## Mail (password reset)

| ცვლადი | default |
|--------|---------|
| `MAIL_SERVER` | `smtp.gmail.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USERNAME` | — |
| `MAIL_PASSWORD` | — |

## WordPress publish

| ცვლადი | შენიშვნა |
|--------|----------|
| `WP_PUBLISH_CODE` | shared secret WP AJAX-ისთვის; ცარიელი = 500 on publish |

Endpoint URL კოდში: `src/services/wp_publish_client.py` (staging host hardcoded).

## Production `.env` მაგალითი (შემოკლებული)

```env
APP_ENV=production
MY_SECRET_KEY=...
JWT_SECRET_KEY=...
API_KEY=...

MYSQL_HOST=...
MYSQL_DATABASE=ies_monitoring
MYSQL_USER=...
MYSQL_PASSWORD=...

MAIL_SERVER=...
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...

SHAKEMAP_BASE_PATH=/home/sysop/shakemap_profiles/default/data
CONDA_EXE=/home/sysop/miniconda3/bin/conda
SHAKEMAP_CONDA_ENV=shakemap

REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1

WP_PUBLISH_CODE=...
GOOGLE_MAPS_API_KEY=...
```

**არასოდეს** commit-ე `.env` ან რეალური secrets.

---

**ეტაპი 1 დასრულებულია.**  
შემდეგი — [ეტაპი 2: მოდელი და ნაკადები](README.md#ეტაპების-სტატუსი) (შექმნა მოთხოვნისთანავე).
