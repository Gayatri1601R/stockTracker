from __future__ import annotations

from contextlib import asynccontextmanager

import os
from datetime import UTC, datetime, timedelta
from typing import Literal, Optional

import bcrypt
import pymongo
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field

load_dotenv()

app = FastAPI(title="Stock Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-before-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

client = pymongo.MongoClient(MONGO_URL)
db = client["stock_tracker"]

users_col = db["users"]
items_col = db["stock_items"]
usage_col = db["usage_logs"]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    purchased_quantity: float = Field(gt=0)
    unit: str = Field(min_length=1, max_length=20)
    period: Literal["weekly", "monthly", "custom"]
    # Required only when period == "custom"; must be between 1 and 365
    custom_days: Optional[int] = Field(default=None, ge=1, le=365)

    def effective_days(self) -> int:
        """Return the number of days this stock period covers."""
        if self.period == "weekly":
            return 7
        if self.period == "monthly":
            return 30
        # custom
        if self.custom_days is None:
            raise ValueError("custom_days is required when period is 'custom'")
        return self.custom_days


class UsageCreate(BaseModel):
    item_id: str
    quantity_used: float = Field(ge=0)
    notes: Optional[str] = ""
    is_first_day: bool = False


# ─── Indexes ──────────────────────────────────────────────────────────────────

def ensure_indexes() -> None:
    users_col.create_index("email", unique=True)
    items_col.create_index([("user_id", 1), ("created_at", -1)])
    usage_col.create_index([("item_id", 1), ("user_id", 1), ("date", 1)], unique=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_indexes()
    yield


app.router.lifespan_context = lifespan


# ─── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def create_access_token(subject: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def object_id_or_400(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}",
        ) from exc


def serialize_doc(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    serialized = dict(doc)
    serialized["_id"] = str(serialized["_id"])
    if "user_id" in serialized:
        serialized["user_id"] = str(serialized["user_id"])
    return serialized


def item_effective_days(item: dict) -> int:
    """Return period length in days for a stored item document."""
    period = item.get("period", "weekly")
    if period == "monthly":
        return 30
    if period == "custom":
        return item.get("custom_days") or 7
    return 7


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = users_col.find_one({"_id": object_id_or_400(subject, "user id")})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


# ─── System Routes ────────────────────────────────────────────────────────────

@app.get("/")
def root() -> dict:
    return {"message": "Stock Tracker API is running"}


@app.get("/health")
def health() -> dict:
    client.admin.command("ping")
    return {"status": "ok"}


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.post("/auth/register")
def register(data: AuthRequest) -> dict:
    email = data.email.lower()
    if users_col.find_one({"email": email}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_id = users_col.insert_one(
        {
            "email": email,
            "password_hash": hash_password(data.password),
            "created_at": datetime.now(UTC),
        }
    ).inserted_id

    token = create_access_token(str(user_id))
    return {"access_token": token, "token_type": "bearer"}


@app.post("/auth/login")
def login(data: AuthRequest) -> dict:
    email = data.email.lower()
    user = users_col.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user["_id"]))
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me")
def get_profile(user: dict = Depends(get_current_user)) -> dict:
    """Return the current user's public profile."""
    return {
        "_id": str(user["_id"]),
        "email": user["email"],
        "created_at": (
            user["created_at"].isoformat()
            if isinstance(user.get("created_at"), datetime)
            else user.get("created_at")
        ),
    }


@app.post("/auth/change-password")
def change_password(
    data: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """Verify the current password, then store a new hash."""
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(data.new_password)}},
    )
    return {"message": "Password updated successfully"}


@app.post("/auth/logout")
def logout() -> dict:
    """A no-op logout endpoint for client-side token invalidation."""
    return {"message": "Logged out successfully"}


# ─── Stock Item Routes ────────────────────────────────────────────────────────

@app.post("/stock/items")
def create_item(data: ItemCreate, user: dict = Depends(get_current_user)) -> dict:
    # Validate that custom_days is supplied when period == "custom"
    if data.period == "custom" and data.custom_days is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="custom_days is required when period is 'custom'",
        )

    item = {
        "user_id": str(user["_id"]),
        "name": data.name.strip(),
        "purchased_quantity": data.purchased_quantity,
        "remaining_quantity": data.purchased_quantity,
        "unit": data.unit.strip(),
        "period": data.period,
        # Stored for 'custom' period; None for weekly / monthly
        "custom_days": data.custom_days if data.period == "custom" else None,
        "baseline_daily_usage": None,
        "created_at": datetime.now(UTC),
    }
    result = items_col.insert_one(item)
    item["_id"] = result.inserted_id
    return serialize_doc(item)


@app.get("/stock/items")
def get_items(user: dict = Depends(get_current_user)) -> list[dict]:
    items = items_col.find({"user_id": str(user["_id"])}).sort("created_at", -1)
    return [serialize_doc(item) for item in items if item is not None]


