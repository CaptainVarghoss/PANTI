#!/bin/bash

source venv/bin/activate

gunicorn -k gevent -c launch.py main:app