# FIX THIS
# Entire file maybe uneeded depending on use of user filters at all

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

# Import necessary modules relative to the backend directory
import auth
import database
import models
import schemas

router = APIRouter()

# --- UserFilter Endpoints ---

@router.post("/userfilters/", response_model=schemas.UserFilter, status_code=status.HTTP_201_CREATED)
def create_user_filter(user_filter: schemas.UserFilterCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Creates a new user-specific filter.
    Requires authentication. Users can only create filters for their own user_id unless they are admin.
    """
    if not current_user.admin and user_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create filters for other users.")
    db_user_filter = models.UserFilter(**user_filter.dict())
    db.add(db_user_filter)
    db.commit()
    db.refresh(db_user_filter)
    return db_user_filter

@router.get("/userfilters/", response_model=List[schemas.UserFilter])
def read_user_filters(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Retrieves a list of user-specific filters.
    Requires authentication. Users can only view their own filters unless they are admin.
    """
    if current_user.admin:
        user_filters = db.query(models.UserFilter).offset(skip).limit(limit).all()
    else:
        user_filters = db.query(models.UserFilter).filter(models.UserFilter.user_id == current_user.id).offset(skip).limit(limit).all()
    return user_filters

@router.get("/userfilters/{user_filter_id}", response_model=schemas.UserFilter)
def read_user_filter(user_filter_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Retrieves a single user-specific filter by ID.
    Requires authentication. Users can only view their own filters unless they are admin.
    """
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    if not current_user.admin and db_user_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this user filter.")
    return db_user_filter

@router.put("/userfilters/{user_filter_id}", response_model=schemas.UserFilter)
def update_user_filter(user_filter_id: int, user_filter: schemas.UserFilterUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Updates an existing user-specific filter.
    Requires authentication. Users can only update their own filters unless they are admin.
    """
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    if not current_user.admin and db_user_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this user filter.")
    for key, value in user_filter.dict(exclude_unset=True).items():
        setattr(db_user_filter, key, value)
    db.commit()
    db.refresh(db_user_filter)
    return db_user_filter

@router.delete("/userfilters/{user_filter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_filter(user_filter_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Deletes a user-specific filter.
    Requires authentication. Users can only delete their own filters unless they are admin.
    """
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    if not current_user.admin and db_user_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this user filter.")
    db.delete(db_user_filter)
    db.commit()
    return
