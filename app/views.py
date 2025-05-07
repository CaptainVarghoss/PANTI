from flask import Blueprint, render_template, current_app, request
from flask_login import login_required
from .models import Image, Tag
import re
from sqlalchemy import or_, and_, not_, func

views = Blueprint('views', __name__)

@views.route('/', methods=['GET', 'POST'])
@login_required
def home():
    from app.settings import get_settings
    from app.image_handler import scan_files
    images = Image.query.order_by(Image.id.desc())
    settings = get_settings()

    return render_template('home.html', images=images, settings=settings, search="")


@views.route('/search', methods=['GET', 'POST'])
def search():
    from .models import Image
    from .settings import get_settings
    settings = get_settings()
    q = request.args.get('q')

    if q:
        results = construct_query(q)
    else:
        results = Image.query.order_by(Image.id.desc())

    return render_template("search.html", images=results, settings=settings, search=q)

def construct_query(keywords):
    tokens = re.split(r'(\sand\s|\sAND\s|\sor\s|\sOR\s|\s=\s|\s>\s|\s<\s|\s>=\s|\snot\s|\sNOT\s|\sLIKE\s|\sIN\s|\sNOT IN\s)', keywords)

    query = Image.query.order_by(Image.id.desc())
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
        return query  # No search terms

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

    return query.filter(final_condition)