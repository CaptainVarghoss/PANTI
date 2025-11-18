from pydantic import BaseModel, ConfigDict # Import ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime

# No need for a separate BaseConfig class that inherits from ConfigDict
# Instead, we will directly use ConfigDict within each model's model_config

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    admin: bool = False
    login_allowed: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None # Allow password update
    admin: Optional[bool] = None
    login_allowed: Optional[bool] = None

class User(UserBase):
    id: int
    # No password_hash exposed in the response model for security
    model_config = ConfigDict(from_attributes=True) # Directly use ConfigDict

# --- Tag Schemas ---
class TagBase(BaseModel):
    name: str
    admin_only: bool = False
    built_in: bool = False

class TagCreate(TagBase):
    pass

class TagUpdate(TagBase):
    name: Optional[str] = None
    admin_only: Optional[bool] = None
    built_in: Optional[bool] = None

class Tag(TagBase):
    id: int
    model_config = ConfigDict(from_attributes=True) # Directly use ConfigDict

# --- ImagePath Schemas ---
class ImagePathBase(BaseModel):
    path: str
    short_name: Optional[str] = None
    description: Optional[str] = None
    ignore: bool = False
    admin_only: bool = True
    basepath: bool = False
    built_in: bool = False
    parent: Optional[str] = None

class ImagePathCreate(ImagePathBase):
    pass

class ImagePathUpdate(ImagePathBase):
    path: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    ignore: Optional[bool] = None
    admin_only: Optional[bool] = None
    tag_ids: Optional[List[int]] = None # For associating tags on update

class ImagePath(ImagePathBase):
    id: int
    tags: List[Tag] = [] # List of Tag schemas
    model_config = ConfigDict(from_attributes=True) # Directly use ConfigDict

# --- Image Schemas ---
class ImageBase(BaseModel):
    content_hash: str
    date_created: datetime
    date_modified: datetime
    exif_data: Dict[str, Any] = {} # Can be empty dict
    is_video: bool = False

class ImageCreate(ImageBase):
    tag_ids: List[int] = [] # For associating tags on creation

class ImageUpdate(ImageBase):
    content_hash: Optional[str] = None
    exif_data: Optional[Dict[str, Any]] = None
    is_video: Optional[bool] = None
    tag_ids: Optional[List[int]] = None # For associating tags on update

class ImageTagUpdate(BaseModel):
    tag_ids: List[int] = []

class ImageLocationSchema(BaseModel):
    id: int
    path: str
    filename: str
    date_scanned: datetime

    model_config = ConfigDict(from_attributes=True)

class ImageContent(ImageBase):
    id: Optional[int] = None
    filename: Optional[str] = None
    path: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    tags: List[Tag] = []
    locations: List[ImageLocationSchema] = []

    model_config = ConfigDict(from_attributes=True)

# --- Setting Schemas ---
class SettingBase(BaseModel):
    name: str
    value: str
    admin_only: bool = False
    display_name: Optional[str] = None
    description: Optional[str] = None
    group: Optional[str] = None
    input_type: str = 'text' # Default value

class SettingCreate(SettingBase):
    pass

class SettingUpdate(SettingBase):
    name: Optional[str] = None
    value: Optional[str] = None
    admin_only: Optional[bool] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    group: Optional[str] = None
    input_type: Optional[str] = None

class Setting(SettingBase):
    id: int
    source: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- DeviceSetting Schemas ---
class DeviceSettingBase(BaseModel):
    name: str
    user_id: int
    device_id: str
    value: str

class DeviceSettingCreate(DeviceSettingBase):
    pass

class DeviceSettingUpdate(DeviceSettingBase):
    name: Optional[str] = None
    user_id: Optional[int] = None
    device_id: Optional[str] = None
    value: Optional[str] = None

class DeviceSetting(DeviceSettingBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Filter Schemas ---
class FilterBase(BaseModel):
    name: str
    enabled: bool = False
    search_terms: Optional[str] = None
    color: str = "#333333"
    text_color: str = "#ffffff"
    icon: str = "filter"
    header_display: bool = False
    header_side: str = "Right"
    built_in: bool = False
    admin_only: bool = False

class FilterCreate(FilterBase):
    tag_ids: List[int] = [] # List of tag IDs for positive matches
    neg_tag_ids: List[int] = [] # List of tag IDs for negative matches

class FilterUpdate(FilterBase):
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
    tag_ids: Optional[List[int]] = None # Optional list of tag IDs for update
    neg_tag_ids: Optional[List[int]] = None # Optional list of negative tag IDs for update

class Filter(FilterBase):
    id: int
    tags: List[Tag] = [] # List of associated Tags (positive)
    neg_tags: List[Tag] = [] # List of associated Tags (negative)
    model_config = ConfigDict(from_attributes=True) # Directly use ConfigDict

# --- UserFilter Schemas ---
class UserFilterBase(BaseModel):
    filter_id: int
    user_id: int
    enabled: bool = False

class UserFilterCreate(UserFilterBase):
    pass

class UserFilterUpdate(UserFilterBase):
    filter_id: Optional[int] = None
    user_id: Optional[int] = None
    enabled: Optional[bool] = None

class UserFilter(UserFilterBase):
    id: int
    model_config = ConfigDict(from_attributes=True) # Directly use ConfigDict

# --- Token Schema for Authentication ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Trash Schema ---
class TrashInfo(BaseModel):
    item_count: int