from flask import Blueprint, render_template, request, session, flash
from flask_login import login_required, current_user
from app.models import Setting, db, User, Tag, ImagePath, UserSetting, Filter, UserFilter
from app.helpers.io_handler import get_path_list, db_scan

settings = Blueprint('settings', __name__)

@settings.route('/', methods=['GET', 'POST'])
@login_required
def show_settings():
    page = 'user'
    user = User.query.filter_by(id=session['_user_id']).first()
    user_id = user.id
    user_settings_button = request.form.get("user-settings-button", False)
    server_settings_button = request.form.get("server-settings-button", False)
    tags_button = request.form.get("tags_button", False)
    tags_delete = request.form.get("tags_delete", False)

    is_admin = user.admin
    settings = get_settings()
    user_settings = get_user_settings()
    if request.method == 'POST':
        if user_settings_button != False:
            page = 'user'
            user_settings['sidebar'] = request.form.get('sidebar')
            for k, v in user_settings.items():
                update_query = UserSetting.query.filter_by(user_id=current_user.id, name=k).first()
                if update_query:
                    update_query.name = k
                    update_query.value = v
                else:
                    add_query = UserSetting(user_id=current_user.id, name=k, value=v)
                    db.session.add(add_query)
                db.session.commit()

        elif server_settings_button != False:
            if is_admin:
                page = 'server'
                settings['sidebar'] = request.form.get('sidebar')
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

            # folder settings
            if is_admin:
                folders = get_path_list(ignore=True)
                for f in folders:
                    if request.form.get(f'{f.id}_admin_only') == None:
                        admin_only = False
                    else:
                        admin_only = True
                    if request.form.get(f'{f.id}_ignore') == None:
                        ignore = False
                    else:
                        ignore = True
                    if admin_only != f.admin_only or ignore != f.ignore:
                        # changes made, update database
                        update = ImagePath.query.filter_by(id=f.id).first()
                        update.admin_only = admin_only
                        update.ignore = ignore
                        db.session.commit()
                        # if ignore, initiate database scan to ensure nothing ignored remains in database
                        if ignore:
                            db_scan()

                filters = get_filters()
                for fl in filters:
                    if request.form.get(f'filter_{fl.id}_admin_only') == None:
                        admin_only = False
                    else:
                        admin_only = True
                    search_terms = request.form.get(f'filter_{fl.id}_search_terms')
                    if admin_only != fl.admin_only or search_terms != fl.search_terms:
                        fl.admin_only = admin_only
                        fl.search_terms = search_terms
                        db.session.commit()

        if tags_button != False:
            page = 'server'
            tag_name = request.form.get('name')
            tag_color = request.form.get('color')
            tag_text = request.form.get('text')
            if request.form.get('admin_only') == None:
                tag_admin = False
            else:
                tag_admin = True
            if request.form.get('id'):
                if request.form.get('id') in ['1','2','3','4']:
                    flash('This tag cannot be edited.', category='error')
                else:
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
            page = 'server'
            if request.form.get('id'):
                if request.form.get('id') in ['1','2','3','4']:
                    flash('This tag cannot be deleted.', category='error')
                else:
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

    filters = get_filters()
    user_filters = get_user_filters()
    folder_list = get_path_list(ignore=True)
    dir_list = get_path_list()
    from app.helpers.color_picker import color_picker_list
    common_colors = color_picker_list(type="common")
    all_colors = color_picker_list(type="all")

    return render_template('pages/settings.html', page=page, settings=settings, user_settings=user_settings, user_id=user_id, tag_list=tag_list, offscreen_tag_list=tag_list, folder_list=folder_list, dir_list=dir_list, filters=filters, user_filters=user_filters, common_colors=common_colors, all_colors=all_colors, form_fields=[])

@settings.route('/edit_tag/<int:id>', methods=['POST'])
@login_required
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
@login_required
def add_tag():
    form_fields = {}
    form_fields['color'] = "None"
    form_fields['name'] = 'Name'
    return render_template('includes/settings_tags.html', form_fields=form_fields)

@settings.route('/add_tag/color/<color>/<text>/<name>', methods=['POST'])
@login_required
def add_tag_color(color, text, name):
    form_fields = {}
    form_fields['color'] = color
    form_fields['text'] = text
    form_fields['name'] = name
    return render_template('includes/settings_tags.html', form_fields=form_fields)

