from app import create_app
from flask import request
from flask_socketio import SocketIO, emit
import logging, json

from gevent import monkey
monkey.patch_all()

# Get the logger for the 'werkzeug' component (which handles the HTTP server)
log = logging.getLogger('werkzeug')
log.setLevel(logging.WARNING)

app = create_app()

# Initialize SocketIO

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

@socketio.on('connect')
def test_connect():
    socketio.emit('connected')
    print('Client connected:', request.sid)

@socketio.on('disconnect')
def test_disconnect():
    socketio.emit('disconnected')
    print('Client disconnected:', request.sid)

def send_to_clients(event_type='', data={}):
    if event_type == '':
        return
    socketio.emit(event_type, data)
    print(f'Socket Message Sent: {event_type} -- Data: {data}')
