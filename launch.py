from app import create_app
from app.classes.bulk_functions import startup_scan

def on_starting(server):
    app_instance = create_app()
    with app_instance.app_context():
        startup_scan(app_instance)


workers = 1
bind = "0.0.0.0:5080"