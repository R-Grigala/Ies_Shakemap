# Ies_Monitoring — დოკუმენტაცია

ეს საქაღალდე შეიცავს პროექტის ეტაპობრივ ტექნიკურ დოკუმენტაციას.

კოდის სწრაფი მიმოხილვისთვის იხილე root [`README.md`](../README.md).  
Production/systemd ნოტებისთვის — [`instruction.txt`](../instruction.txt) და `conf_*.txt`.

---

## ეტაპების სტატუსი

| ეტაპი | თემა | სტატუსი |
|------:|------|---------|
| **1** | მიმოხილვა, არქიტექტურა, ლოკალური დაყენება | ✅ მზადაა |
| **2** | მონაცემთა მოდელი და ძირითადი ნაკადები | ⏳ შემდეგი |
| **3** | API ცნობარი (auth, events, shakemap, accounts, …) | ⏳ |
| **4** | Frontend / UI გვერდები და JS | ⏳ |
| **5** | Celery, ShakeMap worker, ინტეგრაციები | ⏳ |
| **6** | Production deployment და ოპერაცია | ⏳ |

---

## ნავიგაცია (ეტაპი 1)

1. [მიმოხილვა](01-overview.md) — რას აკეთებს სისტემა, ვისთვისაა
2. [არქიტექტურა](02-architecture.md) — კომპონენტები, ფენები, ნაკადი
3. [პროექტის სტრუქტურა](03-project-structure.md) — საქაღალდეები და როლი
4. [ლოკალური დაყენება](04-local-setup.md) — env, DB, გაშვება
5. [გარემოს ცვლადები](05-environment.md) — `.env` სრული ჩამონათვალი

---

## კონვენციები

- endpoint-ები და path-ები: `` `/api/events` ``
- კოდის ფაილები: `` `src/api/seismic_event.py` ``
- env ცვლადები: `` `SHAKEMAP_BASE_PATH` ``
- სტატუსები/სახელები ინგლისურად, როგორც კოდშია (`waiting`, `can_shakemap`)
- დოკუმენტაცია ქართულად; ტექნიკური ტერმინები — ინგლისურად

---

## შემდეგი ნაბიჯი

**ეტაპი 2:** მონაცემთა მოდელი (`SeismicEvent`, `ShakemapJob`, `User`/`Role`, publish/recipients) და end-to-end ნაკადები (ივენთის შექმნა → ShakeMap → gallery → WP publish).
