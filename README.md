<center><svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="160.000000pt" height="160.000000pt" viewBox="0 0 1024.000000 1024.000000"
 preserveAspectRatio="xMidYMid meet">
<g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)"
fill="#000000" stroke="none">
<path fill="magenta" opacity="0.5" d="M6159 7380 c-333 -31 -634 -196 -876 -479 l-63 -74 0 -219 0 -218
103 0 c328 0 844 74 1284 185 315 79 717 218 730 252 14 36 -160 226 -295 323
-149 106 -327 183 -495 215 -97 18 -282 25 -388 15z"/>
<path fill="cyan" opacity="0.5" d="M3725 7365 c-331 -60 -618 -238 -818 -507 -15 -20 -27 -39 -27 -42 0
-9 302 -123 435 -165 456 -142 998 -233 1543 -257 l152 -7 0 215 0 216 -47 63
c-179 245 -482 430 -790 484 -104 18 -349 18 -448 0z"/>
<path fill="magenta" d="M7335 6578 c-152 -68 -491 -184 -652 -223 -76 -18 -83 -24 -58 -45
25 -21 84 -125 106 -187 26 -75 36 -230 20 -315 -54 -278 -316 -468 -646 -468
l-85 0 0 -290 0 -290 138 0 137 0 75 60 c300 241 629 397 996 474 l109 22 18
55 c107 317 129 667 61 972 -25 112 -92 277 -112 276 -9 0 -57 -18 -107 -41z"/>
<path fill="cyan" d="M2750 6566 c-98 -230 -135 -558 -94 -834 18 -121 66 -315 93 -377 18
-41 19 -41 92 -54 275 -49 617 -190 859 -353 256 -173 520 -449 661 -690 106
-182 188 -388 229 -576 18 -81 39 -274 40 -355 0 -27 10 -33 163 -107 89 -44
173 -81 187 -82 l25 -3 0 1505 0 1505 -145 7 c-197 10 -476 35 -645 59 -430
61 -972 205 -1315 350 -63 27 -119 49 -123 49 -4 0 -16 -20 -27 -44z"/>
<path fill="magenta" d="M5780 6189 c-132 -16 -430 -39 -494 -39 l-66 0 0 -1516 0 -1515 23 7
c37 11 279 128 323 156 l41 26 6 119 c10 219 77 464 187 684 l60 119 0 979 c0
539 -3 981 -7 984 -5 2 -37 0 -73 -4z"/>
<path fill="cyan" opacity="0.5" d="M2860 5064 c0 -15 105 -202 186 -331 268 -428 682 -846 1173 -1187
76 -53 145 -98 154 -102 22 -8 22 19 2 141 -104 645 -671 1238 -1378 1444 -59
17 -113 34 -122 37 -8 4 -15 3 -15 -2z"/>
<path fill="magenta" opacity="0.5" d="M7225 5031 c-359 -111 -608 -262 -881 -535 -117 -117 -168 -177 -227
-266 -83 -126 -159 -277 -206 -412 -36 -105 -73 -291 -69 -348 l3 -41 100 68
c431 294 752 584 1029 930 133 165 282 396 370 571 43 86 48 85 -119 33z"/>
</g>
</svg></center>

# PantiViewer -- (Python API Network Thumbnail Image Viewer)
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
