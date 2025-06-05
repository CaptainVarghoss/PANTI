const socket = io();
const htmxTriggerElement = document.getElementById('imagesBlock');

function handleFileEvent(data, eventType) {
    console.log(`${eventType} message received:`, data);
    const imageId = data.image_id;

    if (imageId) {
        const newImageEvent = new CustomEvent('imageUpdateReady', {
            detail: {
                imageId: imageId,
                eventType: eventType // Pass the original event type if needed by HTMX for different swaps
            }
        });
        htmxTriggerElement.dispatchEvent(newImageEvent);
        console.log(`Dispatched imageUpdateReady custom event with imageId: ${imageId} for type: ${eventType}`);
    } else {
        console.warn(`No imageId received for ${eventType} event.`);
    }
}

socket.on('file_created', function(data) {
  console.log('File creation event.');
  handleFileEvent(data, 'file_created');
});

socket.on('file_modified', function(data) {
  console.log('File modification event');
  handleFileEvent(data, 'file_modified');
});

htmx.onLoad(function() {
  htmx.on(htmxTriggerElement, 'imageUpdateReady', function(evt) {
    const imageId = evt.detail.imageId;
    htmx.ajax('GET', `/get_thumbnail/${imageId}`, {
      target: '#imagesBlock',
      swap: 'afterbegin'
    });
    console.log(`HTMX requested ${imageId}`);
  });
});

socket.on('connected', function(data) {
  console.log('Client Connected.');
});

socket.on('disconnected', function(data) {
  console.log('Client Disconnected.');
});

const fullsizeModal = document.getElementById('fullsizeModal');
if (fullsizeModal) {
    fullsizeModal.addEventListener('show.bs.modal', event => {
    // Button that triggered the modal
    const button = event.relatedTarget;
    // Extract info from data-bs-* attributes
    const image = button.getAttribute('data-bs-modalimage');
    const isVideo = button.getAttribute('data-bs-isvideo');
    var html = ''
    // console.log(isVideo);
    if (isVideo == 'True') {
      html = `<video class="modal-video" controls><source src="${image}"></video>`;
      console.log(html);
    }
    if (isVideo == 'False') {
      html = `<img class="modal-image" role="button" data-bs-dismiss="modal" data-bs-target="#fullsizeModal" src="${image}" />`;
    }

    // Update the modal's content.
    const modalBody = fullsizeModal.querySelector('.image-container-modal');
    //const modalText = fullsizeModal.querySelector('.card-text')

    modalBody.innerHTML = html;
    //modalText.innerHTML = '<iframe src="' + image_info + '" />'
    // fullsizeModal.handleUpdate()
  })
}

function checkWidth() {
  const app_settings = JSON.parse(document.querySelector('#app_settings').textContent);
  //console.log(app_settings);
  const thumbnails_div = document.querySelector('.thumbnail');

  var thumb_space = window.innerWidth / 3.2;
  //console.log(thumb_space);
  var thumb_size = app_settings.thumb_size;

//  if (thumbnails_div.style.maxWidth != thumb_size + "px") {
    if (thumb_space <= thumb_size) {
      var all_thumbs = document.querySelectorAll('.thumbnail');
      for(var i=0; i<all_thumbs.length; i++){
        all_thumbs[i].style.maxWidth = thumb_space + "px";
      }
    }
//  }
}

// Update the value on resize (optional, but good for orientation changes)
window.addEventListener('orientationchange', () => {
  window.dispatchEvent(new Event('resize'));
});

window.addEventListener('resize', () => {
  var imageModal = document.getElementById('fullsizeModal');
  imageModal.handleUpdate();
});

function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));