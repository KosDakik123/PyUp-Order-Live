from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload
from jose import jwt
import os, uuid

import models
from database import engine, SessionLocal
from auth import (
    hash_password, verify_password, create_access_token,
    generate_verification_token, send_verification_email,
    SECRET_KEY, ALGORITHM,
)

models.Base.metadata.create_all(bind=engine)

# ── Auto-migrate new columns onto existing databases ─────────────────────────
from sqlalchemy import text, inspect as sa_inspect
def _migrate(db):
    insp = sa_inspect(engine)
    def has(table, col):
        return col in [c["name"] for c in insp.get_columns(table)]
    pairs = [
        ("stores",   "category",          "VARCHAR DEFAULT 'services'"),
        ("stores",   "menu_style",         "VARCHAR DEFAULT 'grid'"),
        ("stores",   "primary_color",      "VARCHAR DEFAULT '#667eea'"),
        ("stores",   "secondary_color",    "VARCHAR DEFAULT '#764ba2'"),
        ("stores",   "accent_color",       "VARCHAR DEFAULT '#28a745'"),
        ("stores",   "theme",              "VARCHAR DEFAULT 'modern'"),
        ("stores",   "banner_image_url",   "VARCHAR"),
        ("stores",   "logo_url",           "VARCHAR"),
        ("stores",   "tagline",            "VARCHAR"),
        ("stores",   "welcome_message",    "TEXT"),
        ("stores",   "footer_text",        "VARCHAR"),
        ("services", "image_url",          "VARCHAR"),
        ("users",    "is_verified",        "BOOLEAN DEFAULT 1"),
        ("users",    "verification_token", "VARCHAR"),
    ]
    for table, col, typedef in pairs:
        if not has(table, col):
            db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}"))
    db.commit()

_db = SessionLocal()
try:   _migrate(_db)
finally: _db.close()
# ─────────────────────────────────────────────────────────────────────────────

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

