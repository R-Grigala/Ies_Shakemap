# 4. ლოკალური დაყენება

## მოთხოვნები

- Python **3.10+**
- MySQL (dev) ან SQLite (სწრაფი ტესტი / `APP_ENV=testing`)
- Redis — **ShakeMap job-ებისთვის** (Celery)
- (ოფცია) conda + ShakeMap env — მხოლოდ თუ რეალურად უნდა `sm_create`/`shake`

მხოლოდ UI/API CRUD-ისთვის worker/ShakeMap binaries არაა აუცილებელი; job-ები `failed` გახდება თუ tools არ არის.

## 1) Clone და virtualenv

```bash
cd Ies_Shakemap
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```

## 2) `.env` ფაილი

პროექტის root-ში შექმენი `.env` (იხ. [გარემოს ცვლადები](05-environment.md)).

მინიმუმ ლოკალურად:

```env
APP_ENV=testing
MY_SECRET_KEY=dev-secret
API_KEY=dev-api-key
JWT_SECRET_KEY=dev-jwt-secret-at-least-32-bytes!!
```

`APP_ENV=testing` → default SQLite `db.sqlite` პროექტის root-ში.

Development MySQL-ისთვის:

```env
APP_ENV=development
MYSQL_HOST=localhost
MYSQL_USER=...
MYSQL_PASSWORD=...
DEV_MYSQL_DATABASE=ies_monitoring_dev
```

## 3) ბაზა

```bash
# Flask CLI იპოვის app.py-ს root-იდან; საჭიროების შემთხვევაში:
export FLASK_APP=app.py        # Windows: set FLASK_APP=app.py

# სქემა SQLAlchemy-დან (destructive; დაგისვამს y/N კითხვას)
flask init_db --confirm-text RESET_DB

# საწყისი roles/users + sample event
flask populate_db
```

`APP_ENV=production`-ში ორივე ბრძანება დაბლოკილია, თუ არ გადასცემ `--force`-ს (`init_db`-ს `--force` y/N კითხვასაც გამოტოვებს).

`reset_db.sh` ამჟამად `flask init_db`-ს `--confirm-text RESET_DB`-ის გარეშე იძახებს და ამიტომ შეცდომით ჩერდება — გამოიყენე ზემოთ მოცემული ბრძანებები.

ან migrations:

```bash
flask db upgrade
```

`populate_db` ქმნის (default seed):

| როლი | უფლებები |
|------|----------|
| Admin | ყველა flag |
| API_USER | can_shakemap, can_events |
| User | მინიმალური |

| User | email (seed) |
|------|----------------|
| Admin | `roma.grigalashvili@iliauni.edu.ge` |
| API user | `api_user@iliauni.edu.ge` |

პაროლი seed-ში: `PASSWORD` (შეცვალე production-მდე).

Sample event: `seiscomp_oid=ies2024oeem` (ონი, ML 5.33) → `http://localhost:5000/events/ies2024oeem`.

`api_user@iliauni.edu.ge` აუცილებელია, თუ ShakeMap-ს `X-API-Key`-ით უშვებ (job-ზე ამ user-ის uuid იწერება).

## 4) Flask app

```bash
python app.py
```

→ `http://0.0.0.0:5000` (debug)

Swagger: `http://localhost:5000/api`

## 5) Celery (ShakeMap რიგი)

ცალკე ტერმინალი, Redis გაშვებული:

```bash
# Redis მაგ.: redis-server  (ან Windows-ზე Docker Redis)

celery -A src.celery_app.celery_app worker --loglevel=info
```

Windows-ზე Celery-ს შეიძლება დამატებითი pool/setting სჭირდებოდეს; production target არის Linux.

## 6) ტესტები

```bash
python -m unittest discover tests
```

`TestConfig` იყენებს in-memory SQLite-ს. ტესტები მცირეა (3 ცალი: config, `/`, ცარიელი `/api/events` → 404).

## ხშირი პრობლემები

| სიმპტომი | მიზეზი / გამოსწორება |
|----------|----------------------|
| 401 API-ზე | არასწორი `X-API-Key` ან ვადაგასული JWT |
| 403 ShakeMap/events | role-ს არ აქვს `can_shakemap` / `can_events` |
| Job `failed` | conda/sm_create/shake PATH; შეამოწმე `logs/` |
| Celery არ იღებს task-ს | Redis URL არ ემთხვევა app/worker env-ს |
| `Invalid database configuration for environment` | `APP_ENV` მხოლოდ `production` \| `development` \| `testing` |
| `GET /api/events` → 404 | ბაზა ცარიელია (ასე მუშაობს კოდი); გაუშვი `flask populate_db` |
| `POST /api/shakemap` API key-ით → 500 | DB-ში არ არის `api_user@iliauni.edu.ge` |
| refresh არ მუშაობს | `JWT_COOKIE_SECURE=True` — cookie მხოლოდ HTTPS-ზე (ან `localhost`-ზე, ბრაუზერის მიხედვით) |
| `.env` არ იკითხება | `load_dotenv('.env')` ეძებს მიმდინარე სამუშაო საქაღალდეში — გაუშვი პროექტის root-იდან |
| ShakeMap რუკა ცარიელია | `GOOGLE_MAPS_API_KEY` არ არის, ან `products/`-ში JSON ფაილები არ არის |

## შემდეგი

→ [გარემოს ცვლადები](05-environment.md)  
→ **ეტაპი 2** — მოდელი და workflows (იხ. [docs/README.md](README.md))
