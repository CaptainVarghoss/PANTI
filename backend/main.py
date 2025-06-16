from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from pathlib import Path
import os, json, threading
from contextlib import asynccontextmanager
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

import config
import models
import database
import schemas
import scanner
from scanner import parse_size_setting, generate_thumbnail_in_background
import auth

# --- Application Lifespan Context Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Handles application startup and shutdown events.

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
            db.add(models.Setting(name='sidebar', value='Left', admin_only=False,
                                 display_name='Sidebar Display', description='Controls which sidebars are enabled (Left, Right, Both).',
                                 group='Appearance', input_type='custom_sidebar_switches'))
            db.add(models.Setting(name='allow_signup', value='False', admin_only=True,
                                 display_name='Allow New User Signup', description='If enabled, new users can register themselves. Admin only.',
                                 group='Security', input_type='switch'))
            db.add(models.Setting(name='allow_login', value='False', admin_only=True,
                                 display_name='Allow User Login', description='If disabled, only admins can log in. Admin only.',
                                 group='Security', input_type='switch'))
            db.add(models.Setting(name='allow_tag_add', value='False', admin_only=True,
                                 display_name='Allow Tag Add to Image', description='Allow users to add existing tags to images.',
                                 group='Permissions', input_type='switch'))
            db.add(models.Setting(name='allow_tag_remove', value='False', admin_only=True,
                                 display_name='Allow Tag Remove from Image', description='Allow users to remove tags from images.',
                                 group='Permissions', input_type='switch'))
            db.add(models.Setting(name='allow_tag_create', value='False', admin_only=True,
                                 display_name='Allow Tag Creation', description='Allow users to create new tags.',
                                 group='Permissions', input_type='switch'))
            db.add(models.Setting(name='allow_tag_delete', value='False', admin_only=True,
                                 display_name='Allow Tag Deletion', description='Allow users to delete tags permanently.',
                                 group='Permissions', input_type='switch'))
            db.add(models.Setting(name='allow_tag_edit', value='False', admin_only=True,
                                 display_name='Allow Tag Edit', description='Allow users to edit existing tags (name, color, etc.).',
                                 group='Permissions', input_type='switch'))
            db.add(models.Setting(name='allow_folder_tag_add', value='False', admin_only=True,
                                 display_name='Allow Folder Tag Add', description='Allow users to add tags to folders.',
                                 group='Permissions', input_type='switch'))
            db.add(models.Setting(name='allow_folder_tag_remove', value='False', admin_only=True,
                                 display_name='Allow Folder Tag Remove', description='Allow users to remove tags from folders.',
                                 group='Permissions', input_type='switch'))
            db.add(models.Setting(name='thumb_size', value='400', admin_only=True,
                                 display_name='Thumbnail Size (px)', description='Max dimension for generated image thumbnails.',
                                 group='Media', input_type='number'))
            db.add(models.Setting(name='flyout', value='False', admin_only=True,
                                 display_name='Enable Flyout Mode', description='Enable flyout mode for external media display.',
                                 group='Flyout', input_type='switch'))
            db.add(models.Setting(name='flyout_address', value='False', admin_only=True,
                                 display_name='Flyout Server Address', description='Address for the flyout server if enabled.',
                                 group='Flyout', input_type='text'))
            db.add(models.Setting(name='thumb_num', value='60', admin_only=False,
                                 display_name='Thumbnails Per Page', description='Number of thumbnails to display per page in the image grid.',
                                 group='Appearance', input_type='number'))
            db.add(models.Setting(name='enable_previews', value='False', admin_only=False,
                                 display_name='Enable Previews', description='Enable generation and display of larger image previews.',
                                 group='Media', input_type='switch'))
            db.add(models.Setting(name='preview_size', value='1024', admin_only=True,
                                 display_name='Preview Size (px)', description='Max dimension for generated image previews.',
                                 group='Media', input_type='number'))
            db.add(models.Setting(name='thumb_offset', value='0', admin_only=False,
                                 display_name='Thumbnail Offset', description='Change this to increase or decrease thumbnail size.',
                                 group='Appearance', input_type='number'))
            db.add(models.Setting(name='theme', value='default', admin_only=False,
                                 display_name='Default Theme', description='The default visual theme of the application (e.g., "default", "dark", "light").',
                                 group='Appearance', input_type='text')) # Could be a dropdown in future
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

        if not db.query(models.User).first():
            print("No users found. Creating a default admin user: admin/adminpass")
            hashed_password = auth.get_password_hash("adminpass")
            admin_user = models.User(username="admin", password_hash=hashed_password, admin=True, login_allowed=True)
            db.add(admin_user)
            db.commit()
            print("Default admin user created.")

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

    # Shutdown Events
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

