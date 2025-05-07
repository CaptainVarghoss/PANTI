from flask import Flask
from flask_login import LoginManager
from os import path
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config['DB_NAME'] = "database.db"
    app.config['SECRET_KEY'] = "aslkdfjhjaslkdja alskjdalskdj"
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + app.config['DB_NAME']
    app.config['SERVER_NAME'] = '10.0.42.30:5080'

    # Initialize Database
    from app.models import User, Image, Setting
    db.init_app(app)
    print("Checking for database..")
    if not path.exists('instance/' + app.config['DB_NAME']):
        print('   Database not found, creating..')
    else:
        print('   Loaded existing database.')
    with app.app_context():
        db.create_all()

    #### WARNING ####
    ## DO NOT USE THIS
    #from .models import dump_images
    #dump_images(app)

    from app.views import views
    from app.auth import auth
    from app.image_handler import image_handler

    from .settings import settings

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')
    app.register_blueprint(image_handler, url_prefix="/")
    app.register_blueprint(settings, url_prefix="/settings")

    with app.app_context():
        #from .image_handler import scan_files
        #scan_files()

        from .settings import get_setting
        base_path = get_setting('base_path')

        from app.watcher import FileWatcher
        file_watcher = FileWatcher()
        file_watcher.watch(base_path)

    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        return User.query.get(int(id))

    return app
