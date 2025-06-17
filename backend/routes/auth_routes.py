from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List, Optional

import auth
import database
import models
import schemas
import config

# Initialize FastAPI Router for authentication routes
router = APIRouter()

# --- Authentication Endpoints ---

@router.post("/signup/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def signup(user_data: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """
    Registers a new user.
    Admins can create other users (including other admins) via this API.
    Non-admin user signup is controlled by the 'allow_signup' global setting.
    """
    # Check if global signup is allowed for non-admin users
    allow_signup_setting = db.query(models.Setting).filter_by(name='allow_signup').first()
    if allow_signup_setting and allow_signup_setting.value.lower() != 'true':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User signup is currently disabled by administrator."
        )

    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = auth.get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        password_hash=hashed_password,
        admin=user_data.admin,
        login_allowed=user_data.login_allowed
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """
    Authenticates a user and returns an access token.
    Checks global 'allow_login' setting and user's 'login_allowed' status.
    Admins are exempt from these restrictions.
    """
    user = db.query(models.User).filter(models.User.username == form_data.username).first()

    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    allow_login_setting = db.query(models.Setting).filter_by(name='allow_login').first()
    if allow_login_setting and allow_login_setting.value.lower() != 'true':
        if not user.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User login is currently disabled by administrator. Please contact an administrator."
            )

    if not user.login_allowed:
        if not user.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account login is disabled. Please contact an administrator."
            )

    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me/", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    # Retrieves information about the current authenticated user.
    return current_user