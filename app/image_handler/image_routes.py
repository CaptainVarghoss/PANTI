from flask import Blueprint, render_template, send_from_directory, request, json
from flask_login import login_required
from app.models import db, Image, Tag
from app.settings import get_settings
from .image_handler import ImageHandler

image_routes = Blueprint('image_routes', __name__)

@image_routes.route('/get_new_content')
def list_new_images():
    settings = get_settings()
    results = Image.query.order_by(Image.id.desc())
    return render_template("live_update.html", images=results, settings=settings)

@image_routes.route('/get-image/<path:filename>')
def send_media(filename):
    return send_from_directory(get_settings('base_path'), filename)

@image_routes.route('/get-meta/<path:filename>')
def get_meta(filename):
    print('Checking meta')
    folder = get_settings('base_path')
    meta = ImageHandler(folder, filename)
    return meta.get_meta()

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
            all_tags = Tag.query
            tag_list = [tag for tag in all_tags if tag not in tags]

    return render_template('includes/modal_tag_box.html', image=image, tag_list=tag_list, tags=tags)

@image_routes.route('/get_image_info/<int:id>')
def get_image_info(id):
    if id:
        image = Image.query.filter_by(id=id).first()
        tags = image.tags
        if image:
            all_tags = Tag.query
            tag_list = [tag for tag in all_tags if tag not in tags]
            temp_meta = image.meta
            temp_meta = json.loads(temp_meta['parameters'])
            if temp_meta:
                #might be swarm?
                temp_meta = temp_meta['sui_image_params']
                if temp_meta:
                    #actually swarm, pass data
                    meta = temp_meta

            return render_template('modal_image_info.html', image=image, meta=meta, tag_list=tag_list, tags=tags)
        else:
            return
    else:
        return