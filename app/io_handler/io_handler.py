from flask_login import current_user
from app.models import ImagePath, db
from app.settings import get_settings
import os
# Collection of small functions and helpers to handle file and folder IO related tasks.



def extract_path_parts(path):
    if path:
        selfpath = os.path.basename(path)
        parentpath = os.path.dirname(path)
        return selfpath, parentpath
    else:
        return ''

def get_path_list():
    if current_user.admin:
        query = ImagePath.query
    else:
        query = ImagePath.query.filter_by(admin_only=0)
    return query

def db_check_path(path):
    print(f'Our path is: {path}')
    query = ImagePath.query.filter_by(fullpath=path).first()
    if not query:
        result = db_add_directory(path)
    else:
        result = query
    return result

def db_add_directory(path):
    try:
        fullpath = path
        # should check fullpath against existing 'base' paths
        selfpath, parentpath = extract_path_parts(path)
        basepath = get_settings('base_path')
        temp_path = parentpath.replace(basepath, '')
        if temp_path == '':
            # no parent
            parentpath = ''
        else:
            parentpath = temp_path
        new_dir = ImagePath(path=selfpath, parent=parentpath, fullpath=fullpath )
        db.session.add(new_dir)
        db.session.commit()

    except:
        print(f'Error creating database entry for path: {path}')