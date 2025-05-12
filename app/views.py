from flask import Blueprint, render_template, request, Response
from flask_login import login_required, current_user
from .models import Image, Tag, ImagePath, db
import re
from sqlalchemy import or_, and_, not_, func
from app.routes.settings import get_settings
from app.classes.bulk_functions import ScanFiles
from app.helpers.io_handler import get_path_list

views = Blueprint('views', __name__)

@views.route('/', methods=['GET', 'POST'])
@login_required
def home():
    search = False
    settings = get_settings()
    q = request.args.get('q', '')
    if request.method == 'POST':
        search = True
        if q == '':
            q = request.form.get('q','')
    images, image_count = db_get_images(limit=settings['thumb_num'], query=construct_query(q))
    if current_user.admin:
        tag_list = Tag.query
    else:
        tag_list = Tag.query.filter_by(admin_only=0)
    dir_list = get_path_list()

    if search:
        template = 'search.html'
    else:
        template = 'home.html'

    return render_template(template, images=images, image_count=image_count, settings=settings, search=q, next_offset=settings['thumb_num'], offscreen_tag_list=tag_list, dir_list=dir_list)

@views.route('/load_more_images')
def load_more_images():
    settings = get_settings()
    offset = int(request.args.get('offset', 0))
    q = request.args.get('q', '')
    new_images, image_count = db_get_images(limit=settings['thumb_num'], offset=offset, query=construct_query(q))

    return render_template('search.html', images=new_images, image_count=image_count, settings=settings, search=q, next_offset=offset + int(settings['thumb_num']))


@views.route('/stream')
def live_updates():
    return Response(send_update(), mimetype='text/event-stream')

def send_update():
    template_url = '/search'
    yield f'data: <div hx-get="{template_url}" hx-target="#imagesBlock" hx-swap="afterbegin"></div>'

def db_get_images(order=Image.id.desc(), limit=60, offset=0, query=''):
    base_query = Image.query.outerjoin(ImagePath, Image.path == ImagePath.path)

    # Apply the filter if a query is provided
    if query != '':
        base_query = base_query.filter(query)

    # Apply ordering for both count and image retrieval
    count_query = base_query.order_by(order)
    images_query = base_query.order_by(order).limit(limit).offset(offset)

    # Get the count *before* applying limit and offset
    image_count = count_query.count()
    images = images_query.all()  # Execute the query to get image objects.  Use .all()

    if image_count == 0:
            return '', 0

    return images, image_count

def construct_query(keywords):
    tokens = re.split(r'(\sand\s|\sAND\s|\sor\s|\sOR\s|\s=\s|\s>\s|\s<\s|\s>=\s|\snot\s|\sNOT\s|\sLIKE\s|\sIN\s|\sNOT IN\s)', keywords)

    conditions = []
    operators = []

    i = 0
    if not current_user.admin:
    # limit to non-admin folders
        operators.append("AND")
        conditions.append(or_(ImagePath.admin_only == False, ImagePath.admin_only == None))
    while i < len(tokens):
        item = tokens[i].strip()
        upper_item = item.upper()

        if upper_item == "AND" or upper_item == "OR" or upper_item == "NOT":
            operators.append(upper_item)
        elif upper_item.startswith("TAG "):
            tag_keyword = item[4:].strip()
            if tag_keyword:
                conditions.append(Image.tags.any(func.lower(Tag.name) == func.lower(tag_keyword)))
        elif upper_item.startswith("FOLDER "):
            folder_keyword = item[7:].strip()
            if folder_keyword:
                conditions.append(func.lower(Image.path) == func.lower(folder_keyword))
        elif item:  # Non-operator and not starting with TAG or FOLDER
            search_condition = or_(
                Image.meta.ilike(f"%{item}%"),
                Image.path.ilike(f"%{item}%"),
                Image.tags.any(Tag.name.ilike(f"%{item}%"))
            )
            conditions.append(search_condition)
        i += 1
    if not current_user.admin:
        # limit to non-admin tags
        operators.append("AND")
        admin_condition = or_(
                Image.tags.any() == False,
                ~Image.tags.any(Tag.admin_only == True)
        )
        conditions.append(admin_condition)
        i += 1
    # Apply conditions based on operators
    if not conditions:
        #return query  # No search terms
        return ''

    final_condition = conditions[0]
    condition_index = 1
    for operator in operators:
        if condition_index < len(conditions):
            next_condition = conditions[condition_index]
            if operator == "AND":
                final_condition = and_(final_condition, next_condition)
            elif operator == "OR":
                final_condition = or_(final_condition, next_condition)
            elif operator == "NOT":
                final_condition = and_(final_condition, not_(next_condition))
            condition_index += 1

    return final_condition