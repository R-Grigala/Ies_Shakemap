from flask import render_template, Blueprint, abort
from os import path

from src.config import Config
from src.models import SeismicEvent

TEMPLATES_FOLDER = path.join(Config.BASE_DIR, "src", "templates", "events")
events_blueprint = Blueprint("events", __name__, template_folder=TEMPLATES_FOLDER)


@events_blueprint.route("/events")
def events():
    return render_template("events.html")


@events_blueprint.route("/events/<int:event_id>")
def event_detail(event_id):
    """მიწისძვრის დეტალური გვერდი primary key id-ით."""
    event = SeismicEvent.query.filter_by(id=event_id).first()
    if not event:
        abort(404)
    return render_template("eventDetail.html", event=event)
