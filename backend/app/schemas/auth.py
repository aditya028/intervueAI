"""Authentication request/response schemas."""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID


# ---- Request Schemas ----

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOTPRequest(BaseModel):
    email: EmailStr


# ---- Response Schemas ----

class UserOut(BaseModel):
    id: UUID
    email: str
    name: str
    is_active: bool
    is_email_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterResponse(BaseModel):
    requires_verification: bool = True
    email: str
    message: str = "Verification code sent to your email"
