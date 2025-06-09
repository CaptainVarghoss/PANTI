from flask import Flask
from flask_login import LoginManager
import os, json
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from flask_socketio import SocketIO
from multiprocessing import Queue

# Initialize the multiprocessing Queue globally
socketio_queue_instance = Queue()

PORT = '5080'
HOST = '127.0.0.1'
CONFIG_FILE = 'config.json'
DEFAULT_CONFIG = {
    'DEBUG_MODE': False,
    'SQLALCHEMY_DATABASE_URI': 'sqlite:///database.db',
    'SECRET_KEY': 'your_secret_key_here', # Replace with a strong, random key
    'HOST': HOST,
    'PORT': PORT,
    'SERVER_NAME': f'{HOST}:{PORT}',
    'SQLALCHEMY_ENGINE_OPTIONS': {
        'pool_size': 10, # Number of connections to keep alive in the pool
        'max_overflow': 20, # Number of connections that can be created beyond pool_size
        'pool_recycle': 3600, # Recycle connections after 1 hour (common for preventing stale connections)
        'pool_pre_ping': True # Check if connection is alive before using it (good for flaky connections)
    }
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

db = SQLAlchemy()

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

    from app.models import User, register_initial_data_listener, register_sqlite_regexp_function
    with app.app_context():
        db.create_all()
        register_initial_data_listener(app)
        register_sqlite_regexp_function(app)

    # Register Blueprints
    from app.views import views
    from app.routes.auth import auth
    from app.routes.image_routes import image_routes
    from app.routes.settings import settings
    from app.routes.tag_routes import tag_routes

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')
    app.register_blueprint(image_routes, url_prefix="/")
    app.register_blueprint(settings, url_prefix="/settings")
    app.register_blueprint(tag_routes, url_prefix="/")

    # Setup Flask-Login
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        return User.query.get(int(id))

    return app
