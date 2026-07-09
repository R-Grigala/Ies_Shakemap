from src.extensions import db
from src.models.base import BaseModel
from sqlalchemy.orm import validates
from src.utils import normalize_ge_phone, normalize_email
from datetime import datetime, timezone


class PhoneRecipient(db.Model, BaseModel):
    __tablename__ = "phone_recipients"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(32), nullable=False, unique=True, index=True)
    staff_member = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    def __repr__(self):
        return f"<PhoneRecipient id={self.id} username={self.username} phone={self.phone}>"

    @validates("phone")
    def validate_and_normalize_phone(self, key, phone):
        return normalize_ge_phone(phone)


class EmailRecipient(db.Model, BaseModel):
    __tablename__ = "email_recipients"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    staff_member = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    def __repr__(self):
        return f"<EmailRecipient id={self.id} username={self.username} email={self.email}>"

    @validates("email")
    def validate_and_normalize_email(self, key, email):
        return normalize_email(email)


class PublishedEarthquake(db.Model, BaseModel):
    __tablename__ = "published_earthquakes"

    id = db.Column(db.Integer, primary_key=True)
    seiscomp_oid = db.Column(
        db.String(20),
        db.ForeignKey("seismic_events.seiscomp_oid"),
        nullable=False,
        unique=True,
        index=True,
    )
    wp_response = db.Column(db.Text, nullable=True)
    published_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    seismic_event = db.relationship(
        "SeismicEvent",
        back_populates="published_event",
        foreign_keys=[seiscomp_oid],
    )


class SendNotification(db.Model, BaseModel):
    __tablename__ = "send_notifications"

    id = db.Column(db.Integer, primary_key=True)
    seiscomp_oid = db.Column(
        db.String(20),
        db.ForeignKey("seismic_events.seiscomp_oid"),
        nullable=False,
        index=True,
    )
    channel = db.Column(db.String(20), nullable=False, default="email")
    target = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="queued")
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    seismic_event = db.relationship(
        "SeismicEvent",
        back_populates="send_notifications",
        foreign_keys=[seiscomp_oid],
    )
