"""Authentication API endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_access_token, get_current_user
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, 
    LoginRequest, 
    AuthResponse, 
    UserOut,
    VerifyEmailRequest,
    ResendOTPRequest,
    RegisterResponse
)
from app.services.email_service import (
    generate_otp, 
    store_otp, 
    verify_otp, 
    send_otp_email,
    check_otp_rate_limit,
    set_otp_cooldown
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user and send verification OTP."""
    # Validate password length
    if len(data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )

    if len(data.name.strip()) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required",
        )

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user (unverified by default)
    user = User(
        email=data.email.lower(),
        name=data.name.strip(),
        hashed_password=hash_password(data.password),
        is_email_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"New user registered (pending verification): {user.email}")

    # Generate and send OTP
    otp = generate_otp()
    await store_otp(user.email, otp)
    
    # Send email in background (or await if simple)
    # Ideally use BackgroundTasks, but here we await for simplicity in MVP
    email_sent = send_otp_email(user.email, otp, user.name)
    
    if not email_sent:
        logger.warning(f"Failed to send OTP email to {user.email}")
        # We still return success, user can click "Resend OTP"
    
    return RegisterResponse(
        email=user.email,
        message="Verification code sent to your email"
    )


@router.post("/verify-email", response_model=AuthResponse)
async def verify_email(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Verify email using OTP."""
    # Check OTP
    is_valid = await verify_otp(data.email.lower(), data.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )

    # Get user
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_email_verified:
        # Already verified — just return token
        pass
    else:
        # Mark verified
        user.is_email_verified = True
        await db.commit()
        await db.refresh(user)
        logger.info(f"User verified email: {user.email}")

    # Generate token
    token = create_access_token(str(user.id), user.email)

    return AuthResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/resend-otp", status_code=status.HTTP_200_OK)
async def resend_otp(data: ResendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Resend verification OTP."""
    # Validate user exists
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified",
        )

    # Check rate limit
    can_send = await check_otp_rate_limit(user.email)
    if not can_send:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait 60 seconds before resending",
        )

    # Generate and send
    otp = generate_otp()
    await store_otp(user.email, otp)
    await set_otp_cooldown(user.email)
    
    send_otp_email(user.email, otp, user.name)

    return {"message": "Verification code sent"}


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email.",
        )

    token = create_access_token(str(user.id), user.email)

    logger.info(f"User logged in: {user.email}")

    return AuthResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserOut.model_validate(current_user)
