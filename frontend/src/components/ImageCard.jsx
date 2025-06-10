function ImageCard({image}) {

    return (
        <div className="image-card">
            <img src={image.thumbnail} />
            <div className="image-overlay">

            </div>
        </div>
    )
}

export default ImageCard