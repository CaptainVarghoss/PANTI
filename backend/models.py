from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, func
from sqlalchemy.orm import relationship, backref
from database import Base

# --- Association Tables ---
image_tag_table = Table('image_tags', Base.metadata,
    Column('images_id', Integer, ForeignKey('images.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

path_tag_table = Table('path_tags', Base.metadata,
    Column('paths_id', Integer, ForeignKey('image_paths.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

filter_tag_table = Table('filter_tags', Base.metadata,
    Column('filters_id', Integer, ForeignKey('filters.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

filter_neg_tag_table = Table('filter_neg_tags', Base.metadata,
    Column('filters_id', Integer, ForeignKey('filters.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

# --- Model Classes ---

class Image(Base):
    __tablename__ = 'images'
    id = Column(Integer, primary_key=True)
    checksum = Column(String(100), unique=True)
    filename = Column(String(250))
    path = Column(String(250))
    meta = Column(String)
    tags = relationship('Tag', secondary=image_tag_table, backref=backref('images', lazy='dynamic'))
    date_created = Column(DateTime(timezone=True), default=func.now())
    date_modified = Column(DateTime(timezone=True), default=func.now())
    created_by = Column(Integer, default=0)
    modified_by = Column(Integer, default=0)
    is_video = Column(Boolean, default=False)

class ImagePath(Base):
    __tablename__ = 'image_paths'
    id = Column(Integer, primary_key=True)
    path = Column(String(250))
    parent = Column(String(250))
    description = Column(String(250))
    ignore = Column(Boolean, default=False)
    admin_only = Column(Boolean, default=True)
    tags = relationship('Tag', secondary=path_tag_table, backref=backref('image_paths', lazy='dynamic'))
    basepath = Column(Boolean, default=False)
    built_in = Column(Boolean, default=False)

class Tag(Base):
    __tablename__ = 'tags'
    id = Column(Integer, primary_key=True)
    name = Column(String(250), unique=True)
    color = Column(String(250))
    icon = Column(String(250))
    admin_only = Column(Boolean, default=False)
    text_color = Column(String(250))
    built_in = Column(Boolean, default=False)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(100), nullable=False)
    admin = Column(Boolean, default=False)
    login_allowed = Column(Boolean, default=False)

class Setting(Base):
    __tablename__ = 'settings'
    id = Column(Integer, primary_key=True)
    name = Column(String(250), unique=True)
    value = Column(String(250))
    admin_only = Column(Boolean, default=False)

class UserSetting(Base):
    __tablename__ = 'user_settings'
    id = Column(Integer, primary_key=True)
    name = Column(String(250))
    user_id = Column(Integer) # Consider adding ForeignKey here if you have a User relationship
    device_id = Column(String(250))
    value = Column(String(250))

class Filter(Base):
    __tablename__ = 'filters'
    id = Column(Integer, primary_key=True)
    name = Column(String(250))
    enabled = Column(Boolean, default=False)
    search_terms = Column(String(500))
    color = Column(String(100))
    text_color = Column(String(100))
    icon = Column(String(100))
    header_display = Column(Boolean, default=False)
    header_side = Column(String(10), default="Right")
    tags = relationship('Tag', secondary=filter_tag_table, backref=backref('tag_filters', lazy='dynamic'))
    neg_tags = relationship('Tag', secondary=filter_neg_tag_table, backref=backref('tag_neg_filters', lazy='dynamic'))
    built_in = Column(Boolean, default=False)
    admin_only = Column(Boolean, default=False)

class UserFilter(Base):
    __tablename__ = 'user_filters'
    id = Column(Integer, primary_key=True)
    filter_id = Column(Integer) # Consider adding ForeignKey here
    user_id = Column(Integer)   # Consider adding ForeignKey here
    enabled = Column(Boolean, default=False)