@app.get("/stock/items/{item_id}")
def get_item(item_id: str, user: dict = Depends(get_current_user)) -> dict:
    item = items_col.find_one(
        {"_id": object_id_or_400(item_id, "item id"), "user_id": str(user["_id"])}
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return serialize_doc(item)


@app.delete("/stock/items/{item_id}")
def delete_item(item_id: str, user: dict = Depends(get_current_user)) -> dict:
    item_object_id = object_id_or_400(item_id, "item id")
    result = items_col.delete_one({"_id": item_object_id, "user_id": str(user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    usage_col.delete_many({"item_id": item_id, "user_id": str(user["_id"])})
    return {"message": "Deleted"}


# ─── Usage Logging Routes ─────────────────────────────────────────────────────

@app.post("/usage/log")
def log_usage(data: UsageCreate, user: dict = Depends(get_current_user)) -> dict:
    item_object_id = object_id_or_400(data.item_id, "item id")
    item = items_col.find_one({"_id": item_object_id, "user_id": str(user["_id"])})
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    today = datetime.now(UTC).date().isoformat()
    existing = usage_col.find_one(
        {"item_id": data.item_id, "user_id": str(user["_id"]), "date": today}
    )

    previous_quantity = existing["quantity_used"] if existing else 0
    delta = data.quantity_used - previous_quantity

    if existing:
        usage_col.update_one(
            {"_id": existing["_id"]},
            {"$set": {"quantity_used": data.quantity_used, "notes": data.notes or ""}},
        )
    else:
        usage_col.insert_one(
            {
                "item_id": data.item_id,
                "user_id": str(user["_id"]),
                "quantity_used": data.quantity_used,
                "notes": data.notes or "",
                "date": today,
                "logged_at": datetime.now(UTC),
                "is_baseline_day": data.is_first_day,
            }
        )

    update_fields: dict = {
        "remaining_quantity": max(0, item["remaining_quantity"] - delta),
    }
    if data.is_first_day or item.get("baseline_daily_usage") is None:
        update_fields["baseline_daily_usage"] = data.quantity_used

    items_col.update_one(
        {"_id": item_object_id, "user_id": str(user["_id"])},
        {"$set": update_fields},
    )

    return {
        "message": "Usage logged",
        "is_baseline": data.is_first_day or item.get("baseline_daily_usage") is None,
    }


@app.get("/usage/{item_id}/today")
def check_today(item_id: str, user: dict = Depends(get_current_user)) -> dict:
    today = datetime.now(UTC).date().isoformat()
    log = usage_col.find_one(
        {"item_id": item_id, "user_id": str(user["_id"]), "date": today}
    )
    return {"logged": bool(log), "quantity": log["quantity_used"] if log else None}


@app.get("/usage/{item_id}/history")
def usage_history(
    item_id: str,
    days: int = 30,
    user: dict = Depends(get_current_user),
) -> list[dict]:
    since = (datetime.now(UTC) - timedelta(days=days)).date().isoformat()
    logs = usage_col.find(
        {"item_id": item_id, "user_id": str(user["_id"]), "date": {"$gte": since}}
    ).sort("date", 1)
    return [serialize_doc(log) for log in logs if log is not None]


# ─── Reports Route ────────────────────────────────────────────────────────────

@app.get("/reports")
def get_reports(period: str = "weekly", user: dict = Depends(get_current_user)) -> dict:
    # 'period' query param controls the report window; individual items use
    # their own stored period length for baseline calculations.
    report_days = 7 if period == "weekly" else 30
    since = (datetime.now(UTC) - timedelta(days=report_days)).date().isoformat()

    items = list(items_col.find({"user_id": str(user["_id"])}))
    report_items: list[dict] = []

    on_track = 0
    over_baseline = 0
    low_stock = 0

    for item in items:
        item_id = str(item["_id"])
        logs = list(
            usage_col.find(
                {
                    "item_id": item_id,
                    "user_id": str(user["_id"]),
                    "date": {"$gte": since},
                }
            )
        )

        total_consumed = sum(log["quantity_used"] for log in logs)
        avg_daily = total_consumed / max(len(logs), 1)
        baseline_daily = item.get("baseline_daily_usage") or 0

        # Use the item's own period length (not the report window) so that a
        # 3-day custom item is compared against 3 days of baseline, not 7.
        item_days = item_effective_days(item)
        baseline_usage = baseline_daily * item_days

        report_items.append(
            {
                "_id": item_id,
                "name": item["name"],
                "unit": item["unit"],
                "period": item["period"],
                "custom_days": item.get("custom_days"),
                "remaining_quantity": item["remaining_quantity"],
                "purchased_quantity": item["purchased_quantity"],
                "total_consumed": total_consumed,
                "baseline_usage": baseline_usage,
                "baseline_daily_usage": item.get("baseline_daily_usage"),
                "avg_daily": avg_daily,
                "log_count": len(logs),
            }
        )

        if baseline_usage > 0:
            ratio = total_consumed / baseline_usage
            if ratio > 1.2:
                over_baseline += 1
            elif ratio >= 0.6:
                on_track += 1

        if baseline_daily and item["remaining_quantity"] <= baseline_daily * 3:
            low_stock += 1

    return {
        "items": report_items,
        "summary": {
            "total_items": len(report_items),
            "on_track": on_track,
            "over_baseline": over_baseline,
            "low_stock": low_stock,
        },
    }


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)