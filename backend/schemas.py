from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# --- Common Config for all Pydantic Models ---
# This is crucial for Pydantic to be able to read data from SQLAlchemy ORM models
class Config:
    orm_mode = True # Use from_attributes = True for Pydantic v2+

# --- Tag Schemas ---
class TagBase(BaseModel):
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
    admin_only: Optional[bool] = False
    text_color: Optional[str] = None
    built_in: Optional[bool] = False

class TagCreate(TagBase):
    pass

class TagUpdate(TagBase):
    # All fields are optional for updates
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    admin_only: Optional[bool] = None
    text_color: Optional[str] = None
    built_in: Optional[bool] = None

class Tag(TagBase):
    id: int
    class Config:
        orm_mode = True # Required for SQLAlchemy ORM compatibility

# --- ImagePath Schemas ---
class ImagePathBase(BaseModel):
    path: str
    parent: Optional[str] = None
    description: Optional[str] = None
    ignore: Optional[bool] = False
    admin_only: Optional[bool] = True
    basepath: Optional[bool] = False
    built_in: Optional[bool] = False

class ImagePathCreate(ImagePathBase):
    # For creation, no ID or auto-generated fields are needed
    pass

class ImagePathUpdate(ImagePathBase):
    # All fields are optional for updates
    path: Optional[str] = None
    parent: Optional[str] = None
    description: Optional[str] = None
    ignore: Optional[bool] = None
    admin_only: Optional[bool] = None
    basepath: Optional[bool] = None
    built_in: Optional[bool] = None

class ImagePath(ImagePathBase):
    id: int
    # For read operations, include associated tags
    tags: List[Tag] = [] # Nested Pydantic model for tags
    class Config:
        orm_mode = True

# --- Image Schemas ---
class ImageBase(BaseModel):
    checksum: str
    filename: str
    path: str
    meta: Optional[Any] = None # JSON type handled by Pydantic as Any (dict)
    is_video: Optional[bool] = False

class ImageCreate(ImageBase):
    # When creating an image, you might pass tag IDs to associate
    tag_ids: List[int] = [] # For associating existing tags by ID
    pass

class ImageUpdate(ImageBase):
    # All fields optional for update
    checksum: Optional[str] = None
    filename: Optional[str] = None
    path: Optional[str] = None
    meta: Optional[Any] = None
    is_video: Optional[bool] = None
    tag_ids: Optional[List[int]] = None # Allow updating associated tags

class Image(ImageBase):
    id: int
    date_created: datetime
    date_modified: datetime
    created_by: int
    modified_by: int
    tags: List[Tag] = [] # Nested Pydantic model for tags
    class Config:
        orm_mode = True

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    admin: Optional[bool] = False
    login_allowed: Optional[bool] = False

class UserCreate(UserBase):
    password: str # Password is required on creation

class UserUpdate(UserBase):
    username: Optional[str] = None
    password: Optional[str] = None # Allow password update
    admin: Optional[bool] = None
    login_allowed: Optional[bool] = None

class User(UserBase):
    id: int
    # Do NOT expose password in the read model
    class Config:
        orm_mode = True

# --- Setting Schemas ---
class SettingBase(BaseModel):
    name: str
    value: str
    admin_only: Optional[bool] = False

class SettingCreate(SettingBase):
    pass

class SettingUpdate(SettingBase):
    name: Optional[str] = None
    value: Optional[str] = None
    admin_only: Optional[bool] = None

class Setting(SettingBase):
    id: int
    class Config:
        orm_mode = True

# --- UserSetting Schemas ---
class UserSettingBase(BaseModel):
    name: str
    user_id: int
    device_id: Optional[str] = None
    value: str

class UserSettingCreate(UserSettingBase):
    pass

class UserSettingUpdate(UserSettingBase):
    name: Optional[str] = None
    user_id: Optional[int] = None
    device_id: Optional[str] = None
    value: Optional[str] = None

class UserSetting(UserSettingBase):
    id: int
    class Config:
        orm_mode = True

# --- Filter Schemas ---
class FilterBase(BaseModel):
    name: str
    enabled: Optional[bool] = False
    search_terms: Optional[str] = None
    color: Optional[str] = None
    text_color: Optional[str] = None
    icon: Optional[str] = None
    header_display: Optional[bool] = False
    header_side: Optional[str] = "Right"
    built_in: Optional[bool] = False
    admin_only: Optional[bool] = False

class FilterCreate(FilterBase):
    # When creating a filter, you might pass tag IDs for positive and negative associations
    tag_ids: List[int] = []
    neg_tag_ids: List[int] = []

class FilterUpdate(FilterBase):
    # All fields optional for update
    name: Optional[str] = None
    enabled: Optional[bool] = None
    search_terms: Optional[str] = None
    color: Optional[str] = None
    text_color: Optional[str] = None
    icon: Optional[str] = None
    header_display: Optional[bool] = None
    header_side: Optional[str] = None
    built_in: Optional[bool] = None
    admin_only: Optional[bool] = None
    tag_ids: Optional[List[int]] = None
    neg_tag_ids: Optional[List[int]] = None

class Filter(FilterBase):
    id: int
    tags: List[Tag] = []       # Nested Pydantic model for positive tags
    neg_tags: List[Tag] = []   # Nested Pydantic model for negative tags
    class Config:
        orm_mode = True

# --- UserFilter Schemas ---
class UserFilterBase(BaseModel):
    filter_id: int
    user_id: int
    enabled: Optional[bool] = False

class UserFilterCreate(UserFilterBase):
    pass

class UserFilterUpdate(UserFilterBase):
    filter_id: Optional[int] = None
    user_id: Optional[int] = None
    enabled: Optional[bool] = None

class UserFilter(UserFilterBase):
    id: int
    class Config:
        orm_mode = True