from flask import Blueprint, render_template, current_app, request
from flask_login import login_required
from .models import Image, Tag
import re
from sqlalchemy import or_, and_, not_

views = Blueprint('views', __name__)

@views.route('/', methods=['GET', 'POST'])
@login_required
def home():
    from app.settings import get_settings
    from app.image_handler import scan_files
    images = Image.query.order_by(Image.id.desc())
    settings = get_settings()
    scan_files()

    return render_template('home.html', images=images, settings=settings)


@views.route('/search', methods=['GET', 'POST'])
def search():
    from .models import Image
    from .settings import get_settings
    settings = get_settings()
    q = request.args.get('q')

    if q:
        results = construct_query(q)
        #results = Image.query.filter(Image.path.icontains(q) | Image.meta.icontains(q)).order_by(Image.id.desc()).limit(60).all()
    else:
        results = Image.query.order_by(Image.id.desc())
        print('default search')

    return render_template("search.html", images=results, settings=settings)


def construct_query(keywords):
    """
    Constructs an SQLAlchemy query from a list of keywords, phrases, and operators.
    """
    tokens = re.split(r'(\sand\s|\sAND\s|\sor\s|\sOR\s|\s=\s|\s>\s|\s<\s|\s>=\s|\snot\s|\sNOT\s|\sLIKE\s|\sIN\s|\sNOT IN\s)', keywords)

    query = Image.query.order_by(Image.id.desc())
    conditions = []
    operators = []

    for item in tokens:
        print('Item: ' + item)
        cleaned_item = item.strip()
        print('Cleaned: ' + cleaned_item)
        upper_item = cleaned_item.upper()
        print('Uppered: ' + upper_item)
        if upper_item == "AND" or upper_item == "OR" or upper_item == "NOT":
            operators.append(upper_item)
        elif cleaned_item:  # Ensure it's not an empty string after stripping
            # Create conditions for searching in both name and description
            tag_condition = Image.tags.any(Tag.name.ilike(f"%{cleaned_item}%"))
            search_condition = or_(
                Image.meta.ilike(f"%{cleaned_item}%"),
                Image.path.ilike(f"%{cleaned_item}%"),
                tag_condition
            )
            conditions.append(search_condition)

    # Apply conditions based on operators
    if not conditions:
        return query  # No search terms

    final_condition = conditions[0]
    for i in range(len(operators)):
        operator = operators[i]
        if i + 1 < len(conditions):
            next_condition = conditions[i + 1]
            if operator == "AND":
                final_condition = and_(final_condition, next_condition)
            elif operator == "OR":
                final_condition = or_(final_condition, next_condition)
            elif operator == "NOT":
                final_condition = and_(final_condition, not_(next_condition))


    return query.filter(final_condition)