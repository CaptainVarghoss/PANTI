import os, json
from app import create_app

#############################################################
#############################################################
import logging

# Get the logger for the 'werkzeug' component (which handles the HTTP server)
log = logging.getLogger('werkzeug')
log.setLevel(logging.WARNING)

##############################################################################
##########################################################################3

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        from app.classes.bulk_functions import startup_scan
        startup_scan()
    app.run(host=app.config['HOST'], port=app.config['PORT'], debug=app.config['DEBUG_MODE'])