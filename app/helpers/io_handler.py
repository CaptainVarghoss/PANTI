from flask_login import current_user
from app.models import ImagePath, db, Image
from sqlalchemy import inspect
import os

# Collection of small functions and helpers to handle file and folder IO related tasks.


def db_scan():
    from app.routes.settings import get_settings
    images_with_paths = db.session.query(Image, ImagePath).outerjoin(ImagePath, Image.path == ImagePath.path).filter(Image.path != '').all()
    for i, f in images_with_paths:
        if f.ignore:
            db.session.delete(i)
        elif not os.path.exists(os.path.join(i.path, i.filename)):
            db.session.delete(i)
    db.session.commit()
    return


def extract_parent_path(path):
    if path:
        query = ImagePath.query.filter_by(path=path, basepath=True).first()
        if not query:
            parentpath = os.path.dirname(path)
            return parentpath
        else:
            return ''
    else:
        return ''

def get_path_list(ignore=False):
    query = ImagePath.query
    if not current_user.admin:
        query = query.filter_by(admin_only=0)
    if not ignore:
        query = query.filter_by(ignore=0)
    result = query.all()

    for r in result:
        r.short_path = os.path.basename(r.path)

    return result

def db_check_path(path):
    query = ImagePath.query.filter_by(path=path).first()
    if not query:
        result = db_add_directory(path)
    else:
        result = query
    return result

def db_add_directory(path):
    try:
        # should check fullpath against existing 'base' paths
        parentpath = extract_parent_path(path)
        new_dir = ImagePath(path=path, parent=parentpath)
        db.session.add(new_dir)
        db.session.commit()
        return new_dir

    except:
        print(f'Error creating database entry for path: {path}')