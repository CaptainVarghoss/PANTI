from flask import Flask
from flask_login import LoginManager
import os, json
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event

db = SQLAlchemy()

PORT = '5080'
HOST = '127.0.0.1'
CONFIG_FILE = 'config.json'
DEFAULT_CONFIG = {
    'DEBUG_MODE': False,
    'SQLALCHEMY_DATABASE_URI': 'sqlite:///database.db',
    'SECRET_KEY': 'your_secret_key_here', # Replace with a strong, random key
    'HOST': HOST,
    'PORT': PORT,
    'SERVER_NAME': f'{HOST}:{PORT}'
}

def load_config(app):
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                config_data = json.load(f)
                app.config.update(config_data)
                print(f"Loaded configuration from {CONFIG_FILE}")
        except json.JSONDecodeError:
            print(f"Error decoding JSON in {CONFIG_FILE}. Using default configuration.")
            create_default_config()
            app.config.update(DEFAULT_CONFIG)
    else:
        print(f"{CONFIG_FILE} not found. Creating default configuration.")
        create_default_config()
        app.config.update(DEFAULT_CONFIG)

def create_default_config():
    with open(CONFIG_FILE, 'w') as f:
        json.dump(DEFAULT_CONFIG, f, indent=4)
    print(f"Created default configuration file: {CONFIG_FILE}")


def create_app():
    app = Flask(__name__)
    load_config(app)
    print('Creating app instance')
    # Initialize Database
    db.init_app(app)
    print("Checking for database..")
    if not os.path.exists('instance/database.db'):
        print('   Database not found, creating..')
    else:
        print('   Loaded existing database.')
    from app.models import User, ImagePath, register_initial_data_listener
    with app.app_context():
        db.create_all()
        register_initial_data_listener(app)

    from app.views import views
    from app.routes.auth import auth
    from app.routes.image_routes import image_routes
    from app.routes.settings import settings

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')
    app.register_blueprint(image_routes, url_prefix="/")
    app.register_blueprint(settings, url_prefix="/settings")

    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        return User.query.get(int(id))

    with app.app_context():
        #from .image_handler import scan_files
        #scan_files()

        from app.classes.watcher import FileWatcher
        base_paths = ImagePath.query.filter_by(basepath=True).all()
        for bp in base_paths:
            file_watcher = FileWatcher()
            file_watcher.watch(bp.path)

    return app