@settings.route('/show_common_colors', methods=['POST'])
@login_required
def show_common_colors():
    name = request.form.get('name')
    from ..helpers.color_picker import color_picker_list
    colors = color_picker_list("common")
    return render_template('includes/color_picker.html', colors=colors, name=name)

@settings.route('/show_all_colors/<name>')
@login_required
def show_all_colors(name):
    from ..helpers.color_picker import color_picker_list
    all_colors = color_picker_list("all")
    return render_template('includes/color_picker_more.html', all_colors=all_colors, name=name)

# Folders

@settings.route('/add_folder', methods=['POST'])
@login_required
def add_base_folder():
    if current_user.admin:
        if request.method == 'POST':
            folder_name = request.form.get('new_folder')
            if folder_name != '' and folder_name != None:
                new_folder = ImagePath(path=folder_name, basepath=1)
                db.session.add(new_folder)
                db.session.commit()
                flash(f'Added folder: {folder_name}', category='success')
                from app.classes.bulk_functions import ScanFiles
                scanner_threaded = ScanFiles(path=folder_name)
                scanner_threaded.scan_folder_threaded()
    else:
        flash('Admin Only.', category='error')

    folder_list = get_path_list(ignore=True)
    return render_template('includes/folder_list.html', folder_list=folder_list)

@settings.route('/delete_folder/<id>', methods=['POST'])
@login_required
def del_base_folder(id):
    if current_user.admin:
        if request.method == 'POST':
            query_folder = ImagePath.query.filter_by(id=id).first()
            if query_folder:
                # check for child paths
                child_paths = ImagePath.query.filter_by(parent=query_folder.path)
                for child in child_paths:
                    remove_this = ImagePath.query.filter_by(id=child.id).first()
                    db.session.delete(remove_this)
                db.session.delete(query_folder)
                db.session.commit()
                flash(f'Removed folder: {query_folder.path}', category='success')

    folder_list = get_path_list(ignore=True)
    return render_template('includes/folder_list.html', folder_list=folder_list)

# Filters

@settings.route('/add_filter', methods=['POST'])
@login_required
def add_filter():
    if current_user.admin:
        if request.method == 'POST':
            filter_name = request.form.get('new_filter')
            if filter_name != '' and filter_name != None:
                new_filter = Filter(name=filter_name)
                db.session.add(new_filter)
                db.session.commit()
                flash(f'Added filter: {filter_name}', category='success')
    else:
        flash('Admin Only.', category='error')

    filters = get_filters()
    return render_template('includes/filter_list.html', filters=filters)

@settings.route('/delete_filter/<id>', methods=['POST'])
@login_required
def del_filter(id):
    if current_user.admin:
        if request.method == 'POST':
            query_filter = Filter.query.filter_by(id=id).first()
            if query_filter:
                db.session.delete(query_filter)
                db.session.commit()
                flash(f'Removed filter: {query_filter.name}', category='success')

    folder_list = get_path_list(ignore=True)
    return render_template('includes/folder_list.html', folder_list=folder_list)

# Settings

def get_settings(setting='', admin=1):
    sets = {}
    if admin == 1:
        db_settings = Setting.query.all()
    else:
        db_settings = Setting.query.filter_by(admin_only=0).all()
    for s in db_settings:
        if setting != '' and setting == s.name:
            return s.value
        else:
            sets[s.name] = s.value
    return sets

def get_user_settings(setting=''):
    settings = get_settings(setting, admin=0)
    if current_user.is_authenticated:
        sets = settings
        db_user_settings = UserSetting.query.filter_by(user_id=current_user.id)
        for s in db_user_settings:
            if setting != '' and setting == s.name:
                return s.value
            else:
                sets[s.name] = s.value
        return sets
    else:
        return settings

def get_filters():
    if current_user.admin:
        filters = Filter.query.all()
    else:
        filters = Filter.query.filter_by(admin_only=0)
    return filters


def get_user_filters():
    filters = get_filters()
    user_filters = {}
    for f in filters:
        user_filter = UserFilter.query.filter_by(user_id=current_user.id, filter_id=f.id).first()
        if user_filter:
            user_filters[f.id] = user_filter.enabled
        else:
            db.session.add(UserFilter(user_id=current_user.id, filter_id=f.id, enabled=False))
            db.session.commit()
            user_filters[f.id] = False

    return user_filters