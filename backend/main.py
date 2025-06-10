from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os
from contextlib import asynccontextmanager
import threading

import config
import models
import database
import schemas
import scanner

# --- Application Lifespan Context Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    This is the modern way to manage lifecycle events in FastAPI.
    """
    # Startup Events
    print("Application startup initiated...")
    print("Creating database tables if they don't exist...")
    models.Base.metadata.create_all(bind=database.engine)
    print("Database tables checked/created.")

    # Initialize a database session for initial data population
    db = database.SessionLocal()
    try:
        # Populate initial data if tables are empty
        if not db.query(models.Tag).first():
            print("Adding initial Tags...")
            db.add(models.Tag(name='Favorite', built_in=True, color='darkviolet', text_color='white', icon='heart'))
            db.add(models.Tag(name='Like', built_in=True, color='hotpink', text_color='black', icon='hand-thumbs-up'))
            db.add(models.Tag(name='Star', built_in=True, color='gold', text_color='black', icon='star'))
            db.add(models.Tag(name='NSFW', built_in=True, color='darkred', text_color='white', icon='solar-xxx'))
            db.commit()
            # Refresh the session for the Tag object to be accessible after commit,
            # especially for the relationship linking below.
            db.refresh(db.query(models.Tag).filter_by(name='NSFW').first())

        if not db.query(models.Setting).first():
            print("Adding initial Settings...")
            db.add(models.Setting(name='sidebar', value='Left'))
            db.add(models.Setting(name='allow_signup', value='False', admin_only=True))
            db.add(models.Setting(name='allow_login', value='False', admin_only=True))
            db.add(models.Setting(name='allow_tag_add', value='False', admin_only=True))
            db.add(models.Setting(name='allow_tag_remove', value='False', admin_only=True))
            db.add(models.Setting(name='allow_tag_create', value='False', admin_only=True))
            db.add(models.Setting(name='allow_tag_delete', value='False', admin_only=True))
            db.add(models.Setting(name='allow_tag_edit', value='False', admin_only=True))
            db.add(models.Setting(name='allow_folder_tag_add', value='False', admin_only=True))
            db.add(models.Setting(name='allow_folder_tag_remove', value='False', admin_only=True))
            db.add(models.Setting(name='thumb_size', value='400', admin_only=True))
            db.add(models.Setting(name='flyout', value='False', admin_only=True))
            db.add(models.Setting(name='flyout_address', value='False', admin_only=True))
            db.add(models.Setting(name='thumb_num', value='60'))
            db.add(models.Setting(name='enable_previews', value='False'))
            db.add(models.Setting(name='preview_size', value='1024', admin_only=True))
            db.add(models.Setting(name='thumb_offset', value='0'))
            db.add(models.Setting(name='theme', value='default'))
            db.commit()

        if not db.query(models.ImagePath).first():
            print("Adding initial ImagePath...")
            # Use the directory defined in config.py
            image_path_to_add = str(config.DEFAULT_STATIC_IMAGES_DIR)
            os.makedirs(image_path_to_add, exist_ok=True) # Ensure the directory exists
            db.add(models.ImagePath(path=image_path_to_add, description='Default Path', basepath=True, built_in=True))
            db.commit()

        if not db.query(models.Filter).first():
            print("Adding initial Filter and linking Tag...")
            db.add(models.Filter(name='NSFW', built_in=True, color='DarkRed', text_color='White', icon='explicit', header_display=True, enabled=False, search_terms="nude, penis, pussy, cock, handjob, fellatio, anal, vaginal, ass, blowjob, deepthroat"))
            db.commit() # Commit filter first to get its ID

            first_filter_tag = db.query(models.Tag).filter_by(name='NSFW').first()
            first_filter = db.query(models.Filter).filter_by(name='NSFW').first()

            if first_filter and first_filter_tag:
                first_filter.tags.append(first_filter_tag)
                db.commit()

        # Run the initial file scan during startup
        print("Running initial file scan...")
        def run_initial_scan_in_thread():
            thread_db = database.SessionLocal()
            try:
                scanner.scan_paths(thread_db)
            finally:
                thread_db.close()

        # Start the thread for the initial scan
        initial_scan_thread = threading.Thread(target=run_initial_scan_in_thread)
        initial_scan_thread.daemon = True # Allow the program to exit even if this thread is running
        initial_scan_thread.start()

    finally:
        db.close()

    yield

    # Shutdown Events (code here will run when the app shuts down)
    print("Application shutdown initiated.")


# --- Initialize FastAPI app with the lifespan context manager ---
app = FastAPI(lifespan=lifespan)

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Allows all headers
)

# --- API Endpoints ---

@app.get("/api/message")
async def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/items/{item_id}")
async def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

@app.post("/api/data")
async def create_data(data: dict):
    return {"received_data": data, "message": "Data received successfully!"}

@app.post("/api/scan-files/", summary="Trigger File System Scan", response_model=dict)
def trigger_file_scan(): # No db dependency here, as it's handled in the thread
    # Triggers a manual scan of configured image paths for new images/videos and subdirectories.
    print("Manual file scan triggered via API. Starting in background thread...")

    def run_scan_in_thread():
        thread_db = database.SessionLocal()
        try:
            scanner.scan_paths(thread_db)
        finally:
            thread_db.close()

    # Start a new thread for the scan
    scan_thread = threading.Thread(target=run_scan_in_thread)
    scan_thread.daemon = True # Set as daemon so program can exit even if thread is running
    scan_thread.start()

    return {"message": "File scan successfully initiated in the background. Check server logs for progress."}

# --- CRUD Endpoints for All Models ---

# Tags
@app.post("/api/tags/", response_model=schemas.Tag, status_code=status.HTTP_201_CREATED)
def create_tag(tag: schemas.TagCreate, db: Session = Depends(database.get_db)):
    db_tag = models.Tag(**tag.dict())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@app.get("/api/tags/", response_model=List[schemas.Tag])
def read_tags(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    tags = db.query(models.Tag).offset(skip).limit(limit).all()
    return tags

@app.get("/api/tags/{tag_id}", response_model=schemas.Tag)
def read_tag(tag_id: int, db: Session = Depends(database.get_db)):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return db_tag

@app.put("/api/tags/{tag_id}", response_model=schemas.Tag)
def update_tag(tag_id: int, tag: schemas.TagUpdate, db: Session = Depends(database.get_db)):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    for key, value in tag.dict(exclude_unset=True).items():
        setattr(db_tag, key, value)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@app.delete("/api/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, db: Session = Depends(database.get_db)):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(db_tag)
    db.commit()
    return


# ImagePaths
@app.post("/api/imagepaths/", response_model=schemas.ImagePath, status_code=status.HTTP_201_CREATED)
def create_image_path(path: schemas.ImagePathCreate, db: Session = Depends(database.get_db)):
    db_image_path = models.ImagePath(**path.dict())
    db.add(db_image_path)
    db.commit()
    db.refresh(db_image_path)
    return db_image_path

@app.get("/api/imagepaths/", response_model=List[schemas.ImagePath])
def read_image_paths(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    # Eager load tags for ImagePath to avoid N+1 query problem
    image_paths = db.query(models.ImagePath).options(joinedload(models.ImagePath.tags)).offset(skip).limit(limit).all()
    return image_paths

@app.get("/api/imagepaths/{path_id}", response_model=schemas.ImagePath)
def read_image_path(path_id: int, db: Session = Depends(database.get_db)):
    db_image_path = db.query(models.ImagePath).options(joinedload(models.ImagePath.tags)).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    return db_image_path

@app.put("/api/imagepaths/{path_id}", response_model=schemas.ImagePath)
def update_image_path(path_id: int, path: schemas.ImagePathUpdate, db: Session = Depends(database.get_db)):
    db_image_path = db.query(models.ImagePath).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    for key, value in path.dict(exclude_unset=True).items():
        setattr(db_image_path, key, value)
    db.commit()
    db.refresh(db_image_path)
    return db_image_path

@app.delete("/api/imagepaths/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image_path(path_id: int, db: Session = Depends(database.get_db)):
    db_image_path = db.query(models.ImagePath).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    db.delete(db_image_path)
    db.commit()
    return


# Images
@app.post("/api/images/", response_model=schemas.Image, status_code=status.HTTP_201_CREATED)
def create_image(image: schemas.ImageCreate, db: Session = Depends(database.get_db)):
    db_image = models.Image(
        checksum=image.checksum,
        filename=image.filename,
        path=image.path,
        meta=image.meta,
        is_video=image.is_video
    )
    # Handle tags relationship
    for tag_id in image.tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db_image.tags.append(tag)
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

@app.get("/api/images/", response_model=List[schemas.Image])
def read_images(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    # Eager load tags for Image
    images = db.query(models.Image).options(joinedload(models.Image.tags)).offset(skip).limit(limit).all()
    return images

@app.get("/api/images/{image_id}", response_model=schemas.Image)
def read_image(image_id: int, db: Session = Depends(database.get_db)):
    db_image = db.query(models.Image).options(joinedload(models.Image.tags)).filter(models.Image.id == image_id).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return db_image

@app.put("/api/images/{image_id}", response_model=schemas.Image)
def update_image(image_id: int, image: schemas.ImageUpdate, db: Session = Depends(database.get_db)):
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    # Update simple fields
    for key, value in image.dict(exclude_unset=True, exclude={'tag_ids'}).items():
        setattr(db_image, key, value)

    # Handle tags relationship update
    if image.tag_ids is not None:
        db_image.tags.clear() # Clear existing tags
        for tag_id in image.tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_image.tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found.")

    db.commit()
    db.refresh(db_image)
    return db_image

@app.delete("/api/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(image_id: int, db: Session = Depends(database.get_db)):
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    db.delete(db_image)
    db.commit()
    return


# Users
@app.post("/api/users/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # You might want to hash the password here in a real application
    db_user = models.User(username=user.username, password=user.password, admin=user.admin, login_allowed=user.login_allowed)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/api/users/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@app.get("/api/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.put("/api/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user: schemas.UserUpdate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in user.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return


# Settings
@app.post("/api/settings/", response_model=schemas.Setting, status_code=status.HTTP_201_CREATED)
def create_setting(setting: schemas.SettingCreate, db: Session = Depends(database.get_db)):
    db_setting = models.Setting(**setting.dict())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@app.get("/api/settings/", response_model=List[schemas.Setting])
def read_settings(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    settings = db.query(models.Setting).offset(skip).limit(limit).all()
    return settings

@app.get("/api/settings/{setting_id}", response_model=schemas.Setting)
def read_setting(setting_id: int, db: Session = Depends(database.get_db)):
    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return db_setting

@app.put("/api/settings/{setting_id}", response_model=schemas.Setting)
def update_setting(setting_id: int, setting: schemas.SettingUpdate, db: Session = Depends(database.get_db)):
    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    for key, value in setting.dict(exclude_unset=True).items():
        setattr(db_setting, key, value)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@app.delete("/api/settings/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(setting_id: int, db: Session = Depends(database.get_db)):
    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    db.delete(db_setting)
    db.commit()
    return


# UserSettings
@app.post("/api/usersettings/", response_model=schemas.UserSetting, status_code=status.HTTP_201_CREATED)
def create_user_setting(user_setting: schemas.UserSettingCreate, db: Session = Depends(database.get_db)):
    db_user_setting = models.UserSetting(**user_setting.dict())
    db.add(db_user_setting)
    db.commit()
    db.refresh(db_user_setting)
    return db_user_setting

@app.get("/api/usersettings/", response_model=List[schemas.UserSetting])
def read_user_settings(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    user_settings = db.query(models.UserSetting).offset(skip).limit(limit).all()
    return user_settings

@app.get("/api/usersettings/{user_setting_id}", response_model=schemas.UserSetting)
def read_user_setting(user_setting_id: int, db: Session = Depends(database.get_db)):
    db_user_setting = db.query(models.UserSetting).filter(models.UserSetting.id == user_setting_id).first()
    if db_user_setting is None:
        raise HTTPException(status_code=404, detail="UserSetting not found")
    return db_user_setting

@app.put("/api/usersettings/{user_setting_id}", response_model=schemas.UserSetting)
def update_user_setting(user_setting_id: int, user_setting: schemas.UserSettingUpdate, db: Session = Depends(database.get_db)):
    db_user_setting = db.query(models.UserSetting).filter(models.UserSetting.id == user_setting_id).first()
    if db_user_setting is None:
        raise HTTPException(status_code=404, detail="UserSetting not found")
    for key, value in user_setting.dict(exclude_unset=True).items():
        setattr(db_user_setting, key, value)
    db.commit()
    db.refresh(db_user_setting)
    return db_user_setting

@app.delete("/api/usersettings/{user_setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_setting(user_setting_id: int, db: Session = Depends(database.get_db)):
    db_user_setting = db.query(models.UserSetting).filter(models.UserSetting.id == user_setting_id).first()
    if db_user_setting is None:
        raise HTTPException(status_code=404, detail="UserSetting not found")
    db.delete(db_user_setting)
    db.commit()
    return


# Filters
@app.post("/api/filters/", response_model=schemas.Filter, status_code=status.HTTP_201_CREATED)
def create_filter(filter_in: schemas.FilterCreate, db: Session = Depends(database.get_db)):
    db_filter = models.Filter(
        name=filter_in.name,
        enabled=filter_in.enabled,
        search_terms=filter_in.search_terms,
        color=filter_in.color,
        text_color=filter_in.text_color,
        icon=filter_in.icon,
        header_display=filter_in.header_display,
        header_side=filter_in.header_side,
        built_in=filter_in.built_in,
        admin_only=filter_in.admin_only
    )
    # Handle tags
    for tag_id in filter_in.tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db_filter.tags.append(tag)
        else:
            raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for positive tags.")
    # Handle neg_tags
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

@app.get("/api/filters/", response_model=List[schemas.Filter])
def read_filters(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    # Eager load tags and neg_tags for Filter
    filters = db.query(models.Filter).options(joinedload(models.Filter.tags), joinedload(models.Filter.neg_tags)).offset(skip).limit(limit).all()
    return filters

@app.get("/api/filters/{filter_id}", response_model=schemas.Filter)
def read_filter(filter_id: int, db: Session = Depends(database.get_db)):
    db_filter = db.query(models.Filter).options(joinedload(models.Filter.tags), joinedload(models.Filter.neg_tags)).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    return db_filter

@app.put("/api/filters/{filter_id}", response_model=schemas.Filter)
def update_filter(filter_id: int, filter_in: schemas.FilterUpdate, db: Session = Depends(database.get_db)):
    db_filter = db.query(models.Filter).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")

    # Update simple fields
    for key, value in filter_in.dict(exclude_unset=True, exclude={'tag_ids', 'neg_tag_ids'}).items():
        setattr(db_filter, key, value)

    # Handle tags relationship update
    if filter_in.tag_ids is not None:
        db_filter.tags.clear() # Clear existing tags
        for tag_id in filter_in.tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_filter.tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for positive tags.")

    # Handle neg_tags relationship update
    if filter_in.neg_tag_ids is not None:
        db_filter.neg_tags.clear() # Clear existing neg_tags
        for tag_id in filter_in.neg_tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_filter.neg_tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for negative tags.")

    db.commit()
    db.refresh(db_filter)
    return db_filter

@app.delete("/api/filters/{filter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filter(filter_id: int, db: Session = Depends(database.get_db)):
    db_filter = db.query(models.Filter).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    db.delete(db_filter)
    db.commit()
    return


# UserFilters
@app.post("/api/userfilters/", response_model=schemas.UserFilter, status_code=status.HTTP_201_CREATED)
def create_user_filter(user_filter: schemas.UserFilterCreate, db: Session = Depends(database.get_db)):
    db_user_filter = models.UserFilter(**user_filter.dict())
    db.add(db_user_filter)
    db.commit()
    db.refresh(db_user_filter)
    return db_user_filter

@app.get("/api/userfilters/", response_model=List[schemas.UserFilter])
def read_user_filters(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    user_filters = db.query(models.UserFilter).offset(skip).limit(limit).all()
    return user_filters

@app.get("/api/userfilters/{user_filter_id}", response_model=schemas.UserFilter)
def read_user_filter(user_filter_id: int, db: Session = Depends(database.get_db)):
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    return db_user_filter

@app.put("/api/userfilters/{user_filter_id}", response_model=schemas.UserFilter)
def update_user_filter(user_filter_id: int, user_filter: schemas.UserFilterUpdate, db: Session = Depends(database.get_db)):
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    for key, value in user_filter.dict(exclude_unset=True).items():
        setattr(db_user_filter, key, value)
    db.commit()
    db.refresh(db_user_filter)
    return db_user_filter

@app.delete("/api/userfilters/{user_filter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_filter(user_filter_id: int, db: Session = Depends(database.get_db)):
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    db.delete(db_user_filter)
    db.commit()
    return

# --- Serve Static Files (Frontend) ---
# Check if the frontend build directory exists before mounting StaticFiles.
# This ensures that `uvicorn` doesn't fail if the frontend hasn't been built yet.
if config.FRONTEND_BUILD_DIR.is_dir():
    # Mount the static files directory.
    # The `html=True` argument ensures that if a file like `index.html` is requested
    # directly, it will be served. More importantly, it allows serving `index.html`
    # for all routes that don't match an API endpoint, which is crucial for
    # client-side routing (e.g., React Router).
    app.mount(
        "/", # Serve the frontend from the root URL of the FastAPI application
        StaticFiles(directory=config.FRONTEND_BUILD_DIR, html=True),
        name="frontend"
    )
    print(f"Serving frontend from: {config.FRONTEND_BUILD_DIR}")
else:
    print(f"Frontend build directory not found at: {config.FRONTEND_BUILD_DIR}")
    print("Please run 'npm run build' in the frontend directory first.")