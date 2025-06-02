from flask import Blueprint, render_template, request, session, flash, redirect, url_for
from flask_login import login_required, current_user
from app.models import Setting, db, User, Tag, ImagePath, UserSetting, Filter, UserFilter
from app.helpers.io_handler import get_path_list, db_scan

settings = Blueprint('settings', __name__)

@settings.route('/', methods=['GET', 'POST'])
@login_required
def show_settings():
    if request.method == 'POST':

        # folder settings
        if current_user.admin:
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

    settings = get_settings()
    tag_list = get_tags()
    filters = get_filters()
    user_filters = get_user_filters()
    folder_list = get_path_list(ignore=True)
    dir_list = get_path_list()
    from app.helpers.color_picker import color_picker_list
    common_colors = color_picker_list(type="common")
    all_colors = color_picker_list(type="all")

    return

@settings.route('/filter_settings/<side>', methods=['POST'])
@login_required
def save_filter_settings(side):
    if request.method == 'POST':
        if side == 'Left' or side == 'Right':
            filters = get_filters()
            for fl in filters:
                admin_only = request.form.get(f'filter_{fl.id}_admin_only', False)
                header_display = request.form.get(f'filter_{fl.id}_header_display', False)
                search_terms = request.form.get(f'filter_{fl.id}_search_terms', '')
                fl.admin_only = admin_only
                fl.header_display = header_display
                fl.search_terms = search_terms
                db.session.commit()
        return

@settings.route('/server_settings/<side>', methods=['POST'])
@login_required
def save_server_settings(side):
    if request.method == 'POST':
        if side == 'Left' or side == 'Right':
            server_settings_button = request.form.get("server-settings-button", False)
            if server_settings_button != False:
                if current_user.admin:
                    settings = get_settings()
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

            return redirect(url_for('views.home'))

@settings.route('/user_settings/<side>', methods=['POST'])
@login_required
def save_user_settings(side):
    if request.method == 'POST':
        if side == 'Left' or side == 'Right':
            user_settings_button = request.form.get("user-settings-button", False)
            if user_settings_button != False:
                user_settings = get_user_settings()
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

            return redirect(url_for('views.home'))

@settings.route('/save_tags/<side>', methods=['POST'])
@login_required
def edit_tag(side):
    if side == 'Left' or side == 'Right':
        tags = get_tags()
        for t in tags:
            old_tag = Tag.query.filter_by(id=request.form.get(f'{t.id}_tag_id')).first()
            old_tag.name = request.form.get(f'{t.id}_tag_name')
            tag_color, tag_text = request.form.get(f'{t.id}_tag_color').split(':', 1)
            old_tag.color = tag_color
            old_tag.text_color = tag_text
            if request.form.get(f'{t.id}_tag_admin'):
                admin = True
            else:
                admin = False
            old_tag.admin_only = admin
            db.session.commit()

    tag_list = get_tags()
    return render_template('includes/menu/menu_tags.html', side=side, tag_list=tag_list)

@settings.route('/del_tag/<int:id>/<side>', methods=['POST'])
@login_required
def del_tag(id, side):
    perm = False
    if side == 'Left' or side == 'Right':
        if current_user.admin:
            perm = True

        if perm:
            tag = Tag.query.filter_by(id=id).first()
            db.session.delete(tag)
            db.session.commit()
            print(f'Tag deleted: {tag.name}')

    tag_list = get_tags()
    return render_template('includes/menu/menu_tags.html', side=side, tag_list=tag_list)

@settings.route('/add_tag/<side>')
@login_required
def add_tag(side):
    if side == 'Left' or side == 'Right':
        from app.helpers.color_picker import color_picker_list
        all_colors = color_picker_list("all")
        return render_template('includes/menu/menu_tags_add.html', side=side, all_colors=all_colors)

@settings.route('/add_tag/save/<side>', methods=['POST'])
@login_required
def add_tag_save(side):
    if request.method == 'POST':
        if side == 'Left' or side == 'Right':
            tag_name = request.form.get('name')
            print(type(request.form.get('color')))
            tag_color, tag_text = request.form.get('color').split(':', 1)
            if tag_color == 'None' or tag_text == 'None':
                return
            tag_admin = request.form.get('admin_only', False)
            add_tag = Tag(name=tag_name, color=tag_color, text_color=tag_text, admin_only=tag_admin)
            db.session.add(add_tag)
            db.session.commit()
            print(f'Tag added: {tag_name} -- User: {current_user.username}')
            tag_list = get_tags()
        return render_template('includes/menu/menu_tags.html', side=side, tag_list=tag_list)

@settings.route('/edit_tags/<side>')
@login_required
def edit_tags(side):
    if side == 'Left' or side == 'Right':
        tags = get_tags()
        from app.helpers.color_picker import color_picker_list
        all_colors = color_picker_list("all")
    return render_template('includes/menu/menu_tags_edit.html', tag_list=tags, side=side, all_colors=all_colors)

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

@settings.route('/add_filter/<side>', methods=['GET'])
@login_required
def add_filter(side):
    return render_template('includes/menu/menu_filters_add.html', side=side)

@settings.route('/add_filter/save/<side>', methods=['POST'])
@login_required
def add_filter_save(side):
    if current_user.admin:
        if request.method == 'POST':
            filter_name = request.form.get('new_filter')
            if filter_name != '' and filter_name != None:
                new_filter = Filter(name=filter_name)
                db.session.add(new_filter)
                db.session.commit()
                print(f'Added filter: {filter_name} -- User: {current_user.username}')

    filters = get_filters()
    user_filters = get_user_filters()
    return render_template('includes/menu/menu_filter_settings.html', filters=filters, side=side, user_filters=user_filters)

@settings.route('/del_filter/<id>/<side>', methods=['POST'])
@login_required
def del_filter(id, side):
    if current_user.admin:
        if request.method == 'POST':
            query_filter = Filter.query.filter_by(id=id).first()
            if query_filter:
                db.session.delete(query_filter)
                db.session.commit()
                print(f'Removed filter: {query_filter.name} -- User: {current_user.username}')

    filters = get_filters()
    user_filters = get_user_filters()
    return render_template('includes/menu/menu_filter_settings.html', filters=filters, user_filters=user_filters, side=side)

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

def get_tags():
    if current_user.admin:
        tags = Tag.query
    else:
        tags = Tag.query.filter_by(admin_only=0)
    return tags

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