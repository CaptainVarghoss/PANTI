from flask import Blueprint, render_template, send_from_directory, json
from flask_login import login_required, current_user
from app.models import Image, Tag
from app.views import db_get_images, construct_query

image_routes = Blueprint('image_routes', __name__)

@image_routes.route('/get_thumbnail/<int:image_id>', methods=['GET'])
@login_required
def get_new_image(image_id):
    image, count = db_get_images(image_id=image_id, query=construct_query(''))
    if not image:
        return ''

    return render_template("includes/thumbnail.html", i=image)

@image_routes.route('/get-image/<path:checksum>')
@login_required
def send_media(checksum):
    image = Image.query.filter_by(checksum=checksum).first()
    return send_from_directory(image.path, image.filename)


@image_routes.route('/get_image_info/<int:id>')
@login_required
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
            if not image.is_video:
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
            else:
                meta = {}

            return render_template('includes/modal_image_info.html', image=image, meta=meta, tag_list=tag_list, tags=tags)
        else:
            return
    else:
        return