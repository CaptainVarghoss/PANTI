const socket = io();

const eventName = '';
socket.onAny((eventName, ...args) => {
  console.log(`Received event: ${eventName} -- Data: ${args}`);
});

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

// socket.on('file_created', function(data) {
//   console.log('File creation event.');
//   handleFileEvent(data, 'file_created');
// });

// socket.on('file_modified', function(data) {
//   console.log('File modification event');
//   handleFileEvent(data, 'file_modified');
// });

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

// socket.on('connected', function(data) {
//   console.log('Client Connected.');
// });

// socket.on('disconnected', function(data) {
//   console.log('Client Disconnected.');
// });



const fullsizeModal = document.getElementById('fullsizeModal');
if (fullsizeModal) {
    fullsizeModal.addEventListener('hide.bs.modal', event => {
      if (document.activeElement) {
        document.activeElement.blur();
      }
    });
    fullsizeModal.addEventListener('show.bs.modal', event => {
    // Button that triggered the modal
    const button = event.relatedTarget;
    // Extract info from data-bs-* attributes
    const image = button.getAttribute('data-bs-modalimage');
    const isVideo = button.getAttribute('data-bs-isvideo');
    var html = ''
    if (isVideo == 'True') {
      html = `<video class="modal-video" controls><source src="${image}"></video>`;
      console.log(html);
    }
    if (isVideo == 'False') {
      html = `<img class="modal-image" role="button" data-bs-dismiss="modal" data-bs-target="#fullsizeModal" src="${image}" />`;
    }

    // Update the modal's content.
    const modalBody = fullsizeModal.querySelector('.image-container-modal');
    modalBody.innerHTML = html;
  })
}

const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));