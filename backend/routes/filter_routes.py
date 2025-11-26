from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

import auth
import database
import models
import schemas

router = APIRouter()

# --- Filter Endpoints ---

@router.post("/filters/", response_model=schemas.Filter, status_code=status.HTTP_201_CREATED)
def create_filter(filter_in: schemas.FilterCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Creates a new filter. Only accessible by admin users.

    db_filter = models.Filter(
        name=filter_in.name,
        enabled=filter_in.enabled,
        search_terms=filter_in.search_terms,
        header_display=filter_in.header_display,
        admin_only=filter_in.admin_only,
        main_stage=filter_in.main_stage,
        main_stage_color=filter_in.main_stage_color,
        main_stage_icon=filter_in.main_stage_icon,
        second_stage=filter_in.second_stage,
        second_stage_color=filter_in.second_stage_color,
        second_stage_icon=filter_in.second_stage_icon,
        third_stage=filter_in.third_stage,
        third_stage_color=filter_in.third_stage_color,
        third_stage_icon=filter_in.third_stage_icon,
    )
    for tag_id in filter_in.tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db_filter.tags.append(tag)
        else:
            raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for positive tags.")
    for tag_id in filter_in.neg_tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db_filter.neg_tags.append(tag)
        else:
            raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for negative tags.")
    db.add(db_filter)
    db.commit()
    db.refresh(db_filter)
    return db_filter

@router.get("/filters/", response_model=List[schemas.Filter])
def read_filters(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
    ):
    # Retrieves a list of filters.
    # Eager loads associated positive and negative tags.

    query = db.query(models.Filter).options(joinedload(models.Filter.tags), joinedload(models.Filter.neg_tags))
    if not current_user.admin:
        query = query.filter_by(admin_only=False)
    filters = query.all()
    return filters

@router.get("/filters/{filter_id}", response_model=schemas.Filter)
def read_filter(filter_id: int, db: Session = Depends(database.get_db)):
    # Retrieves a single filter by ID. Accessible by all.
    # Eager loads associated positive and negative tags.

    db_filter = db.query(models.Filter).options(joinedload(models.Filter.tags), joinedload(models.Filter.neg_tags)).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    return db_filter

@router.put("/filters/{filter_id}", response_model=schemas.Filter)
def update_filter(filter_id: int, filter_in: schemas.FilterUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Updates an existing filter. Only accessible by admin users.

    db_filter = db.query(models.Filter).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")

    for key, value in filter_in.dict(exclude_unset=True, exclude={'tag_ids', 'neg_tag_ids'}).items():
        setattr(db_filter, key, value)
    if filter_in.tag_ids is not None:
        db_filter.tags.clear()
        for tag_id in filter_in.tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_filter.tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for positive tags.")
    if filter_in.neg_tag_ids is not None:
        db_filter.neg_tags.clear()
        for tag_id in filter_in.neg_tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_filter.neg_tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for negative tags.")
    db.commit()
    db.refresh(db_filter)
    return db_filter

@router.delete("/filters/{filter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filter(filter_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Deletes a filter. Only accessible by admin users.

    db_filter = db.query(models.Filter).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    db.delete(db_filter)
    db.commit()
    return