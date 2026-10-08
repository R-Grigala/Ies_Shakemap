# 1. მიმოხილვა

## რა არის Ies_Monitoring

Flask-ზე აგებული სეისმური მონიტორინგის პლატფორმა, რომელიც:

- იღებს და ინახავს მიწისძვრის ივენთებს (SeisComP OID-ით)
- უშვებს **ShakeMap** გენერაციას ფონურ რიგში (Celery + Redis)
- აჩვენებს პროდუქტებს ივენთის დეტალურ გვერდზე: სურათები (intensity, PGA, PGV, PSA 0.3/1.0/3.0s) და ინტერაქტიული რუკა
- მართავს მომხმარებლებსა და როლებს (JWT + უფლებები)
- აქვეყნებს ივენთებს WordPress საიტზე (კოდში ამჟამად staging host: `ies-staging.iliauni.edu.ge`)
- ინახავს notification recipients-ს (ელფოსტა/ტელეფონი) API-ით; გაგზავნა ჯერ არ ხდება

პროექტის კოდსახელები: repository — `Ies_Shakemap`, app — **Ies_Monitoring** / EarthQuakeWatch API.

## ვინ იყენებს

| მომხმარებელი | ტიპიური გამოყენება |
|--------------|-------------------|
| ოპერატორი / სეისმოლოგი | ივენთების ნახვა, ShakeMap გენერაცია/regenerate, სურათები და რუკა, publish |
| ადმინისტრატორი | მომხმარებლები, როლები, უფლებები |
| SeisComP / შიდა ინტეგრაცია | `X-API-Key`-ით ივენთების upsert და job-ების გაშვება |
| ვებ UI | JWT login, permission-based UI |

## ძირითადი შესაძლებლობები

| მოდული | UI | API |
|--------|----|-----|
| ივენთები | `/events` (სია, CRUD, ფილტრი) | `/api/events`, `/api/events/<id>`, `/api/filter_event` |
| ივენთის დეტალი + ShakeMap | `/events/<seiscomp_oid>` | `/api/shakemap`, `/api/shakemap/<oid>`, `.../image/<type>`, `.../product/<file>` |
| Publish | `/events/<seiscomp_oid>` (toggle) | `/api/publish_event`, `/api/unpublish_event` |
| Auth | `/login`, `/registration`, `/reset_password/<token>`, `/change_password` | `/api/login`, `/api/refresh`, `/api/logout`, `/api/registration` |
| ანგარიშები | `/accounts` | `/api/user`, `/api/accounts`, `/api/roles`, password endpoints |
| Recipients | — | `/api/phone_recipients`, `/api/email_recipients` |
| Swagger | — | `/api` |

ცალკე `/shakemap` გვერდი **არ არსებობს** — ShakeMap UI ივენთის დეტალურ გვერდზეა.

## ავტორიზაციის ორი რეჟიმი

1. **`X-API-Key`** — შიდა/სისტემური ინტეგრაციები; ვალიდური key-ით ყველა `have_permission(...)` შემოწმება გადის
2. **`Authorization: Bearer <JWT>`** — მომხმარებლის სესია; უფლებები როლიდან (`can_events`, `can_shakemap`, `can_users`, `is_admin`)

ზოგი endpoint საჯაროა (ივენთების სია, ფილტრი, ShakeMap შედეგები/ფაილები). სრული ცხრილი: root [`README.md`](../README.md#api-overview).

## ტექნოლოგიური სტეკი (მოკლედ)

- **Backend:** Python 3.10+, Flask, Flask-RESTX, Flask-JWT-Extended, Flask-CORS, SQLAlchemy, Alembic
- **DB:** MySQL (production/development), SQLite (testing default)
- **Queue:** Celery + Redis (`worker_concurrency=1`)
- **ShakeMap:** conda env + `sm_create` / `shake` (სერვერზე)
- **Frontend:** Jinja templates + vanilla JS + Bootstrap + Google Maps JS API
- **Deploy:** Gunicorn + systemd (+ Nginx, production)

## რას *არ* აკეთებს (ამჟამინდელი კოდი)

- ShakeMap-ის შემდეგ email გაგზავნა worker-ში **დროებით გამორთულია**
- recipients-ზე შეტყობინებები არ იგზავნება (`SendNotification` მოდელი არსებობს, მაგრამ არავინ წერს)
- Docker ფაილები repository-ში არ არის
- ShakeMap გამოთვლა სინქრონულად არ მუშაობს — ყოველთვის Celery რიგი

## შემდეგი

→ [არქიტექტურა](02-architecture.md)
