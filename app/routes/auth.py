from flask import Blueprint, render_template, request, flash, redirect, url_for, current_app
from app.models import User
from werkzeug.security import generate_password_hash, check_password_hash
from app.models import db
from flask_login import login_user, logout_user, current_user
from markupsafe import Markup
from app.routes.settings import get_settings, get_user_settings

auth = Blueprint('auth', __name__)

@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = User.query.filter_by(username=username).first()
        if user:
            if check_password_hash(user.password, password):
                flash('Logged in successfully.', category='success')
                login_user(user, remember=True)
                return redirect(url_for('views.home'))
            else:
                flash('Password does not match.', category='error')
        else:
            flash(Markup('Username does not exist. <a href="signup">Sign Up</a>'), category='error')
    else:
        if current_user.is_authenticated:
            return redirect(url_for('views.home'))

    settings = get_settings()
    user_settings = get_user_settings()

    return render_template('pages/login.html', settings=settings, user_settings=user_settings)

@auth.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@auth.route('/signup', methods=['GET', 'POST'])
def sign_up():
    if request.method == 'POST':
        username = request.form.get('username')
        password1 = request.form.get('password1')
        password2 = request.form.get('password2')

# add check for if account creation is allowed. if not, only allow first (admin) user to be created.
# this check is only needed incase someone bypasses the signup page, where the form should be hidden completely completely
# add check for first user and make them admin

        user = User.query.filter_by(username=username).first()
        admin = False
        if user:
            flash('Username already in use.', category='error')
        elif len(username) < 4:
            flash('Username must have at least 4 characters.', category='error')
        elif password1 != password2:
            flash('Passwords do not match.', category='error')
        elif len(password1) < 4:
            flash('Password must have at least 4 characters.', category='error')
        else:
            # add to database
            # check for admin
            existing_admin = User.query.filter_by(id=1).first()
            admin = False
            if existing_admin:
                admin = False
            else:
                admin = True

            new_user = User(username=username, password=generate_password_hash(password1, method='scrypt', salt_length=16), admin=admin, login_allowed=True)
            db.session.add(new_user)
            db.session.commit()
            if admin == True:
                flash('Admin account created successfully.', category='success')
            else:
                flash('Account created succesfully', category='success')
            login_user(new_user, remember=True)
            return redirect(url_for('views.home'))

    settings = get_settings()
    user_settings = get_user_settings()

    return render_template("pages/signup.html", settings=settings, user_settings=user_settings)