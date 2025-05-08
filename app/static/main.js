const fullsizeModal = document.getElementById('fullsizeModal')
if (fullsizeModal) {
    fullsizeModal.addEventListener('show.bs.modal', event => {
    // Button that triggered the modal
    const button = event.relatedTarget
    // Extract info from data-bs-* attributes
    const image_info = button.getAttribute('data-bs-modalmeta')
    const image = button.getAttribute('data-bs-modalimage')

    // If necessary, you could initiate an Ajax request here
    // and then do the updating in a callback.


    // Update the modal's content.
    const modalBody = fullsizeModal.querySelector('.modal-image')
    //const modalText = fullsizeModal.querySelector('.card-text')

    modalBody.src = image
    //modalText.innerHTML = '<iframe src="' + image_info + '" />'
    // fullsizeModal.handleUpdate()
  })
}

// viewport size stuff
//document.documentElement.clientHeight;
//document.documentElement.clientWidth;
//to get sizes excluding scrollbars, or

//window.innerHeight;
//window.innerWidth;
//to get sizes WITH scrollbars



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

//window.onload = checkWidth;
//window.onresize = checkWidth;