from app import create_app
#from app import socketIO

#############################################################
#############################################################
#import logging

# Get the logger for the 'werkzeug' component (which handles the HTTP server)
#log = logging.getLogger('werkzeug')
#log = logging.getLogger('werkzeug').setLevel(logging.WARNING)

##############################################################################
##########################################################################3


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5080, debug=True)
    #socketio.run(app, host='0.0.0.0', port=5080, debug=False)