# Practical All-around Nifty Thumbnail Interface

## WARNING

This is currently in the first stages of development and may be restructured at any time. Features and functionality can and will change at any time. Please do not expect stable or complete features at this time.

This is a simple image viewing app written in Python to facilitate easy naviagation of all images in a folder and subfolders.

## Install Instructions

## Arch

### 1. Install git, python, npm

    sudo pacman -S git python npm

### 2. Clone Repository

    git clone https://github.com/CaptainVarghoss/PANTI

    cd PANTI/backend

### 3. Create and activate python venv

    python -m venv .venv
    source .venv/bin/activate

### 4. Install requirements

    pip install --upgrade pip
    pip install -r requirements.txt
    


## Debian/Ubuntu

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

### 4. Run the run.sh script from a bash terminal

    ./run.sh

## Windows

### 1. Install Python and git

Get python here: <https://www.python.org/downloads/windows/>
During installation choose custom install and make sure 'Add Python to environment variables' is checked.

Get git here: <https://git-scm.com/downloads/win>

### 2. Create a folder and install with git

Create a folder.
Open a command prompt and change to the folder you created.
Run the git clone command

    git clone https://github.com/CaptainVarghoss/PANTI

Once the download is complete, change to the newly created folder

    cd PANTI

If you want it to install into a different folder use

    git clone https://github.com/CaptainVarghoss/PANTI MyFolderName

    cd MyFolderName

### 3. Run install.bat

### 4. Run start.bat



## All systems

### 5. Optional, but recommended. Stop the program (ctrl+c) and edit the generated config.json

    Change the SECRET_KEY to a string of random characters. This is the salt used for encrypting users passwords. Do not share this.

    You can change HOST to 0.0.0.0 to listen on all interfaces **WARNING** This may allow access from outside your local network.

    The applications PORT can also be changed in this file.

### Open "localhost:5080" in your browser

You will be asked to login, click the 'Signup' link and create a new user. The first user created on a fresh install will be the admin.

After creating an account and logging in, go to settings and add a base path (or multiple) with images in it to have those images shown in the program. Sub-folders and their contents will automatically be scanned and added.
