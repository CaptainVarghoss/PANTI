from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List

import auth
import database
import models
import schemas

router = APIRouter()

# --- ImagePath Endpoints ---

@router.post("/imagepaths/", response_model=schemas.ImagePath, status_code=status.HTTP_201_CREATED)
def create_image_path(path: schemas.ImagePathCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Creates a new image path. Only accessible by admin users.

    db_image_path = models.ImagePath(**path.dict())
    db.add(db_image_path)
    db.commit()
    db.refresh(db_image_path)
    return db_image_path

@router.get("/imagepaths/", response_model=List[schemas.ImagePath])
def read_image_paths(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    # Retrieves a list of image paths. Accessible by all.

    image_paths = db.query(models.ImagePath).options(joinedload(models.ImagePath.tags)).offset(skip).limit(limit).all()
    return image_paths

@router.get("/imagepaths/{path_id}", response_model=schemas.ImagePath)
def read_image_path(path_id: int, db: Session = Depends(database.get_db)):
    # Retrieves a single image path by ID. Accessible by all.

    db_image_path = db.query(models.ImagePath).options(joinedload(models.ImagePath.tags)).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    return db_image_path

@router.put("/imagepaths/{path_id}", response_model=schemas.ImagePath)
def update_image_path(path_id: int, path: schemas.ImagePathUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Updates an existing image path. Only accessible by admin users.

    db_image_path = db.query(models.ImagePath).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    for key, value in path.dict(exclude_unset=True).items():
        setattr(db_image_path, key, value)
    db.commit()
    db.refresh(db_image_path)
    return db_image_path

@router.delete("/imagepaths/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image_path(path_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Deletes an image path. Only accessible by admin users.

    db_image_path = db.query(models.ImagePath).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    db.delete(db_image_path)
    db.commit()
    return