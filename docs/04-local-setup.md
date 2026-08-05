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
# სქემა SQLAlchemy-დან (destructive)
set FLASK_APP=app.py
flask init_db --confirm-text RESET_DB

# საწყისი roles/users + sample event
flask populate_db
```

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

`TestConfig` იყენებს in-memory SQLite-ს.

## ხშირი პრობლემები

| სიმპტომი | მიზეზი / გამოსწორება |
|----------|----------------------|
| 401 API-ზე | არასწორი `X-API-Key` ან ვადაგასული JWT |
| 403 ShakeMap/events | role-ს არ აქვს `can_shakemap` / `can_events` |
| Job `failed` | conda/sm_create/shake PATH; შეამოწმე `logs/` |
| Celery არ იღებს task-ს | Redis URL არ ემთხვევა app/worker env-ს |
| `Invalid APP_ENV` | მხოლოდ `production` \| `development` \| `testing` |

## შემდეგი

→ [გარემოს ცვლადები](05-environment.md)  
→ **ეტაპი 2** — მოდელი და workflows (იხ. [docs/README.md](README.md))
