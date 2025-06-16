from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime, timezone

Base = declarative_base()

# Many-to-Many association table for Images and Tags
image_tags = Table(
    'image_tags',
    Base.metadata,
    Column('image_id', Integer, ForeignKey('images.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

# Many-to-Many association table for ImagePaths and Tags
imagepath_tags = Table(
    'imagepath_tags',
    Base.metadata,
    Column('imagepath_id', Integer, ForeignKey('imagepaths.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

# Many-to-Many association table for Filters and Tags (positive matches)
filter_tags = Table(
    'filter_tags',
    Base.metadata,
    Column('filter_id', Integer, ForeignKey('filters.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

# Many-to-Many association table for Filters and Tags (negative matches)
filter_neg_tags = Table(
    'filter_neg_tags',
    Base.metadata,
    Column('filter_id', Integer, ForeignKey('filters.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    admin = Column(Boolean, default=False)
    login_allowed = Column(Boolean, default=True)


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    color = Column(String, default="#333333")
    icon = Column(String, default="tag")
    admin_only = Column(Boolean, default=False)
    text_color = Column(String, default="#ffffff")
    built_in = Column(Boolean, default=False)

    images = relationship("Image", secondary=image_tags, back_populates="tags")
    image_paths = relationship("ImagePath", secondary=imagepath_tags, back_populates="tags")
    filters_positive = relationship("Filter", secondary=filter_tags, back_populates="tags")
    filters_negative = relationship("Filter", secondary=filter_neg_tags, back_populates="neg_tags")


class ImagePath(Base):
    __tablename__ = "imagepaths"
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, index=True, nullable=False)
    description = Column(String)
    ignore = Column(Boolean, default=False)
    admin_only = Column(Boolean, default=True)
    basepath = Column(Boolean, default=False)
    built_in = Column(Boolean, default=False)

    tags = relationship("Tag", secondary=imagepath_tags, back_populates="image_paths")


class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True, index=True)
    checksum = Column(String, unique=True, index=True, nullable=False)
    filename = Column(String, nullable=False)
    path = Column(String, nullable=False)
    meta = Column(Text)
    is_video = Column(Boolean, default=False)

    date_created = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())
    date_modified = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), server_default=func.now())

    created_by = Column(Integer, ForeignKey("users.id"))
    modified_by = Column(Integer, ForeignKey("users.id"))

    tags = relationship("Tag", secondary=image_tags, back_populates="images")
    created_user = relationship("User", foreign_keys=[created_by])
    modified_user = relationship("User", foreign_keys=[modified_by])


class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    admin_only = Column(Boolean, default=False) # Whether this setting is only editable by admins
    display_name = Column(String) # User-friendly name for the setting
    description = Column(String) # Detailed description
    group = Column(String) # Category for grouping in UI (e.g., 'Appearance', 'Security')
    input_type = Column(String, default='text') # 'text', 'number', 'switch', 'custom_sidebar_switches'


class DeviceSetting(Base):
    __tablename__ = "device_settings"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_id = Column(String, nullable=False, index=True) # Device identifier
    value = Column(String, nullable=False)

    # Ensure that a user can only have one override per setting name per device
    __table_args__ = (UniqueConstraint('user_id', 'device_id', 'name', name='_device_setting_uc'),)


class Filter(Base):
    __tablename__ = "filters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    enabled = Column(Boolean, default=False)
    search_terms = Column(Text)
    color = Column(String, default="#333333")
    text_color = Column(String, default="#ffffff")
    icon = Column(String, default="filter")
    header_display = Column(Boolean, default=False)
    header_side = Column(String, default="Right")
    built_in = Column(Boolean, default=False)
    admin_only = Column(Boolean, default=False)

    tags = relationship("Tag", secondary=filter_tags, back_populates="filters_positive")
    neg_tags = relationship("Tag", secondary=filter_neg_tags, back_populates="filters_negative")


class UserFilter(Base):
    __tablename__ = "user_filters"
    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(Integer, ForeignKey("filters.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    enabled = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint('filter_id', 'user_id', name='_user_filter_uc'),)
