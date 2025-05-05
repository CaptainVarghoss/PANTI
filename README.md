# Practical All-around Nifty Thumbnail Interface

## WARNING

This is currently in the first stages of development and may be restructured at any time. Features and functionality can and will change at any time. Please do not expect stable or complete features at this time.

This is a simple image viewing app written in Python to facilitate easy naviagation of all images in a folder and subfolders.

## Install Instructions

### Debian/Ubuntu

### 1. Install git, python, python-venv, and python-pip

    sudo apt install git python3 python3-venv python3-pip

### 2. Use git to clone the code from the repository and into the default "PANTI" folder and change to the new directory

    git clone https://github.com/CaptainVarghoss/PANTI

    cd PANTI

Alternatively, use this git command if you want a different folder name

    git clone https://github.com/CaptainVarghoss/PANTI MyFolderName

    cd MyFolderName

### 3. Run install.sh from a bash terminal

    chmod +x ./install.sh
    ./install.sh

##

### Open "localhost:5080" in your browser

You will be asked to login, click the 'Signup' link and create a new user. The first user created on a fresh install will be the admin.

After creating an account and logging in, go to settings and change the base path to a folder with images in it to have those images shown in the program.
