from flask import Blueprint, render_template, request, current_app
from flask_login import login_required, current_user
from app.models import db, Image, Tag, ImagePath, UserFilter, Filter
import re
from sqlalchemy import or_, and_, not_, func
from sqlalchemy.sql.expression import false
from app.routes.settings import get_settings, get_user_settings, get_filters, get_user_filters, get_tags
from app.helpers.io_handler import get_path_list
import gevent
from app.helpers.thumbnails import generate_image_thumbnail

views = Blueprint('views', __name__)

@views.route('/', methods=['GET', 'POST'])
@login_required
def home():
    search = False
    settings = get_settings()
    user_settings = get_user_settings()
    filters = get_filters()
    q = request.args.get('q', '')
    if request.method == 'POST':
        if request.form.get('filter_button'):
            clicked_button = int(request.form.get('filter_button'))
            if clicked_button:
                toggle_filter(clicked_button)

        search = True
        if q == '':
            q = request.form.get('q','')

    filters = get_filters()
    user_filters = get_user_filters()
    images, image_count = db_get_images(limit=settings['thumb_num'], query=construct_query(q))

    thumbnail_greenlets = []
    from main import socketio
    for image in images:
        g = gevent.spawn(generate_image_thumbnail, image, settings, current_app._get_current_object(), socketio)
        thumbnail_greenlets.append(g)

    tag_list = get_tags()
    dir_list = get_path_list()

    if search:
        template = 'search.html'
    else:
        template = 'home.html'

    return render_template(f'pages/{template}', images=images, image_count=image_count, user_settings=user_settings, settings=settings, search=q, next_offset=settings['thumb_num'], offscreen_tag_list=tag_list, dir_list=dir_list, filters=filters, user_filters=user_filters)

@views.route('/load_more_images')
@login_required
def load_more_images():
    settings = get_settings()
    user_settings = get_user_settings()
    filters = get_filters()
    user_filters = get_user_filters()
    offset = int(request.args.get('offset', 0))
    q = request.args.get('q', '')
    new_images, image_count = db_get_images(limit=settings['thumb_num'], offset=offset, query=construct_query(q))

    thumbnail_greenlets = []
    from main import socketio
    for image in new_images:
        g = gevent.spawn(generate_image_thumbnail, image, settings, current_app._get_current_object(), socketio)
        thumbnail_greenlets.append(g)

    return render_template('pages/search.html', images=new_images, image_count=image_count, user_settings=user_settings, settings=settings, search=q, next_offset=offset + int(settings['thumb_num']), filters=filters, user_filters=user_filters)

def toggle_filter(id):
    filter = UserFilter.query.filter_by(filter_id=id, user_id=current_user.id).first()
    if filter.enabled == True:
        filter.enabled = False
    else:
        filter.enabled = True
    db.session.commit()

@views.route('/menu/<section>/<side>', methods=['GET', 'POST'])
@login_required
def get_offscreen_section(section, side):
    if section != '' and side != '':
        settings = get_settings()
        user_settings = get_user_settings()
        filters = get_filters()
        user_filters = get_user_filters()
        folder_list = get_path_list(ignore=True)
        dir_list = get_path_list()
        tag_list = get_tags()
        data = ''
        if section == 'filters':
            data = ''
        elif section == 'tags':
            data = ''
        elif section == 'folders':
            data = ''
        elif section == 'main':
            data = ''

        return render_template(f'includes/menu/menu_{section}.html', data=data, side=side, filters=filters, user_filters=user_filters, folder_list=folder_list, dir_list=dir_list, settings=settings, user_settings=user_settings, tag_list=tag_list)

def db_get_images(order=Image.id.desc(), limit=60, offset=0, query='', image_id=None):
    base_query = Image.query.outerjoin(ImagePath, Image.path == ImagePath.path)

    # Apply the filter if a query is provided
    if query != '':
        base_query = base_query.filter(query)

    # Apply specific ID if provided
    if image_id is not None:
        base_query = base_query.filter(Image.id == image_id)

        image = base_query.first()
        return image, (1 if image else 0)
    else:
        # Apply ordering for both count and image retrieval
        count_query = base_query
        image_count = count_query.count()

        if image_count == 0:
            return [], 0

        images_query = base_query.order_by(order).limit(limit).offset(offset)
        images = images_query.all()  # Execute the query to get image objects.  Use .all()

        return images, image_count

