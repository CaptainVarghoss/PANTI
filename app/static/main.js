const fullsizeModal = document.getElementById('fullsizeModal')
if (fullsizeModal) {
    fullsizeModal.addEventListener('show.bs.modal', event => {
    // Button that triggered the modal
    const button = event.relatedTarget
    // Extract info from data-bs-* attributes
    const image = button.getAttribute('data-bs-modalimage')
    const isVideo = button.getAttribute('data-bs-isvideo')
    var html = ''
    console.log(isVideo)
    if (isVideo == 'True') {
      html = `<video class="modal-video" controls><source src="${image}"></video>`;
      console.log(html)
    }
    if (isVideo == 'False') {
      html = `<img class="modal-image" role="button" data-bs-dismiss="modal" data-bs-target="#fullsizeModal" src="${image}" />`;
    }

    // Update the modal's content.
    const modalBody = fullsizeModal.querySelector('.image-container-modal')
    //const modalText = fullsizeModal.querySelector('.card-text')

    modalBody.innerHTML = html
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
})

window.addEventListener('resize', () => {
  var imageModal = document.getElementById('fullsizeModal')
  imageModal.handleUpdate();
})

function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))