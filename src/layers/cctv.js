import * as Cesium from 'cesium';

// We project a public domain or proxy video feed onto a building in NY
const CCTV_FEEDS = [
    {
        id: 'cctv-ny-1',
        // NASA public stream or any stable mp4 link that supports CORS
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        bounds: [-74.006, 40.7128, -74.005, 40.7138]
    }
];

export function initCctv(viewer) {
    const cctvDataSource = new Cesium.CustomDataSource('cctv');
    viewer.dataSources.add(cctvDataSource);

    CCTV_FEEDS.forEach(feed => {
        // Create an invisible video element
        const videoElement = document.createElement('video');
        videoElement.src = feed.url;
        videoElement.crossOrigin = 'anonymous';
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.autoplay = true;
        videoElement.style.display = 'none';
        document.body.appendChild(videoElement);

        // Play it
        videoElement.play().catch(e => console.log('Auto-play caught', e));

        // Project video texture onto a 3D rectangle hovering mid-air (simulating a holographic feed)
        cctvDataSource.entities.add({
            id: feed.id,
            name: 'Live CCTV Feed Intercept',
            rectangle: {
                coordinates: Cesium.Rectangle.fromDegrees(feed.bounds[0], feed.bounds[1], feed.bounds[2], feed.bounds[3]),
                height: 600, // Hovering above the buildings
                material: new Cesium.ImageMaterialProperty({
                    image: videoElement,
                    color: new Cesium.Color(1.0, 1.0, 1.0, 0.8) // slight transparency for holographic effect
                }),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString('#00ff88'),
                outlineWidth: 2
            },
            description: 'Tactical Intercept: Local security feed decrypted.'
        });
    });

    console.log('CCTV Layer projected.');
}
