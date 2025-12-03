<img src="frontend/public/PantiViewer.svg" width="100px">

# PantiViewer -- (Python API Network Thumbnail Image Viewer)
## WARNING

This project is currently in the early stages of development and may be restructured at any time. Features and functionality can and will change at any time. Please do not expect stable or complete features at this time.

## What is PantiViewer?

### PantiViewer is a lightweight, fast, image viewer.
The clean and minimalistic grid of thumbnails allows quick viewing of a large collection of images.

A searchbar at the top of the app allows conditional searching of your images including keywords in the metadata, folder names, and tags.

The tagging system allows creation of tags that can be added to images, folders, and filters to provide organization of your images.

Filters combine keyword search strings and tags to quickly filter certain images in or out of your thumbnail grid. An "Explicit Content" filter comes pre-installed, this filter by default hides all NSFW contnent from the default view. Clicking on the filter will show this content alongside the rest of the content. Clicking a second time will put the view into 'show only' mode, showing only the NSFW content. This filter can be fully edited or removed and you can make as many of your own filters as you want. You can also create 'negative' tags, allowing a simple way to mark files that get filtered by accident (false positives).

Filewatcher keeps track of the folders in your catalog and automatically adds new files as they are placed into the folders, making them instantly available in the image grid. This function will also remove images from the grid if they are deleted or otherwise become inaccesible.

User authentication and permission system. Currently there are 3 levels of user access: Admin, User and Guest. An Admin can mark folders, tags and filters as 'Admin Only' making any images with those tags or in those folders invisible to anyone else.


## Install Instructions

    git clone https://github.com/CaptainVarghoss/PantiViewer

    
### Run setup script

### Run startup script



## All systems

### Edit the generated config.json

    After setup you might want to check the config file.
    The SECRET_KEY will be generated from random characters during setup but you can change this if you want. This is the salt used for encrypting users passwords. Do not share this.

    You can change HOST to 0.0.0.0 to listen on all interfaces **WARNING** This may allow access from outside your local network.

    The applications PORT can also be changed in this file.

### Open "localhost:5480" in your browser

You will be asked to login, an admin user is created by default.

    Username: admin
    Password: adminpass

You will want to change the password in the settings immediately for security. You can also create a new user, give it admin priviledges, then delete the original if you want a different username.

After logging in, go to settings and add a folder (or multiple) to the catalog and they will be automatically index and show all images in the grid. Sub-folders and their contents will automatically be scanned and added.

Be aware that large folders will take a long time to scan the first time through. Loading after the initial scan will be much faster.
