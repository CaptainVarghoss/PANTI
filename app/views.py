from flask import Blueprint, render_template, current_app, request
from flask_login import login_required
from .models import Image, Tag
import re
from sqlalchemy import or_, and_, not_, func
from app.settings import get_settings

views = Blueprint('views', __name__)

@views.route('/', methods=['GET', 'POST'])
@login_required
def home():
    settings = get_settings()
    images = db_get_images(limit=settings['thumb_num'])
    q = request.args.get('q', '')

    return render_template('home.html', images=images, settings=settings, search=q, next_offset=settings['thumb_num'])


@views.route('/search', methods=['GET', 'POST'])
def search():
    from .models import Image
    settings = get_settings()
    q = request.args.get('q')

    if q:
        results = db_get_images(limit=settings['thumb_num'],query=construct_query(q))
    else:
        results = db_get_images(limit=settings['thumb_num'])

    return render_template("search.html", images=results, settings=settings, search=q, next_offset=settings['thumb_num'])

def db_get_images(order=Image.id.desc(), limit=60, offset=0, query=''):
    if query != '':
        images = Image.query.filter(query).order_by(order).limit(limit).offset(offset)
    else:
        images = Image.query.order_by(order).limit(limit).offset(offset)

    if images.count() == 0:
        return ''

    return images

@views.route('/load_more_images')
def load_more_images():
    settings = get_settings()
    offset = int(request.args.get('offset', 0))
    q = request.args.get('q', '')
    if q:
        new_images = db_get_images(limit=settings['thumb_num'], offset=offset, query=construct_query(q))
    else:
        new_images = db_get_images(limit=settings['thumb_num'], offset=offset)
    #if not new_images:
        #return ''

    return render_template('search.html', images=new_images, settings=settings, search=q, next_offset=offset + int(settings['thumb_num']))

def construct_query(keywords):
    tokens = re.split(r'(\sand\s|\sAND\s|\sor\s|\sOR\s|\s=\s|\s>\s|\s<\s|\s>=\s|\snot\s|\sNOT\s|\sLIKE\s|\sIN\s|\sNOT IN\s)', keywords)

    #query = Image.query.order_by(Image.id.desc())
    #query = db_get_images(limit=get_settings()['thumb_num'])
    conditions = []
    operators = []

    i = 0
    while i < len(tokens):
        item = tokens[i].strip()
        upper_item = item.upper()

        if upper_item == "AND" or upper_item == "OR" or upper_item == "NOT":
            operators.append(upper_item)
        elif upper_item.startswith("TAG "):
            tag_keyword = item[4:].strip()
            if tag_keyword:
                conditions.append(Image.tags.any(func.lower(Tag.name) == func.lower(tag_keyword)))
        elif item:  # Non-operator and not starting with TAG
            search_condition = or_(
                Image.meta.ilike(f"%{item}%"),
                Image.path.ilike(f"%{item}%"),
                Image.tags.any(Tag.name.ilike(f"%{item}%"))
            )
            conditions.append(search_condition)
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