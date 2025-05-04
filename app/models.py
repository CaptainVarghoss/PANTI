from flask_login import UserMixin
from sqlalchemy.sql import func
from . import db

image_tag_table = db.Table('image_tags',
    db.Column('images_id', db.Integer, db.ForeignKey('images.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id'), primary_key=True)
)

class PathTags(db.Model):
    __tablename__ = 'path_tags'
    id = db.Column(db.Integer, primary_key=True)
    path_id = db.Column(db.Integer, db.ForeignKey('image_paths.id'))
    tag_id = db.Column(db.Integer, db.ForeignKey('tags.id'))

class Image(db.Model):
    __tablename__ = 'images'
    id = db.Column(db.Integer, primary_key=True)
    checksum = db.Column(db.String(100), unique=True)
    filename = db.Column(db.String(250))
    path = db.Column(db.String(250))
    meta = db.Column(db.JSON)
    tags = db.relationship('Tag', secondary='image_tags', backref=db.backref('images', lazy='dynamic'))
    date_created = db.Column(db.DateTime(timezone=True), default=func.now())
    date_modified = db.Column(db.DateTime(timezone=True), default=func.now())
    created_by = db.Column(db.Integer, default=0)
    modified_by = db.Column(db.Integer, default=0)

class ImagePath(db.Model):
    __tablename__ = 'image_paths'
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(250))
    parent = db.Column(db.String(250))
    fullpath = db.Column(db.String(250))
    ignore = db.Column(db.Boolean, default=False)
    admin_only = db.Column(db.Boolean, default=True)
    tags = db.relationship('Tag', secondary='path_tags')

class Tag(db.Model):
    __tablename__ = 'tags'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(250), unique=True)
    color = db.Column(db.String(250))
    icon = db.Column(db.String(250))
    admin_only = db.Column(db.Boolean, default=False)
    text_color = db.Column(db.String(250))
    #images = db.relationship('Image', secondary='image_tags', back_populates='tags')
    #paths = db.relationship('ImagePath', secondary='path_tags', back_populates='tags')

class User(db.Model, UserMixin):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True)
    password = db.Column(db.String(150))
    admin = db.Column(db.Boolean, default=False)
    login_allowed = db.Column(db.Boolean, default=False)

class Setting(db.Model):
    __tablename__ = 'settings'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(250), unique=True)
    value = db.Column(db.String(250))
    device_id = db.Column(db.String(250))
    admin_only = db.Column(db.Boolean, default=False)

class Usersetting(db.Model):
    __tablename__ = 'user_setitngs'
    id = db.Column(db.Integer, primary_key=True)
    setting_id = db.Column(db.Integer)
    user_id = db.Column(db.Integer)
    device_id = db.Column(db.String(250))
    value = db.Column(db.String(250))
