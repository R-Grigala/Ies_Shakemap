from flask import render_template, Blueprint, abort
from os import path

from src.config import Config
from src.models import SeismicEvent

TEMPLATES_FOLDER = path.join(Config.BASE_DIR, "src", "templates", "events")
events_blueprint = Blueprint("events", __name__, template_folder=TEMPLATES_FOLDER)


@events_blueprint.route("/events")
def events():
    return render_template("events.html")


@events_blueprint.route("/events/<string:seiscomp_oid>")
def event_detail(seiscomp_oid):
    """მიწისძვრის დეტალური გვერდი SeisComP OID-ით (მაგ. ies2026pjwh)."""
    oid = (seiscomp_oid or "").strip()
    if not oid:
        abort(404)

    event = SeismicEvent.query.filter_by(seiscomp_oid=oid).first()
    if not event:
        abort(404)
    return render_template("eventDetail.html", event=event)
