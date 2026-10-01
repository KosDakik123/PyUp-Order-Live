import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

STORE_CATEGORIES = [
    "food",
    "fashion",
    "services",
    "beauty",
    "electronics",
    "home",
    "health",
    "groceries",
    "entertainment",
    "pets",
]

MENU_STYLES = ["grid", "list", "minimal", "magazine", "masonry"]


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True)
    email = Column(String, unique=True)
    hashed_password = Column(String)
    role = Column(String, default="user")

    # ── Email verification ──────────────────────────────────────────────────
    is_verified        = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    # ────────────────────────────────────────────────────────────────────────

    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    stores = relationship("Store", back_populates="owner")


class Store(Base):
    __tablename__ = "stores"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    description = Column(Text)
    owner_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Category
    category = Column(String, default="services")   # one of STORE_CATEGORIES

    # Menu layout style
    menu_style = Column(String, default="grid")      # one of MENU_STYLES

    # Appearance
    primary_color   = Column(String, default="#667eea")
    secondary_color = Column(String, default="#764ba2")
    accent_color    = Column(String, default="#28a745")
    theme           = Column(String, default="modern")
    banner_image_url = Column(String, nullable=True)
    logo_url         = Column(String, nullable=True)
    tagline          = Column(String, nullable=True)
    welcome_message  = Column(Text,   nullable=True)
    footer_text      = Column(String, nullable=True)

    owner    = relationship("User", back_populates="stores")
    services = relationship("Service", back_populates="store")


class Service(Base):
    __tablename__ = "services"
    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name        = Column(String)
    description = Column(String)
    price       = Column(Integer)
    store_id    = Column(String, ForeignKey("stores.id"))
    image_url   = Column(String, nullable=True)
    store   = relationship("Store", back_populates="services")
    orders  = relationship("Order", back_populates="service")


class Order(Base):
    __tablename__ = "orders"
    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id          = Column(String, ForeignKey("users.id"))
    service_id       = Column(String, ForeignKey("services.id"))
    store_id         = Column(String, ForeignKey("stores.id"))
    status           = Column(String, default="Pending")
    order_type       = Column(String, default="dine-in")
    table_number     = Column(String, nullable=True)
    delivery_address = Column(Text, nullable=True)
    customer_name    = Column(String, nullable=True)
    customer_phone   = Column(String, nullable=True)
    notes            = Column(Text, nullable=True)
    quantity         = Column(Integer, default=1)
    created_at       = Column(DateTime, default=datetime.utcnow)
    user    = relationship("User", back_populates="orders", foreign_keys=[user_id])
    service = relationship("Service", back_populates="orders")
    store   = relationship("Store")