PRODUCT_SIZES = {(400, 400), (800, 600)}
BANNER_SIZES  = {(1200, 400), (1920, 480)}
LOGO_SIZES    = {(200, 200), (400, 400)}
ALL_SIZES     = PRODUCT_SIZES | BANNER_SIZES | LOGO_SIZES

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_db():
    db = SessionLocal()
    try:     yield db
    finally: db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_admin(user=Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ============= AUTH =============

@app.post("/register")
def register(data: dict, request: Request, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(
        (models.User.username == data["username"]) | (models.User.email == data["email"])
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    token = generate_verification_token()
    user = models.User(
        username=data["username"],
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        is_verified=False,
        verification_token=token,
    )
    db.add(user)
    db.commit()

    base_url = str(request.base_url).rstrip("/")
    email_sent = send_verification_email(data["email"], token, base_url)

    return {
        "message": "Registration successful. Please check your email to verify your account.",
        "email_sent": email_sent,
        **({"dev_verify_token": token} if os.getenv("APP_ENV", "development") == "development" else {}),
    }


@app.post("/login")
def login(data: dict, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data["username"]).first()
    if not user or not verify_password(data["password"], user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email address before logging in. Check your inbox for the verification link."
        )
    token = create_access_token(user.id)
    return {"access_token": token, "role": user.role, "user_id": user.id}


@app.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.verification_token == token).first()

    if not user:
        return HTMLResponse(content=_verification_page(
            success=False,
            message="This verification link is invalid or has already been used."
        ), status_code=400)

    if user.is_verified:
        return HTMLResponse(content=_verification_page(
            success=True,
            message="Your email is already verified. You can log in."
        ))

    user.is_verified = True
    user.verification_token = None
    db.commit()

    return HTMLResponse(content=_verification_page(
        success=True,
        message="Your email has been verified! You can now log in."
    ))


@app.post("/resend-verification")
def resend_verification(data: dict, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.get("email", "")).first()
    if not user:
        return {"message": "If that email is registered and unverified, a new link has been sent."}
    if user.is_verified:
        return {"message": "This account is already verified."}
    new_token = generate_verification_token()
    user.verification_token = new_token
    db.commit()
    base_url = str(request.base_url).rstrip("/")
    send_verification_email(user.email, new_token, base_url)
    return {"message": "Verification email resent. Please check your inbox."}


def _verification_page(success: bool, message: str) -> str:
    icon  = "✅" if success else "❌"
    color = "#28a745" if success else "#dc3545"
    return f"""<!DOCTYPE html>
<html>
<head>
  <title>Email Verification</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light d-flex justify-content-center align-items-center vh-100">
  <div class="card p-5 text-center shadow" style="max-width:460px;width:100%">
    <div style="font-size:3rem">{icon}</div>
    <h3 class="mt-3" style="color:{color}">
      {"Email Verified!" if success else "Verification Failed"}
    </h3>
    <p class="text-muted mt-2">{message}</p>
    <a href="/static/login.html" class="btn btn-primary mt-3">Go to Login</a>
  </div>
</body>
</html>"""


# ============= IMAGE UPLOAD =============

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    try:
        from PIL import Image
        import io
        contents = await file.read()
        img = Image.open(io.BytesIO(contents))
        w, h = img.size
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image")

    if (w, h) not in ALL_SIZES:
        allowed = ", ".join(f"{a}×{b}" for a, b in sorted(ALL_SIZES))
        raise HTTPException(status_code=400,
            detail=f"Image size {w}×{h} not allowed. Accepted: {allowed}")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    filename = f"{uuid.uuid4()}.{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)
    return {"url": f"/static/uploads/{filename}", "width": w, "height": h}


# ============= STORES =============

def _store_dict(s):
    return {
        "id": s.id, "name": s.name, "description": s.description,
        "owner_id": s.owner_id, "owner_name": s.owner.username,
        "category":        s.category        or "services",
        "menu_style":      s.menu_style       or "grid",
        "primary_color":   s.primary_color    or "#667eea",
        "secondary_color": s.secondary_color  or "#764ba2",
        "accent_color":    s.accent_color     or "#28a745",
        "theme":           s.theme            or "modern",
        "banner_image_url": s.banner_image_url,
        "logo_url":         s.logo_url,
        "tagline":          s.tagline,
        "welcome_message":  s.welcome_message,
        "footer_text":      s.footer_text,
    }


@app.post("/stores")
def create_store(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    category = data.get("category", "services")
    if category not in models.STORE_CATEGORIES:
        category = "services"
    store = models.Store(
        name=data["name"], description=data["description"],
        owner_id=user.id, category=category
    )
    db.add(store); db.commit(); db.refresh(store)
    return {"message": "Store created", "store_id": store.id}


@app.get("/stores")
def get_all_stores(category: str = None, q: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Store)
    if category and category != "all":
        query = query.filter(models.Store.category == category)
    if q:
        query = query.filter(
            models.Store.name.ilike(f"%{q}%") |
            models.Store.description.ilike(f"%{q}%")
        )
    return [_store_dict(s) for s in query.all()]


@app.get("/stores/{store_id}")
def get_store(store_id: str, db: Session = Depends(get_db)):
    s = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Store not found")
    return _store_dict(s)


@app.get("/my-stores")
def get_my_stores(db: Session = Depends(get_db), user=Depends(get_current_user)):
    stores = db.query(models.Store).filter(models.Store.owner_id == user.id).all()
    return [{**_store_dict(s), "services_count": len(s.services)} for s in stores]


@app.put("/stores/{store_id}/theme")
def update_store_theme(store_id: str, data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    for f in ["name","description","tagline","welcome_message","footer_text",
              "primary_color","secondary_color","accent_color","theme",
              "banner_image_url","logo_url","category","menu_style"]:
        if f in data:
            setattr(store, f, data[f])
    db.commit()
    return {"message": "Store updated"}


@app.delete("/stores/{store_id}")
def delete_store(store_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    db.query(models.Order).filter(models.Order.store_id == store_id).delete()
    db.query(models.Service).filter(models.Service.store_id == store_id).delete()
    db.delete(store)
    db.commit()
    return {"message": "Store deleted"}


# ============= SERVICES =============

def _svc(s):
    return {"id": s.id, "name": s.name, "description": s.description,
            "price": s.price, "store_id": s.store_id, "image_url": s.image_url}


@app.post("/stores/{store_id}/services")
def create_service(store_id: str, data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    service = models.Service(
        name=data["name"], description=data["description"],
        price=data["price"], store_id=store_id, image_url=data.get("image_url")
    )
    db.add(service); db.commit()
    return {"message": "Service created"}


@app.delete("/stores/{store_id}/services/{service_id}")
def delete_service(store_id: str, service_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    svc = db.query(models.Service).filter(models.Service.id == service_id).first()
    if svc:
        db.delete(svc); db.commit()
    return {"message": "Deleted"}


@app.get("/stores/{store_id}/services")
def get_store_services(store_id: str, db: Session = Depends(get_db)):
    services = db.query(models.Service).filter(models.Service.store_id == store_id).all()
    return [_svc(s) for s in services]


@app.get("/services")
def get_all_services(db: Session = Depends(get_db)):
    return [{**_svc(s), "store_name": s.store.name} for s in db.query(models.Service).all()]


# ============= ORDERS =============

@app.post("/orders")
def create_order(data: dict, db: Session = Depends(get_db)):
    service = db.query(models.Service).filter(models.Service.id == data["service_id"]).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    order = models.Order(
        user_id=data.get("user_id"), service_id=service.id, store_id=service.store_id,
        order_type=data.get("order_type", "dine-in"),
        table_number=data.get("table_number"), delivery_address=data.get("delivery_address"),
        customer_name=data.get("customer_name"), customer_phone=data.get("customer_phone"),
        notes=data.get("notes"), quantity=data.get("quantity", 1)
    )
    db.add(order); db.commit()
    return {"message": "Order created", "order_id": order.id}


@app.get("/orders")
def get_my_orders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    orders = db.query(models.Order).filter(models.Order.user_id == user.id).all()
    return [{"id": o.id, "status": o.status, "service_name": o.service.name,
             "store_name": o.store.name, "price": o.service.price, "created_at": o.created_at}
            for o in orders]


@app.get("/store-orders/{store_id}")
def get_store_orders(store_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return [{"id": o.id, "status": o.status,
             "customer_name": o.customer_name or (o.user.username if o.user else "Guest"),
             "customer_phone": o.customer_phone, "service_name": o.service.name,
             "price": o.service.price, "quantity": o.quantity, "order_type": o.order_type,
             "table_number": o.table_number, "delivery_address": o.delivery_address,
             "notes": o.notes, "created_at": o.created_at}
            for o in db.query(models.Order).filter(models.Order.store_id == store_id).all()]


@app.put("/orders/{order_id}")
def update_order(order_id: str, data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    store = db.query(models.Store).filter(models.Store.id == order.store_id).first()
    if store.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    order.status = data["status"]; db.commit()
    return {"message": "Order updated"}


@app.get("/admin/orders")
def admin_orders(db: Session = Depends(get_db), admin=Depends(get_admin)):
    orders = db.query(models.Order).all()
    return [{"id": o.id, "status": o.status,
             "customer_name": o.customer_name or (o.user.username if o.user else "Guest"),
             "store_name": o.store.name, "service_name": o.service.name,
             "price": o.service.price, "quantity": o.quantity,
             "order_type": o.order_type, "created_at": o.created_at}
            for o in orders]


# ============= ADMIN ANALYTICS =============

from datetime import datetime, timedelta
from collections import defaultdict

@app.get("/admin/analytics")
def admin_analytics(db: Session = Depends(get_db), admin=Depends(get_admin)):
    orders = db.query(models.Order).options(
        joinedload(models.Order.service),
        joinedload(models.Order.store),
    ).all()
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if this_month_start.month == 1:
        last_month_start = this_month_start.replace(year=now.year - 1, month=12)
    else:
        last_month_start = this_month_start.replace(month=this_month_start.month - 1)

    total_revenue = 0
    revenue_this_month = 0
    revenue_last_month = 0
    orders_this_month = 0
    orders_last_month = 0
    by_month = defaultdict(lambda: {"revenue": 0, "order_count": 0})
    by_store = defaultdict(lambda: {"store_name": "", "revenue": 0, "order_count": 0})

    for o in orders:
        rev = (o.service.price or 0) * (o.quantity or 1)
        total_revenue += rev
        created = o.created_at or now
        month_key = created.strftime("%Y-%m")
        by_month[month_key]["revenue"] += rev
        by_month[month_key]["order_count"] += 1
        if created >= this_month_start:
            revenue_this_month += rev
            orders_this_month += 1
        elif last_month_start <= created < this_month_start:
            revenue_last_month += rev
            orders_last_month += 1
        by_store[o.store_id]["store_name"] = o.store.name
        by_store[o.store_id]["revenue"] += rev
        by_store[o.store_id]["order_count"] += 1

    month_list = sorted(by_month.keys(), reverse=True)[:12]
    by_month_list = [{"month": m, "revenue": round(by_month[m]["revenue"], 2), "order_count": by_month[m]["order_count"]} for m in month_list]
    by_store_list = [{"store_id": sid, "store_name": s["store_name"], "revenue": round(s["revenue"], 2), "order_count": s["order_count"]} for sid, s in by_store.items()]

    return {
        "total_revenue": round(total_revenue, 2),
        "revenue_this_month": round(revenue_this_month, 2),
        "revenue_last_month": round(revenue_last_month, 2),
        "orders_this_month": orders_this_month,
        "orders_last_month": orders_last_month,
        "total_orders": sum(by_month[m]["order_count"] for m in by_month),
        "by_month": by_month_list,
        "by_store": by_store_list,
    }


@app.get("/my-stores/analytics")
def my_stores_analytics(db: Session = Depends(get_db), user=Depends(get_current_user)):
    store_ids = [s.id for s in db.query(models.Store).filter(models.Store.owner_id == user.id).all()]
    if not store_ids:
        return {
            "total_revenue": 0, "revenue_this_month": 0, "revenue_last_month": 0,
            "orders_this_month": 0, "orders_last_month": 0, "total_orders": 0,
            "by_month": [], "by_store": [],
        }
    orders = db.query(models.Order).filter(models.Order.store_id.in_(store_ids)).options(
        joinedload(models.Order.service),
        joinedload(models.Order.store),
    ).all()
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if this_month_start.month == 1:
        last_month_start = this_month_start.replace(year=now.year - 1, month=12)
    else:
        last_month_start = this_month_start.replace(month=this_month_start.month - 1)

    total_revenue = 0
    revenue_this_month = 0
    revenue_last_month = 0
    orders_this_month = 0
    orders_last_month = 0
    by_month = defaultdict(lambda: {"revenue": 0, "order_count": 0})
    by_store = defaultdict(lambda: {"store_name": "", "revenue": 0, "order_count": 0})

    for o in orders:
        rev = (o.service.price or 0) * (o.quantity or 1)
        total_revenue += rev
        created = o.created_at or now
        month_key = created.strftime("%Y-%m")
        by_month[month_key]["revenue"] += rev
        by_month[month_key]["order_count"] += 1
        if created >= this_month_start:
            revenue_this_month += rev
            orders_this_month += 1
        elif last_month_start <= created < this_month_start:
            revenue_last_month += rev
            orders_last_month += 1
        by_store[o.store_id]["store_name"] = o.store.name
        by_store[o.store_id]["revenue"] += rev
        by_store[o.store_id]["order_count"] += 1

    month_list = sorted(by_month.keys(), reverse=True)[:12]
    by_month_list = [{"month": m, "revenue": round(by_month[m]["revenue"], 2), "order_count": by_month[m]["order_count"]} for m in month_list]
    by_store_list = [{"store_id": sid, "store_name": s["store_name"], "revenue": round(s["revenue"], 2), "order_count": s["order_count"]} for sid, s in by_store.items()]

    return {
        "total_revenue": round(total_revenue, 2),
        "revenue_this_month": round(revenue_this_month, 2),
        "revenue_last_month": round(revenue_last_month, 2),
        "orders_this_month": orders_this_month,
        "orders_last_month": orders_last_month,
        "total_orders": sum(by_month[m]["order_count"] for m in by_month),
        "by_month": by_month_list,
        "by_store": by_store_list,
    }