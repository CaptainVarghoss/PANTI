from flask import Blueprint, render_template, request, session, flash, redirect, url_for
from flask_login import login_required
from ..models import Setting, db, User, Tag

settings = Blueprint('settings', __name__)

default_settings = {
    "sidebar": "Left",
    "allow_signup": "False",
    "allow_login": "False",
    "thumb_size": "350",
    "base_path": "static/images",
    "flyout": "False",
    "flyout_address": "False",
    "thumb_num": "60"
}

@settings.route('/', methods=['GET', 'POST'])
@login_required
def show_settings():
    user = User.query.filter_by(id=session['_user_id']).first()
    user_id = user.id
    settings_button = request.form.get("settings-button", False)
    tags_button = request.form.get("tags_button", False)
    tags_delete = request.form.get("tags_delete", False)

    is_admin = user.admin
    settings = get_settings()
    if request.method == 'POST':

        if settings_button != False:
            settings['sidebar'] = request.form.get('sidebar')
            if is_admin:
                settings['base_path'] = request.form.get('base_path')
                if request.form.get('allow_signup') == 'signups':
                    settings['allow_signup'] = "True"
                else:
                    settings['allow_signup'] = "False"
                if request.form.get('allow_login') == 'logins':
                    settings['allow_login'] = "True"
                else:
                    settings['allow_login'] = "False"
                settings['thumb_size'] = request.form.get('thumb_size')
            for k, v in settings.items():
                update_query = Setting.query.filter_by(name=k).first()
                update_query.name = k
                update_query.value = v
                db.session.commit()

        if tags_button != False:
            tag_name = request.form.get('name')
            tag_color = request.form.get('color')
            tag_text = request.form.get('text')
            if request.form.get('admin_only') == None:
                tag_admin = False
            else:
                tag_admin = True
            if request.form.get('id'):
                old_tag = Tag.query.filter_by(id=request.form.get('id')).first()
                old_tag.name = tag_name
                old_tag.color = tag_color
                old_tag.text_color = tag_text
                old_tag.admin_only = tag_admin
                flash('Tag Saved.', category='success')
            else:
                add_tag = Tag(name=tag_name, color=tag_color, text_color=tag_text, admin_only=tag_admin)
                db.session.add(add_tag)
                flash('Tag Added.', category='success')
            db.session.commit()
        elif tags_delete != False:
            if request.form.get('id'):
                tag = Tag.query.filter_by(id=request.form.get('id')).first()
                if tag:
                    db.session.delete(tag)
                    db.session.commit()
                    flash('Tag Deleted.', category='success')

    else:
        settings = get_settings()

    if is_admin:
        tag_list = Tag.query
    else:
        tag_list = Tag.query.filter_by(admin_only=0)

    from app.helpers.color_picker import color_picker_list
    common_colors = color_picker_list(type="common")
    all_colors = color_picker_list(type="all")

    return render_template('pages/settings.html', settings=settings, user_id=user_id, is_admin=is_admin, tag_list=tag_list, common_colors=common_colors, all_colors=all_colors, form_fields=[])

@settings.route('/edit_tag/<int:id>', methods=['POST'])
def edit_tag(id):
    tag = Tag.query.filter_by(id=id).first()
    form_fields = {}
    form_fields['color'] = tag.color
    form_fields['text'] = tag.text_color
    form_fields['name'] = tag.name
    form_fields['id'] = tag.id
    form_fields['admin_only'] = tag.admin_only
    return render_template('includes/settings_tags.html', form_fields=form_fields)

@settings.route('/add_tag', methods=['GET', 'POST'])
def add_tag():
    form_fields = {}
    form_fields['color'] = "None"
    form_fields['name'] = 'Name'
    return render_template('includes/settings_tags.html', form_fields=form_fields)

@settings.route('/add_tag/color/<color>/<text>/<name>', methods=['POST'])
def add_tag_color(color, text, name):
    form_fields = {}
    form_fields['color'] = color
    form_fields['text'] = text
    form_fields['name'] = name
    return render_template('includes/settings_tags.html', form_fields=form_fields)

@settings.route('/show_common_colors', methods=['POST'])
def show_common_colors():
    name = request.form.get('name')
    from ..helpers.color_picker import color_picker_list
    colors = color_picker_list("common")
    return render_template('includes/color_picker.html', colors=colors, name=name)

@settings.route('/show_all_colors/<name>')
def show_all_colors(name):
    from ..helpers.color_picker import color_picker_list
    all_colors = color_picker_list("all")
    return render_template('includes/color_picker_more.html', all_colors=all_colors, name=name)

@settings.route('/get_settings')
def get_settings(setting=''):
    set_default_settings()
    sets = {}
    db_settings = Setting.query
    for s in db_settings:
        if setting != '' and setting == s.name:
            return s.value
        else:
            sets[s.name] = s.value
    return sets

@settings.route('/set_default_settings')
def set_default_settings():
    for k, v in default_settings.items():
        db_settings = Setting.query.filter_by(name=k).first()
        if not db_settings:
            new_setting = Setting(name=k, value=v)
            db.session.add(new_setting)
            db.session.commit()

@settings.route('/clear_settings')
def clear_settings():
    settings = Setting.query.delete()
    db.session.commit()
    return settings