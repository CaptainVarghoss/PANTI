from flask_login import UserMixin
from sqlalchemy import event
from sqlalchemy.sql import func
from . import db
import os

image_tag_table = db.Table('image_tags',
    db.Column('images_id', db.Integer, db.ForeignKey('images.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id'), primary_key=True)
)

path_tag_table = db.Table('path_tags',
    db.Column('paths_id', db.Integer, db.ForeignKey('image_paths.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id'), primary_key=True)
)

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
    is_video = db.Column(db.Boolean, default=False)

class ImagePath(db.Model):
    __tablename__ = 'image_paths'
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(250))
    parent = db.Column(db.String(250))
    description = db.Column(db.String(250))
    ignore = db.Column(db.Boolean, default=False)
    admin_only = db.Column(db.Boolean, default=True)
    tags = db.relationship('Tag', secondary='path_tags', backref=db.backref('image_paths', lazy='dynamic'))
    basepath = db.Column(db.Boolean, default=False)
    built_in = db.Column(db.Boolean, default=False)

class Tag(db.Model):
    __tablename__ = 'tags'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(250), unique=True)
    color = db.Column(db.String(250))
    icon = db.Column(db.String(250))
    admin_only = db.Column(db.Boolean, default=False)
    text_color = db.Column(db.String(250))
    built_in = db.Column(db.Boolean, default=False)

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
    admin_only = db.Column(db.Boolean, default=False)

class UserSetting(db.Model):
    __tablename__ = 'user_settings'
    id = db.Column(db.Integer, primary_key=True)
    setting_id = db.Column(db.Integer)
    user_id = db.Column(db.Integer)
    device_id = db.Column(db.String(250))
    value = db.Column(db.String(250))

def register_initial_data_listener(app):
    with db.session.begin():
        if not Tag.query.first():
            db.session.add(Tag(name='Favorite', built_in=True))
            db.session.add(Tag(name='Like', built_in=True))
            db.session.add(Tag(name='Star', built_in=True))
            db.session.add(Tag(name='NSFW', built_in=True))
        if not Setting.query.first():
            db.session.add(Setting(name='sidebar', value='Left'))
            db.session.add(Setting(name='allow_signup', value='False', admin_only=True)) # allows new user accounts
            db.session.add(Setting(name='allow_login', value='False', admin_only=True)) # allows non-admin logins
            db.session.add(Setting(name='allow_tag_add', value='False', admin_only=True)) # non-admin add tags to images
            db.session.add(Setting(name='allow_tag_remove', value='False', admin_only=True)) # non-admin remove tags from images
            db.session.add(Setting(name='allow_tag_create', value='False', admin_only=True)) # non-admin create system-wide tags
            db.session.add(Setting(name='allow_tag_delete', value='False', admin_only=True)) # non-admin delete system-wide tags
            db.session.add(Setting(name='allow_tag_edit', value='False', admin_only=True)) # non-admin edit system-wide tags
            db.session.add(Setting(name='allow_folder_tag_add', value='False', admin_only=True)) # non-admin add tags to folders
            db.session.add(Setting(name='allow_folder_tag_remove', value='False', admin_only=True)) # non-admin remove tags from folders
            db.session.add(Setting(name='thumb_size', value='400', admin_only=True)) # size of auto-generated thumbnails
            db.session.add(Setting(name='flyout', value='False', admin_only=True)) # not implemented
            db.session.add(Setting(name='flyout_address', value='False', admin_only=True)) # not implemented
            db.session.add(Setting(name='thumb_num', value='60')) # number of thumbnails per 'page'
            db.session.add(Setting(name='enable_previews', value='False')) # generate mid-size preview images (user/device)
            db.session.add(Setting(name='preview_size', value='1024', admin_only=True))
            db.session.add(Setting(name='thumb_offset', value='0')) # offset for thumbnail display size (user/device)
            db.session.add(Setting(name='theme', value='default')) # default theme
        if not ImagePath.query.first():
            db.session.add(ImagePath(path=os.path.join(app.root_path, 'static/images'), description='Default Path', basepath=True, built_in=True))
    return
