from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from app.models import db, Image, Tag, ImagePath
from app.routes.settings import get_settings
import os

tag_routes = Blueprint('tag_routes', __name__)

# Build the modal with tag form and list and metadata
# Handles general 'get' as well as 'add' and 'del' for tags

@tag_routes.route('/tags/<string:op>/<int:image_id>/<int:tag_id>', methods=['POST'])
@login_required
def tag_handler(op='get', image_id=0, tag_id=0):
    if image_id != 0:
        image = Image.query.filter_by(id=image_id).first()
        if tag_id != 0:
            tag = Tag.query.filter_by(id=tag_id).first()
            if request.method == 'POST':
                if op == 'add':
                    image.tags.append(tag)
                    db.session.commit()
                elif op == 'del':
                    image.tags.remove(tag)
                    db.session.commit()
                else:
                    return 'Invalid Operation', 404
            tags = image.tags
            if current_user.admin:
                all_tags = Tag.query
            else:
                all_tags = Tag.query.filter_by(admin_only=0)
            tag_list = [tag for tag in all_tags if tag not in tags]

    return render_template('includes/modal_tag_box.html', image=image, tag_list=tag_list, tags=tags)

@tag_routes.route('/folder/tags/<string:op>/<int:folder_id>/<int:tag_id>', methods=['POST'])
@login_required
def folder_tag_handler(op='get', folder_id=0, tag_id=0):
    if request.method == 'POST':
        if folder_id != 0:
            folder = ImagePath.query.filter_by(id=folder_id).first()
            if tag_id != 0:
                tag = Tag.query.filter_by(id=tag_id).first()
                # also add tag to any files in folder
                images = Image.query.filter_by(path=folder.path)
                images_count = images.count()
                if images_count != 0:
                    images = images.all()
                    if op == 'add':
                        folder.tags.append(tag)
                        for i in images:
                            if tag not in i.tags:
                                print(f'Adding tags to: {i.filename}')
                                i.tags.append(tag)
                        db.session.commit()
                    elif op == 'del':
                        folder.tags.remove(tag)
                        for i in images:
                            if tag in i.tags:
                                print(f'Removing tags from: {i.filename}')
                                i.tags.remove(tag)
                        db.session.commit()
                    else:
                        return 'Invalid Operation', 404
                tags = folder.tags
                if current_user.admin:
                    all_tags = Tag.query
                else:
                    all_tags = Tag.query.filter_by(admin_only=0)
                tag_list = [tag for tag in all_tags if tag not in tags]

    from app.helpers.io_handler import get_path_list
    folder_list = get_path_list(ignore=True)
    dir_list = get_path_list()

    return render_template('includes/folder_list.html', folder=folder, tag_list=tag_list, tags=tags, folder_list=folder_list, dir_list=dir_list)