# --- Authentication Endpoints ---
@app.post("/api/signup/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def signup(user_data: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Check if signup is allowed
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
        admin=user_data.admin, # Admins can create other admins via API
        login_allowed=user_data.login_allowed # Admins can set login_allowed
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()

    # Verify username and password hash first for any user
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check global 'allow_login' setting. Admins are exempt from this global restriction.
    allow_login_setting = db.query(models.Setting).filter_by(name='allow_login').first()
    if allow_login_setting and allow_login_setting.value.lower() != 'true':
        # If global login is disabled, *only* allow if the user is an admin
        if not user.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User login is currently disabled by administrator. Please contact an administrator."
            )

    # Check individual user's 'login_allowed' setting. Admins are exempt from this individual restriction as well.
    if not user.login_allowed:
        if not user.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account login is disabled. Please contact an administrator."
            )

    # If we reach here, the user is authenticated and authorized to log in.
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me/", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    # Retrieves information about the current authenticated user.
    return current_user

# --- API Endpoints ---

@app.post("/api/scan-files/", summary="Trigger File System Scan", response_model=dict)
def trigger_file_scan(current_user: models.User = Depends(auth.get_current_admin_user)):
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
def create_tag(tag: schemas.TagCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
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
def update_tag(tag_id: int, tag: schemas.TagUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    for key, value in tag.dict(exclude_unset=True).items():
        setattr(db_tag, key, value)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@app.delete("/api/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(db_tag)
    db.commit()
    return


# ImagePaths
@app.post("/api/imagepaths/", response_model=schemas.ImagePath, status_code=status.HTTP_201_CREATED)
def create_image_path(path: schemas.ImagePathCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
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
def update_image_path(path_id: int, path: schemas.ImagePathUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_image_path = db.query(models.ImagePath).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    for key, value in path.dict(exclude_unset=True).items():
        setattr(db_image_path, key, value)
    db.commit()
    db.refresh(db_image_path)
    return db_image_path

@app.delete("/api/imagepaths/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image_path(path_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_image_path = db.query(models.ImagePath).filter(models.ImagePath.id == path_id).first()
    if db_image_path is None:
        raise HTTPException(status_code=404, detail="ImagePath not found")
    db.delete(db_image_path)
    db.commit()
    return


# Images
@app.post("/api/images/", response_model=schemas.Image, status_code=status.HTTP_201_CREATED)
def create_image(image: schemas.ImageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
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

    static_path = os.path.join(config.STATIC_FILES_URL_PREFIX, config.GENERATED_MEDIA_DIR_NAME)
    thumbnails_path = os.path.join(static_path, config.THUMBNAILS_DIR_NAME)
    previews_path = os.path.join(static_path, config.PREVIEWS_DIR_NAME)

    print(thumbnails_path)

    thumb_size_setting = db.query(models.Setting).filter_by(name='thumb_size').first()
    preview_size_setting = db.query(models.Setting).filter_by(name='preview_size').first()
    # FIX THIS
    dynamic_thumbnail_size = config.THUMBNAIL_SIZE
    dynamic_preview_size = config.PREVIEW_SIZE

    if thumb_size_setting and thumb_size_setting.value:
        parsed_thumb_size = parse_size_setting(thumb_size_setting.value)
        if parsed_thumb_size:
            dynamic_thumbnail_size = parsed_thumb_size

    if preview_size_setting and preview_size_setting.value:
        parsed_preview_size = parse_size_setting(preview_size_setting.value)
        if parsed_preview_size:
            dynamic_preview_size = parsed_preview_size

    response_images = []
    for img in images:
        # Check if thumbnail exists, if not, trigger generation in background
        expected_thumbnail_path = Path(config.THUMBNAILS_DIR) / f"{img.checksum}_thumb.webp"
        if not os.path.exists(expected_thumbnail_path):
            print(f"Thumbnail for {img.filename} (ID: {img.id}) not found. Triggering background generation.")
            # Ensure original_filepath is extracted from meta
            original_filepath = json.loads(img.meta).get("original_filepath") if img.meta else None
            if original_filepath and Path(original_filepath).is_file():
                thread = threading.Thread(
                    target=generate_thumbnail_in_background, # Use the function from scanner.py
                    args=(img.id, img.checksum, original_filepath, dynamic_thumbnail_size, dynamic_preview_size)
                )
                thread.daemon = True
                thread.start()
            else:
                print(f"Could not trigger thumbnail generation for {img.filename}: original_filepath not found or invalid.")

        img_dict = img.__dict__.copy()
        img_dict.pop('_sa_instance_state', None)
        # Convert meta string back to dict for Pydantic (though Pydantic can often handle JSON strings)
        if isinstance(img_dict.get('meta'), str):
             try:
                 img_dict['meta'] = json.loads(img_dict['meta'])
             except json.JSONDecodeError:
                 img_dict['meta'] = {} # Fallback if meta is not valid JSON
        elif img_dict.get('meta') is None: # Ensure meta is a dict, not None
            img_dict['meta'] = {}

        img_dict['thumbnails_path'] = thumbnails_path
        img_dict['previews_path'] = previews_path
        print(img_dict['thumbnails_path'])
        # Validate and convert to Pydantic schema
        response_images.append(schemas.Image(**img_dict))

    return response_images

@app.get("/api/images/{image_id}", response_model=schemas.Image)
def read_image(image_id: int, db: Session = Depends(database.get_db)):
    db_image = db.query(models.Image).options(joinedload(models.Image.tags)).filter(models.Image.id == image_id).first()
    if db_image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    # FIX THIS Fetch dynamic sizes from settings (same as in scanner.py for consistency)
    static_path = os.path.join(config.STATIC_FILES_URL_PREFIX, config.GENERATED_MEDIA_DIR_NAME)
    thumbnails_path = os.path.join(static_path, config.THUMBNAILS_DIR_NAME)
    previews_path = os.path.join(static_path, config.PREVIEWS_DIR_NAME)

    thumb_size_setting = db.query(models.Setting).filter_by(name='thumb_size').first()
    preview_size_setting = db.query(models.Setting).filter_by(name='preview_size').first()

    dynamic_thumbnail_size = config.THUMBNAIL_SIZE
    dynamic_preview_size = config.PREVIEW_SIZE

    if thumb_size_setting and thumb_size_setting.value:
        parsed_thumb_size = parse_size_setting(thumb_size_setting.value)
        if parsed_thumb_size:
            dynamic_thumbnail_size = parsed_thumb_size

    if preview_size_setting and preview_size_setting.value:
        parsed_preview_size = parse_size_setting(preview_size_setting.value)
        if parsed_preview_size:
            dynamic_preview_size = parsed_preview_size

    # Check if thumbnail exists, if not, trigger generation in background
    expected_thumbnail_path = Path(config.THUMBNAILS_DIR) / f"{db_image.checksum}_thumb.webp"
    if not expected_thumbnail_path.exists():
        print(f"Thumbnail for {db_image.filename} (ID: {db_image.id}) not found. Triggering background generation.")
        original_filepath = json.loads(db_image.meta).get("original_filepath") if db_image.meta else None
        if original_filepath and Path(original_filepath).is_file():
            thread = threading.Thread(
                target=generate_thumbnail_in_background, # Use the function from scanner.py
                args=(db_image.id, db_image.checksum, original_filepath, dynamic_thumbnail_size, dynamic_preview_size)
            )
            thread.daemon = True
            thread.start()
        else:
            print(f"Could not trigger thumbnail generation for {db_image.filename}: original_filepath not found or invalid.")

    img_dict = db_image.__dict__.copy() # Use .copy()
    img_dict.pop('_sa_instance_state', None)
    if isinstance(img_dict.get('meta'), str):
        try:
            img_dict['meta'] = json.loads(img_dict['meta'])
        except json.JSONDecodeError:
            img_dict['meta'] = {}
    elif img_dict.get('meta') is None:
        img_dict['meta'] = {}

    img_dict['thumbnails_path'] = thumbnails_path
    img_dict['previews_path'] = previews_path

    return schemas.Image(**img_dict)

@app.put("/api/images/{image_id}", response_model=schemas.Image)
def update_image(image_id: int, image: schemas.ImageUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
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
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = auth.get_password_hash(user.password) # HASH THE PASSWORD
    new_user = models.User(
        username=user.username,
        password_hash=hashed_password,
        admin=user.admin,
        login_allowed=user.login_allowed
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/api/users/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@app.get("/api/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.put("/api/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user: schemas.UserUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Only hash password if it's provided in the update (i.e., not None)
    if user.password is not None:
        db_user.password_hash = auth.get_password_hash(user.password) # HASH THE PASSWORD ON UPDATE

    # Update other fields, excluding 'password' as it's handled separately
    user_dict = user.dict(exclude_unset=True)
    if 'password' in user_dict:
        del user_dict['password'] # Prevent plain password from being set on the model

    for key, value in user_dict.items():
        setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)): # PROTECTED
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete your own user account")
    db.delete(db_user)
    db.commit()
    return


# Settings (Protected for admins)
@app.post("/api/settings/", response_model=schemas.Setting, status_code=status.HTTP_201_CREATED)
def create_setting(setting: schemas.SettingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)): # PROTECTED
    db_setting = models.Setting(**setting.dict())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@app.get("/api/settings/", response_model=List[schemas.Setting])
def read_settings_tiered(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
    device_id: Optional[str] = Query(None, description="Unique ID of the client device for device-specific settings")
):
    # Retrieves a consolidated list of settings with full metadata,
    # applying a tiered fallback: Device-specific value -> User-specific value -> Global value.

    # Fetch all global settings first, as these contain the metadata (display_name, input_type, etc.)
    global_settings_map = {s.name: s for s in db.query(models.Setting).all()}

    tiered_settings_list: List[schemas.Setting] = [
        schemas.Setting.model_validate({c.name: getattr(global_setting_obj, c.name) for c in global_setting_obj.__table__.columns})
        for global_setting_obj in global_settings_map.values()
    ]

    # Convert tiered_settings_list to a map for easy lookup by name during overrides
    tiered_settings_map_by_name = {s.name: s for s in tiered_settings_list}

    # 2. Override with User-Specific Settings (if logged in)
    user_settings = db.query(models.UserSetting).filter_by(user_id=current_user.id).all()
    for user_setting in user_settings:
        if user_setting.name in tiered_settings_map_by_name:
            setting_to_override = tiered_settings_map_by_name[user_setting.name]
            original_global_setting = global_settings_map.get(user_setting.name)

            # Only apply override if corresponding global setting exists and is NOT admin_only
            if original_global_setting and not original_global_setting.admin_only:
                setting_to_override.value = user_setting.value
            else:
                # This case implies a UserSetting exists for an admin_only global setting,
                # which should be prevented by create/update endpoints. Log as warning.
                print(f"Warning: UserSetting '{user_setting.name}' found for admin-only global setting or missing global setting. Ignoring override in tiered view.")


    # 3. Override with Device-Specific Settings (if logged in and device_id provided)
    if device_id:
        device_settings = db.query(models.DeviceSetting).filter_by(
            user_id=current_user.id,
            device_id=device_id
        ).all()
        for device_setting in device_settings:
            if device_setting.name in tiered_settings_map_by_name:
                setting_to_override = tiered_settings_map_by_name[device_setting.name]
                original_global_setting = global_settings_map.get(device_setting.name)

                # Only apply override if corresponding global setting exists and is NOT admin_only
                if original_global_setting and not original_global_setting.admin_only:
                    setting_to_override.value = device_setting.value
                else:
                    # This case implies a DeviceSetting exists for an admin_only global setting,
                    # which should be prevented by create/update endpoints. Log as warning.
                    print(f"Warning: DeviceSetting '{device_setting.name}' found for admin-only global setting or missing global setting. Ignoring override in tiered view.")

    # Return the list of Pydantic Setting objects with their final, tiered values
    return list(tiered_settings_map_by_name.values())

@app.get("/api/settings/{setting_id}", response_model=schemas.Setting)
def read_setting(setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return db_setting

@app.put("/api/settings/{setting_id}", response_model=schemas.Setting)
def update_setting(setting_id: int, setting: schemas.SettingUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    for key, value in setting.dict(exclude_unset=True).items():
        setattr(db_setting, key, value)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@app.delete("/api/settings/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    db.delete(db_setting)
    db.commit()
    return

@app.get("/api/global-settings/", response_model=List[schemas.Setting])
def read_all_global_settings(
    skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    # Retrieves all global settings as a list of Setting objects.
    settings = db.query(models.Setting).offset(skip).limit(limit).all()
    return settings

# User-accessible settings with overrides
@app.get("/api/user-accessible-settings/", response_model=List[schemas.Setting])
def read_user_accessible_settings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
    device_id: Optional[str] = Query(None, description="Optional device ID to fetch device-specific overrides.")
):
    # Retrieves settings that are accessible to the current user,
    # with user-specific and device-specific overrides applied to global settings
    # that are not admin-only. Returns full metadata for each setting.

    # 1. Fetch all global settings that are NOT admin_only
    global_settings = db.query(models.Setting).filter(models.Setting.admin_only == False).all()

    # Create a dictionary for quick lookup and to hold the final overridden values
    # Initialize with copies of global settings (including metadata)
    user_view_settings_map = {
        s.name: schemas.Setting.model_validate({c.name: getattr(s, c.name) for c in s.__table__.columns})
        for s in global_settings
    }

    # 2. Apply User-specific overrides
    user_overrides = db.query(models.UserSetting).filter(models.UserSetting.user_id == current_user.id).all()
    for user_override in user_overrides:
        if user_override.name in user_view_settings_map:
            # Overwrite the value with the user's specific setting
            user_view_settings_map[user_override.name].value = user_override.value
            user_view_settings_map[user_override.name].source = 'user' # Add a source indicator

    # 3. Apply Device-specific overrides (if device_id is provided)
    if device_id:
        device_overrides = db.query(models.DeviceSetting).filter(
            models.DeviceSetting.user_id == current_user.id,
            models.DeviceSetting.device_id == device_id
        ).all()
        for device_override in device_overrides:
            if device_override.name in user_view_settings_map:
                # Device settings take precedence over user settings
                user_view_settings_map[device_override.name].value = device_override.value
                user_view_settings_map[device_override.name].source = 'device' # Add a source indicator

    # Return the list of Pydantic Setting objects
    return list(user_view_settings_map.values())

# UserSettings (Protected for authenticated users, can only manage their own or admin can manage all)
@app.post("/api/usersettings/", response_model=schemas.UserSetting, status_code=status.HTTP_201_CREATED)
def create_user_setting(user_setting: schemas.UserSettingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.admin and user_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create settings for other users.")

    global_setting = db.query(models.Setting).filter_by(name=user_setting.name).first()
    if not global_setting:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot create user setting for non-existent global setting '{user_setting.name}'.")
    if global_setting.admin_only: # If the global setting itself is admin_only, no user can override it.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Setting '{user_setting.name}' is an admin-only global setting and cannot be overridden by any user.")

    db_user_setting = models.UserSetting(**user_setting.dict())
    db.add(db_user_setting)
    db.commit()
    db.refresh(db_user_setting)
    return db_user_setting

@app.get("/api/usersettings/", response_model=List[schemas.UserSetting])
def read_user_settings(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_settings = db.query(models.UserSetting).filter(models.UserSetting.user_id == current_user.id).offset(skip).limit(limit).all()
    return user_settings

@app.get("/api/usersettings/{user_setting_id}", response_model=schemas.UserSetting)
def read_user_setting(user_setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_user_setting = db.query(models.UserSetting).filter(models.UserSetting.id == user_setting_id).first()
    if db_user_setting is None:
        raise HTTPException(status_code=404, detail="UserSetting not found")
    if not current_user.admin and db_user_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this user setting.")
    return db_user_setting

@app.put("/api/usersettings/{user_setting_id}", response_model=schemas.UserSetting)
def update_user_setting(user_setting_id: int, user_setting: schemas.UserSettingUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_user_setting = db.query(models.UserSetting).filter(models.UserSetting.id == user_setting_id).first()
    if db_user_setting is None:
        raise HTTPException(status_code=404, detail="UserSetting not found")
    if not current_user.admin and db_user_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this user setting.")

    # Get the name from the existing db_user_setting to check against global setting rules
    setting_name_for_check = db_user_setting.name # Use existing name

    global_setting = db.query(models.Setting).filter_by(name=setting_name_for_check).first()
    if global_setting and global_setting.admin_only: # If the global setting itself is admin_only, no user can override it.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Setting '{setting_name_for_check}' is an admin-only global setting and cannot be overridden by any user.")

    for key, value in user_setting.dict(exclude_unset=True).items():
        setattr(db_user_setting, key, value)
    db.commit()
    db.refresh(db_user_setting)
    return db_user_setting

@app.delete("/api/usersettings/{user_setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_setting(user_setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_user_setting = db.query(models.UserSetting).filter(models.UserSetting.id == user_setting_id).first()
    if db_user_setting is None:
        raise HTTPException(status_code=404, detail="UserSetting not found")
    if not current_user.admin and db_user_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this user setting.")
    db.delete(db_user_setting)
    db.commit()
    return

# DeviceSettings
@app.post("/api/devicesettings/", response_model=schemas.DeviceSetting, status_code=status.HTTP_201_CREATED)
def create_device_setting(device_setting: schemas.DeviceSettingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.admin and device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create device settings for other users.")

    global_setting = db.query(models.Setting).filter_by(name=device_setting.name).first()
    if not global_setting:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot create device setting for non-existent global setting '{device_setting.name}'.")
    if global_setting.admin_only: # If the global setting itself is admin_only, no user can override it.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Setting '{device_setting.name}' is an admin-only global setting and cannot be overridden by any user at the device level.")

    db_device_setting = models.DeviceSetting(**device_setting.dict())
    db.add(db_device_setting)
    db.commit()
    db.refresh(db_device_setting)
    return db_device_setting

@app.get("/api/devicesettings/", response_model=List[schemas.DeviceSetting])
def read_device_settings(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user), # PROTECTED
    target_user_id: Optional[int] = Query(None, description="Filter by user ID (admin only)")
):
    # Retrieves a list of device settings.
    if current_user.admin:
        query = db.query(models.DeviceSetting)
        if target_user_id is not None:
            query = query.filter(models.DeviceSetting.user_id == target_user_id)
        device_settings = query.offset(skip).limit(limit).all()
    else:
        # Regular users can only view their own device settings
        if target_user_id is not None and target_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view other users' device settings.")
        device_settings = db.query(models.DeviceSetting).filter(models.DeviceSetting.user_id == current_user.id).offset(skip).limit(limit).all()
    return device_settings

@app.get("/api/devicesettings/{device_setting_id}", response_model=schemas.DeviceSetting)
def read_device_setting(device_setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_device_setting = db.query(models.DeviceSetting).filter(models.DeviceSetting.id == device_setting_id).first()
    if db_device_setting is None:
        raise HTTPException(status_code=404, detail="DeviceSetting not found")

    if not current_user.admin and db_device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this device setting.")
    return db_device_setting

@app.put("/api/devicesettings/{device_setting_id}", response_model=schemas.DeviceSetting)
def update_device_setting(device_setting_id: int, device_setting: schemas.DeviceSettingUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_device_setting = db.query(models.DeviceSetting).filter(models.DeviceSetting.id == device_setting_id).first()
    if db_device_setting is None:
        raise HTTPException(status_code=404, detail="DeviceSetting not found")

    if not current_user.admin and db_device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this device setting.")

    if not current_user.admin and device_setting.user_id is not None and device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to change user_id of device settings.")

    # Get the name from the existing db_device_setting to check against global setting rules
    setting_name_for_check = db_device_setting.name # Use existing name

    global_setting = db.query(models.Setting).filter_by(name=setting_name_for_check).first()
    if global_setting and global_setting.admin_only: # If the global setting itself is admin_only, no user can override it.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Setting '{setting_name_for_check}' is an admin-only global setting and cannot be overridden by any user at the device level.")

    for key, value in device_setting.dict(exclude_unset=True).items():
        setattr(db_device_setting, key, value)
    db.commit()
    db.refresh(db_device_setting)
    return db_device_setting

@app.delete("/api/devicesettings/{device_setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device_setting(device_setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_device_setting = db.query(models.DeviceSetting).filter(models.DeviceSetting.id == device_setting_id).first()
    if db_device_setting is None:
        raise HTTPException(status_code=404, detail="DeviceSetting not found")

    if not current_user.admin and db_device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this device setting.")
    db.delete(db_device_setting)
    db.commit()
    return

# Filters (Protected for admins)
@app.post("/api/filters/", response_model=schemas.Filter, status_code=status.HTTP_201_CREATED)
def create_filter(filter_in: schemas.FilterCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
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
def read_filters(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)): # No protection, allow all users to see filters
    filters = db.query(models.Filter).options(joinedload(models.Filter.tags), joinedload(models.Filter.neg_tags)).offset(skip).limit(limit).all()
    return filters

@app.get("/api/filters/{filter_id}", response_model=schemas.Filter)
def read_filter(filter_id: int, db: Session = Depends(database.get_db)): # No protection
    db_filter = db.query(models.Filter).options(joinedload(models.Filter.tags), joinedload(models.Filter.neg_tags)).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    return db_filter

@app.put("/api/filters/{filter_id}", response_model=schemas.Filter)
def update_filter(filter_id: int, filter_in: schemas.FilterUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)): # PROTECTED
    db_filter = db.query(models.Filter).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")

    # Update simple fields
    for key, value in filter_in.dict(exclude_unset=True, exclude={'tag_ids', 'neg_tag_ids'}).items():
        setattr(db_filter, key, value)

    # Handle tags relationship update
    if filter_in.tag_ids is not None:
        db_filter.tags.clear()
        for tag_id in filter_in.tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_filter.tags.append(tag)
            else:
                raise HTTPException(status_code=400, detail=f"Tag with ID {tag_id} not found for positive tags.")

    # Handle neg_tags relationship update
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

@app.delete("/api/filters/{filter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filter(filter_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)): # PROTECTED
    db_filter = db.query(models.Filter).filter(models.Filter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    db.delete(db_filter)
    db.commit()
    return


# UserFilters (These need to be protected for sure!)
@app.post("/api/userfilters/", response_model=schemas.UserFilter, status_code=status.HTTP_201_CREATED)
def create_user_filter(user_filter: schemas.UserFilterCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)): # PROTECTED
    if not current_user.admin and user_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create settings for other users.")
    db_user_filter = models.UserFilter(**user_filter.dict())
    db.add(db_user_filter)
    db.commit()
    db.refresh(db_user_filter)
    return db_user_filter

@app.get("/api/userfilters/", response_model=List[schemas.UserFilter])
def read_user_filters(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)): # PROTECTED
    if current_user.admin: # Admins can see all user filters
        user_filters = db.query(models.UserFilter).offset(skip).limit(limit).all()
    else: # Regular users can only see their own
        user_filters = db.query(models.UserFilter).filter(models.UserFilter.user_id == current_user.id).offset(skip).limit(limit).all()
    return user_filters

@app.get("/api/userfilters/{user_filter_id}", response_model=schemas.UserFilter)
def read_user_filter(user_filter_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)): # PROTECTED
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    if not current_user.admin and db_user_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this user filter.")
    return db_user_filter

@app.put("/api/userfilters/{user_filter_id}", response_model=schemas.UserFilter)
def update_user_filter(user_filter_id: int, user_filter: schemas.UserFilterUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)): # PROTECTED
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

@app.delete("/api/userfilters/{user_filter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_filter(user_filter_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)): # PROTECTED
    db_user_filter = db.query(models.UserFilter).filter(models.UserFilter.id == user_filter_id).first()
    if db_user_filter is None:
        raise HTTPException(status_code=404, detail="UserFilter not found")
    if not current_user.admin and db_user_filter.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this user filter.")
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

# Mount the static directory for generated media
if config.STATIC_DIR.is_dir():
    app.mount(
        config.STATIC_FILES_URL_PREFIX,
        StaticFiles(directory=config.STATIC_DIR),
        name="static_assets"
    )
    print(f"Serving static assets from: {config.STATIC_DIR} at URL prefix: {config.STATIC_FILES_URL_PREFIX}")
else:
    print(f"Static directory not found at: {config.STATIC_DIR}. Generated media will not be served.")