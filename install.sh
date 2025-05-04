#!/bin/bash

python3 -m venv venv
venv/bin/python -m pip install --upgrade pip
source venv/bin/activate
pip install -r requirements.txt