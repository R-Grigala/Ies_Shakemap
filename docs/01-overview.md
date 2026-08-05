# 1. მიმოხილვა

## რა არის Ies_Monitoring

Flask-ზე აგებული სეისმური მონიტორინგის პლატფორმა, რომელიც:

- იღებს და ინახავს მიწისძვრის ივენთებს (SeisComP OID-ით)
- უშვებს **ShakeMap** გენერაციას ფონურ რიგში (Celery + Redis)
- აჩვენებს პროდუქტებს (PGA, PGV, intensity) ვებ UI-დან
- მართავს მომხმარებლებსა და როლებს (JWT + უფლებები)
- აქვეყნებს ივენთებს WordPress საიტზე (ies.iliauni.edu.ge / staging)
- ამზადებს notification recipients API-ს (ელფოსტა/ტელეფონი)

პროექტის კოდსახელები: repository — `Ies_Shakemap`, app — **Ies_Monitoring** / EarthQuakeWatch API.

## ვინ იყენებს

| მომხმარებელი | ტიპიური გამოყენება |
|--------------|-------------------|
| ოპერატორი / სეისმოლოგი | ივენთების ნახვა, ShakeMap regenerate, gallery |
| ადმინისტრატორი | მომხმარებლები, როლები, უფლებები |
| SeisComP / შიდა ინტეგრაცია | `X-API-Key`-ით ივენთების upsert და job-ების გაშვება |
| ვებ UI | JWT login, permission-based UI |

## ძირითადი შესაძლებლობები

| მოდული | UI | API |
|--------|----|-----|
| ივენთები | `/events` | `/api/events`, `/api/filter_event` |
| ShakeMap | `/shakemap` | `/api/shakemap`, image endpoints |
| Auth | `/login`, password flows | `/api/login`, `/api/refresh`, … |
| ანგარიშები | `/accounts` | `/api/accounts`, `/api/roles`, … |
| Publish | (events UI-დან) | `/api/publish_event`, `/api/unpublish_event` |
| Recipients | — | phone/email recipient CRUDs |
| Swagger | — | `/api` |

## ავტორიზაციის ორი რეჟიმი

1. **`X-API-Key`** — შიდა/სისტემური ინტეგრაციები; API key წარმატებისას უფლებები „გახსნილია“
2. **`Authorization: Bearer <JWT>`** — მომხმარებლის სესია; უფლებები როლიდან (`can_events`, `can_shakemap`, `can_users`, `is_admin`)

დეტალები: ეტაპი 3 (API).

## ტექნოლოგიური სტეკი (მოკლედ)

- **Backend:** Python 3.10+, Flask, Flask-RESTX, Flask-JWT-Extended, SQLAlchemy, Alembic
- **DB:** MySQL (production/development), SQLite (testing default)
- **Queue:** Celery + Redis (`worker_concurrency=1`)
- **ShakeMap:** conda env + `sm_create` / `shake` (სერვერზე)
- **Frontend:** Jinja templates + vanilla JS
- **Deploy:** Gunicorn + systemd (+ Nginx, production)

## რას *არ* აკეთებს (ამჟამინდელი კოდი)

- ShakeMap-ის შემდეგ email გაგზავნა worker-ში **დროებით გამორთულია**
- Docker production-ში ნაგულისხმევი გზა არ არის (იხ. operations ეტაპი)
- ShakeMap გამოთვლა UI-ში სინქრონულად არ მუშაობს — ყოველთვის Celery რიგი

## შემდეგი

→ [არქიტექტურა](02-architecture.md)
