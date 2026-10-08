# 5. გარემოს ცვლადები

იტვირთება `src/config.py`-დან: `load_dotenv(dotenv_path='.env')` — ფაილი იძებნება **მიმდინარე სამუშაო საქაღალდეში**, ამიტომ app/worker გაუშვი პროექტის root-იდან (systemd-ში `WorkingDirectory` + `EnvironmentFile`).

## აპლიკაცია

| ცვლადი | default კოდში | სავალდებულო |
|--------|---------------|-------------|
| `APP_ENV` | `testing` — `production` \| `development` \| `testing` | დიახ (valid value) |
| `MY_SECRET_KEY` | `default_secret_key` | production: დიახ |
| `API_KEY` | `default_api_key` | production: დიახ |
| `JWT_SECRET_KEY` | `default_jwt_secret_key` | production: დიახ (32+ bytes) |
| `GOOGLE_MAPS_API_KEY` | `google_maps_api_key` (placeholder) | ივენთების და ShakeMap რუკისთვის |

`MY_SECRET_KEY` ხელს აწერს password reset token-ებს (`src/services/url_serializer.py`). Flask-ის `SECRET_KEY`-ში არ გადადის.

JWT ქცევა კოდში (env-ით არ იცვლება):

- access = 1 საათი
- refresh = 15 დღე
- `JWT_TOKEN_LOCATION = ["headers", "cookies"]`
- refresh cookie path: `/api/refresh`
- `JWT_COOKIE_SECURE = True` **ყოველთვის** (ყველა `APP_ENV`-ში)
- `JWT_COOKIE_CSRF_PROTECT = False`

## ბაზა

| ცვლადი | default კოდში |
|--------|---------------|
| `MYSQL_HOST` | `localhost` |
| `MYSQL_DATABASE` | `ies_monitoring` (prod) |
| `DEV_MYSQL_DATABASE` | `ies_monitoring_dev` |
| `MYSQL_USER` | `ies_monitoring` |
| `MYSQL_PASSWORD` | hardcoded არაცარიელი მნიშვნელობა — **ყოველთვის** დააყენე `.env`-ში |
| `SQLALCHEMY_DATABASE_URI` | სრული override (ნებისმიერ env-ში) |
| `PROD_SQLALCHEMY_DATABASE_URI` | `mysql+pymysql://USER:PASS@HOST/MYSQL_DATABASE` |
| `DEV_SQLALCHEMY_DATABASE_URI` | `mysql+pymysql://USER:PASS@HOST/DEV_MYSQL_DATABASE` |
| `TEST_SQLALCHEMY_DATABASE_URI` | `sqlite:///<project root>/db.sqlite` |

`APP_ENV`-ის მიხედვით ირჩევა URI. უცნობი `APP_ENV` → `ValueError("Invalid database configuration for environment: ...")`.  
`TestConfig` (unit ტესტები) ყოველთვის `sqlite:///:memory:`.

## ShakeMap

| ცვლადი | default | სად იკითხება |
|--------|---------|--------------|
| `SHAKEMAP_BASE_PATH` | `$HOME/shakemap_profiles/default/data` | `src/config.py` → products-ის წაკითხვა API-ში |
| `CONDA_EXE` | `conda` (PATH-იდან) | `src/services/calc_shakemap.py` |
| `SHAKEMAP_CONDA_ENV` | `shakemap` | `src/services/calc_shakemap.py` |

გამოთვლა: `calc_shakemap.py` → `/bin/bash -lc` + `conda activate` + `sm_create -f <oid> -e ies ...` + `shake <oid> select assemble model contour mapping`.

`SHAKEMAP_BASE_PATH` უნდა ემთხვეოდეს ShakeMap profile-ის data საქაღალდეს, სადაც `shake` წერს `<oid>/current/products/`-ს.

`SHAKEMAP_GLOBAL_LOCK_FILE` ძველ ინსტრუქციებში გვხვდება, მაგრამ კოდი მას **არ კითხულობს**; ერთდროულობას Celery-ს `worker_concurrency=1` ზღუდავს.

## Celery / Redis

| ცვლადი | default |
|--------|---------|
| `REDIS_URL` | broker-ის fallback, თუ `CELERY_BROKER_URL` არ არის |
| `CELERY_BROKER_URL` | `REDIS_URL` → `redis://127.0.0.1:6379/0` |
| `CELERY_RESULT_BACKEND` | `redis://127.0.0.1:6379/1` (`REDIS_URL`-ს არ იყენებს) |

კონფიგი: `src/celery_app.py`. Celery ამ ცვლადებს `os.getenv`-ით კითხულობს მოდულის import-ისას, ამიტომ worker-ის გარემოშიც უნდა იყოს (`EnvironmentFile`).

## Mail (password reset)

| ცვლადი | default |
|--------|---------|
| `MAIL_SERVER` | `smtp.gmail.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USERNAME` | `your_email@gmail.com` (placeholder) |
| `MAIL_PASSWORD` | `your_password` (placeholder) |

## WordPress publish

| ცვლადი | შენიშვნა |
|--------|----------|
| `WP_PUBLISH_CODE` | shared secret WP AJAX-ისთვის; ცარიელი → publish/unpublish აბრუნებს 500 |

Endpoint URL env-ით არ იცვლება: `WP_AJAX_URL` hardcoded-ია `src/services/wp_publish_client.py`-ში (`https://ies-staging.iliauni.edu.ge/wp-admin/admin-ajax.php`).

## systemd-ის მიერ დაყენებული ცვლადები

`ies_monitoring_main.service` დამატებით აყენებს `PATH`, `CONDA_EXE`, `SHAKEMAP_CONDA_ENV`, `APP_ENV=production`. `ies_monitoring_celery.service` მხოლოდ `.env`-ს ტვირთავს — ამიტომ `CONDA_EXE` და `SHAKEMAP_CONDA_ENV` `.env`-შიც უნდა იყოს, რადგან ShakeMap worker-ში ეშვება.

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

**არასოდეს** commit-ე `.env` ან რეალური secrets (`.env` უკვე `.gitignore`-შია).

---

**ეტაპი 1 დასრულებულია.**  
შემდეგი — [ეტაპი 2: მოდელი და ნაკადები](README.md#ეტაპების-სტატუსი) (შექმნა მოთხოვნისთანავე).