def construct_query(keywords):
    tokens = re.split(r'(\sand\s|\sAND\s|\sor\s|\sOR\s|\snot\s|\sNOT\s|\sLIKE\s|\sIN\s|\sNOT IN\s)', keywords)

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
                conditions.append(
                    or_(
                        Image.tags.any(func.lower(Tag.name) == func.lower(tag_keyword)),
                        ImagePath.tags.any(func.lower(Tag.name) == func.lower(tag_keyword))
                    )
                )
        elif upper_item.startswith("FOLDER "):
            folder_keyword = item[7:].strip()
            if folder_keyword:
                conditions.append(func.lower(Image.path) == func.lower(folder_keyword))
        elif item:  # Non-operator and not starting with TAG or FOLDER
            search_condition = or_(
                Image.meta.ilike(f"%{item}%"),
                Image.path.ilike(f"%{item}%"),
                Image.tags.any(Tag.name.ilike(f"%{item}%")),
                ImagePath.tags.any(Tag.name.ilike(f"%{item}%"))
            )
            conditions.append(search_condition)
        i += 1
    if not current_user.admin:
        # limit to non-admin tags
        operators.append("AND")
        admin_condition_image = or_(
                Image.tags.any() == False,
                ~Image.tags.any(Tag.admin_only == True)
        )
        admin_condition_image_path = or_(
            ImagePath.tags.any() == False, # ImagePath has no tags
            ~ImagePath.tags.any(Tag.admin_only == True) # No admin-only tags on the ImagePath
        )
        admin_condition = and_(admin_condition_image, admin_condition_image_path)
        conditions.append(admin_condition)

    # Apply conditions based on operators
    if not conditions:
        final_condition = None # Start with None if no initial conditions
    else:
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

    # --- New
    all_excluded_keywords = set()
    all_excluded_tags = set()
    all_neg_tags = set()

    user_filters = UserFilter.query.filter_by(user_id=current_user.id, enabled=0).all()
    filter_ids_to_exclude = [uf.filter_id for uf in user_filters]

    if filter_ids_to_exclude:
        disabled_filters = db.session.query(Filter).filter(Filter.id.in_(filter_ids_to_exclude)).all()

        for filter_obj in disabled_filters:
            if filter_obj.search_terms:
                keywords_from_filter = [k.strip() for k in filter_obj.search_terms.split(',') if k.strip()]
                all_excluded_keywords.update(keywords_from_filter)

            if filter_obj.tags:
                tags_from_filter = [tag.name.strip() for tag in filter_obj.tags if tag.name.strip()]
                all_excluded_tags.update(tags_from_filter)

            if filter_obj.neg_tags:
                neg_tags_from_filter = [tag.name.strip() for tag in filter_obj.neg_tags if tag.name.strip()]
                all_neg_tags.update(neg_tags_from_filter)

    # Define the 'safe' tag condition based on collected neg_tags
    safe_tag_condition = false() # Default to false if no neg_tags
    if all_neg_tags:
        safe_tag_condition = Image.tags.any(func.lower(Tag.name).in_([func.lower(t) for t in all_neg_tags]))

    exclusion_predicates = []

    # Build conditions for excluded keywords
    for ex_keyword in all_excluded_keywords:
        regex_pattern = rf'(?i)\b{re.escape(ex_keyword)}\b'
        ex_search_match = or_(
            Image.meta.op('REGEXP')(regex_pattern),
            Image.path.op('REGEXP')(regex_pattern),
            Image.tags.any(func.lower(Tag.name) == func.lower(ex_keyword)),
            ImagePath.tags.any(func.lower(Tag.name) == func.lower(ex_keyword))
        )
        # An item is truly "excluded by keyword" if it matches the keyword AND does NOT have any safe tags
        exclusion_predicates.append(and_(ex_search_match, not_(safe_tag_condition)))

    # Build conditions for excluded tags
    for ex_tag in all_excluded_tags:
        ex_tag_match = or_(
            Image.tags.any(func.lower(Tag.name) == func.lower(ex_tag)),
            ImagePath.tags.any(func.lower(Tag.name) == func.lower(ex_tag))
        )
        # An item is truly "excluded by tag" if it matches the tag AND does NOT have any safe tags
        exclusion_predicates.append(and_(ex_tag_match, not_(safe_tag_condition)))

    # Combine all exclusion predicates into a single 'should be excluded' condition
    # If ANY of the exclusion predicates are true, the item should be excluded.
    if exclusion_predicates:
        should_be_excluded_condition = or_(*exclusion_predicates)
        # We want to NOT include items that should be excluded
        if final_condition is None:
            final_condition = not_(should_be_excluded_condition)
        else:
            final_condition = and_(final_condition, not_(should_be_excluded_condition))

    return final_condition if final_condition is not None else ''
