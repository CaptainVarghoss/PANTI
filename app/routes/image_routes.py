from flask import Blueprint, render_template, send_from_directory, request, json
from flask_login import login_required, current_user
from app.models import db, Image, Tag
from app.routes.settings import get_settings
from ..classes.image_handler import ImageHandler
import os

image_routes = Blueprint('image_routes', __name__)

@image_routes.route('/get_new_content')
def list_new_images():
    settings = get_settings()
    results = Image.query.order_by(Image.id.desc())
    return render_template("includes/live_update.html", images=results, settings=settings)

@image_routes.route('/get-image/<path:checksum>')
def send_media(checksum):
    image = Image.query.filter_by(checksum=checksum).first()
    true_path = os.path.join(get_settings('base_path'), image.path)
    return send_from_directory(true_path, image.filename)

# Build the modal with tag form and list and metadata
# Handles general 'get' as well as 'add' and 'del' for tags

@image_routes.route('/tags/<string:op>/<int:image_id>/<int:tag_id>', methods=['POST'])
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

@image_routes.route('/get_image_info/<int:id>')
def get_image_info(id):
    if id:
        image = Image.query.filter_by(id=id).first()
        tags = image.tags
        if image:
            if current_user.admin:
                all_tags = Tag.query
            else:
                all_tags = Tag.query.filter_by(admin_only=0)
            tag_list = [tag for tag in all_tags if tag not in tags]
            temp_meta = image.meta
            if type(temp_meta) == dict:
                # check if swarmui
                if 'sui_image_params' in temp_meta['parameters']:
                    # actually swarm, pass data
                    temp_meta = json.loads(temp_meta['parameters'])
                    meta = temp_meta['sui_image_params']
                else:
                # not swarm, pass normally?
                    meta = temp_meta
            else:
                meta = {}

            return render_template('includes/modal_image_info.html', image=image, meta=meta, tag_list=tag_list, tags=tags)
        else:
            return
    else:
        return