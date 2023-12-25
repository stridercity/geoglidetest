
    mapboxgl.accessToken = 'pk.eyJ1IjoiYmFyZWJlYWNoMSIsImEiOiJjbHBrOGZyOTYwN2sxMmptcmxscHJmZTd2In0.sHV9n3l-dmiouWxxLcZmdw';






      

       
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-96, 37.8],
        zoom: 3,
        pitch: 40
    });

    const distanceTag = document.getElementById('distanceTag');

    if (!distanceTag) {
        console.error('Distance tag element not found in the HTML.');
    }

    const images = ['plane', 'boat', 'car'];

    function toggleDistanceVisibility() {
        const distanceContainer = document.getElementById('distance-container'); // Corrected ID
        distanceContainer.style.display = document.getElementById('distanceCheckbox').checked ? 'block' : 'none';
    }

    function updateDistanceTagPosition(coordinates) {
        const distanceContainer = document.getElementById('distance-container');
        if (distanceContainer) {
            const pointPixels = map.project(coordinates);
            distanceContainer.style.left = pointPixels.x + 'px';
            distanceContainer.style.top = pointPixels.y + 'px';
        } else {
            console.error('Distance container element not found in the HTML.');
        }
    }

    function addImageToMap(imageName) {
        map.loadImage(`/images/${imageName}.png`, (error, img) => {
            if (error) throw error;
            map.addImage(imageName, img);
        });
    }

    images.forEach(image => {
        addImageToMap(image);
    });

    let origin;
    let destination;

    const point = {
        'type': 'FeatureCollection',
        'features': [{
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'Point',
                'coordinates': [0, 0]
            }
        }]
    };

    const route = {
        'type': 'FeatureCollection',
        'features': [{
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': []
            },
            'properties': {
                'style': 'default' // default style
            }
        }]
    };

    const steps = 200;
    const arc = Array.from({ length: steps }, () => [0, 0]);

    route.features[0].geometry.coordinates = arc;

    let counter = 0;
    let running = false;
   
    let isRecording = false;
    let animationStarted = false;

    function lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

  function animate() {
    if (!animationStarted) {
        setTimeout(() => {
            animationStarted = true;
            animate();
        }, 1000);
        return;
    }

    running = true;

    const start = route.features[0].geometry.coordinates[counter >= steps ? counter - 1 : counter];
    const end = route.features[0].geometry.coordinates[counter >= steps ? counter : counter + 1];

    if (!start || !end) {
        running = false;
        resetAnimation();
        return;
    }

    const lerpedCoordinates = [
        lerp(start[0], end[0], 0.1),
        lerp(start[1], end[1], 0.1)
    ];

    point.features[0].geometry.coordinates = lerpedCoordinates;
    point.features[0].properties.bearing = turf.bearing(turf.point(start), turf.point(end));

    const routeSource = map.getSource('route');
    const pointSource = map.getSource('point');

    if (routeSource && pointSource) {
        routeSource.setData(route);
        pointSource.setData(point);
    } else {
        console.error('Map sources not found.');
    }

    updateDistanceTagPosition(lerpedCoordinates);

    map.panTo(lerpedCoordinates);

    const animationSpeed = document.getElementById('animationSpeedSlider').value;
    const duration = 1000 / animationSpeed;

    if (counter < steps) {
        setTimeout(() => {
            requestAnimationFrame(animate);
        }, duration);
    } else {
        resetAnimation();
        document.getElementById('replay').disabled = false; // Enable 'replay' button
    }

    counter = counter + 1;
}
    function resetAnimation() {
        running = false;
        animationStarted = false;

        route.features[0].geometry.coordinates = [];
        point.features[0].geometry.coordinates = [0, 0];
        point.features[0].properties.bearing = 0;

        map.getSource('route').setData(route);
        map.getSource('point').setData(point);

        map.flyTo({
            center: [-96, 37.8],
            zoom: 3,
            pitch: 40,
            essential: true
        });

        document.getElementById('departure').disabled = false;
        document.getElementById('arrival').disabled = false;
        document.getElementById('vehicleDropdown').disabled = false;
        document.getElementById('submitBtn').disabled = false;
    }

let recorder;


	document.getElementById('record').addEventListener('click', () => {
    startRecording();
    document.getElementById('stopRecord').disabled = false; // Enable the "Stop Record" button
});

document.getElementById('stopRecord').addEventListener('click', () => {
    stopRecording();
    document.getElementById('stopRecord').disabled = true; // Disable the "Stop Record" button again
});
	
async function startRecording() {
    isRecording = true;

    const canvas = document.getElementById('animationCanvas');
    const stream = canvas.captureStream();

    recorder = RecordRTC(stream, {
        type: 'video',
        frameInterval: 1,
        mimeType: 'video/webm;codecs=vp9',
    });

    recorder.ondataavailable = async function (event) {
        const formData = new FormData();
        formData.append('video', event.data, 'animation.webm');

        try {
            const response = await fetch('https://geoglide.org/encode-video', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Video encoding failed');
            }

            const encodedVideoBlob = await response.blob();
            handleDownloadLink(encodedVideoBlob);
            await stopRecording(); // Wait for the recording to stop after encoding
        } catch (error) {
            console.error('Error during video encoding:', error);
            isRecording = false;
        }
    };

    recorder.startRecording();
}

async function stopRecording() {
    console.log('Stopping recording...');
    if (recorder) {
        return new Promise(resolve => {
            recorder.stopRecording(async () => {
                const blob = recorder.getBlob();
                const url = URL.createObjectURL(blob);

                // Assuming you have a download link with id 'downloadLink'
                const downloadLink = document.getElementById('downloadLink'); // Corrected ID
                downloadLink.href = url;
                downloadLink.download = 'animation.webm';
                downloadLink.style.display = 'block';

                // Enable/disable buttons accordingly
                document.getElementById('record').disabled = false;
                document.getElementById('stopRecord').disabled = false;

                isRecording = false;

                // Add fetch request to upload the recorded video
                await uploadRecordedVideo(blob);

                resolve(); // Resolve the Promise to indicate completion
            });
        });
    }
}

function uploadRecordedVideo(videoBlob) {
    const formData = new FormData();
    formData.append('video', videoBlob, 'animation.webm');

    fetch('https://geoglide.org/encode-video', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.blob())
    .then(encodedVideoBlob => {
        // Handle the response or further processing if needed
        console.log('Video encoding successful:', encodedVideoBlob);
    })
    .catch(error => {
        console.error('Error during video encoding:', error);
    });
}
    

function loadMap(style) {
    map.setStyle(style);

    map.on('style.load', function () {
        // Check if sources exist; if not, add the sources and layers
        if (!map.getSource('route')) {
            map.addSource('route', {
                'type': 'geojson',
                'data': route
            });

            map.addLayer({
                'id': 'route',
                'source': 'route',
                'type': 'line',
                'paint': {
                    'line-width': 2,
                    'line-color': ['case',
                        ['==', ['get', 'style'], 'default'], '#ff0000',
                        ['==', ['get', 'style'], 'blue'], '#0000ff',
                        ['==', ['get', 'style'], 'yellow'], '#ffff00',
                        '#ff0000'
                    ]
                }
            });

            map.addSource('point', {
                'type': 'geojson',
                'data': point
            });

            map.addLayer({
                'id': 'point',
                'source': 'point',
                'type': 'symbol',
                'layout': {
                    'icon-image': ['get', 'vehicle'],
                    'icon-size': 1.5,
                    'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-allow-overlap': true,
                }
            });

            // Add the images to the map for the new style
            images.forEach(image => {
                addImageToMap(image);
            });
        }

        // Update existing sources with new data
        map.getSource('route').setData(route);
        map.getSource('point').setData(point);
    });
}
    function geocode(city, callback) {
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${city}.json?access_token=${mapboxgl.accessToken}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Geocoding failed');
                }
                return response.json();
            })
            .then(data => {
                const features = data.features;
                if (features.length > 0) {
                    const [lng, lat] = features[0].center;
                    callback([lng, lat]);
                } else {
                    throw new Error('No coordinates found for the given location');
                }
            })
            .catch(error => {
                console.error('Geocoding error:', error);
            });
    }

    function getLandRoute(origin, destination) {
        const accessToken = 'pk.eyJ1IjoiYmFyZWJlYWNoMSIsImEiOiJjbHBrOGZyOTYwN2sxMmptcmxscHJmZTd2In0.sHV9n3l-dmiouWxxLcZmdw';
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?steps=true&geometries=geojson&access_token=${accessToken}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                const routeCoordinates = data.routes[0].geometry.coordinates;

                // Clear existing arc coordinates
                arc.length = 0;

                // Push new route coordinates to the arc
                for (const coordinate of routeCoordinates) {
                    arc.push(coordinate);
                }

                // Update the route feature
                route.features[0].geometry.coordinates = arc;

                // Update the map source
                if (map.getSource('route')) {
                    map.getSource('route').setData(route);
                } else {
                    console.error('Map source "route" not found.');
                }

                // Start the animation
                counter = 0;
                animationStarted = false;
                animate();
            })
            .catch(error => {
                console.error('Error fetching land route:', error);
            });
    }


function handleDownloadLink(blob) {
    const url = URL.createObjectURL(blob);
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = url;
    downloadLink.download = 'animation.webm';
    downloadLink.style.display = 'block';
}
	

   function animateRoute(selectedVehicle, selectedTravelMode) {
        map.flyTo({
            center: origin,
            zoom: 15,
            speed: 1.5,
            essential: true
        }, {
            duration: 5000
        });

        setTimeout(() => {
            map.flyTo({
                center: origin,
                zoom: 3,
                speed: 1.5,
                essential: true
            }, {
                duration: 5000
            });
        }, 2000);

        setTimeout(() => {
            map.flyTo({
                center: destination,
                zoom: 15,
                speed: 1.5,
                essential: true
            }, {
                duration: 5000
            });
        }, 4000);

        setTimeout(() => {
            map.flyTo({
                center: destination,
                zoom: 3,
                speed: 1.5,
                essential: true
            }, {
                duration: 5000
            });
        }, 6000);

        setTimeout(() => {
            const lineDistance = turf.distance(turf.point(origin), turf.point(destination));
            arc.length = 0;

            if (selectedTravelMode === 'land') {
                console.log('Fetching land route...');
                isLandRouteAvailable(origin, destination)
                    .then(isAvailable => {
                        if (!isAvailable) {
                            alert('Your route is crossing international waters. Please select air/water route.');
                            resetAnimation();
                            return;
                        }
                        getLandRoute(origin, destination);
                    })
                    .catch(error => {
                        console.error('Error checking land route availability:', error);
                        resetAnimation();
                    });
            } else {
                for (let i = 0; i < lineDistance; i += lineDistance / steps) {
                    const segment = turf.along(turf.lineString([origin, destination]), i);
                    arc.push(segment.geometry.coordinates);
                }
            }

            route.features[0].geometry.coordinates = arc;

            if (map.getSource('route')) {
                map.getSource('route').setData(route);
            } else {
                console.error('Map source "route" not found.');
            }

            counter = 0;
            animationStarted = false;

            map.panTo(arc[0]);

            point.features[0].properties.vehicle = selectedVehicle;

            if (map.getSource('point')) {
                map.getSource('point').setData(point);
            } else {
                console.error('Map source "point" not found.');
            }

            animate();
        }, 8000);
    }

    function isLandRouteAvailable(origin, destination) {
        const accessToken = 'pk.eyJ1IjoiYmFyZWJlYWNoMSIsImEiOiJjbHBrOGZyOTYwN2sxMmptcmxscHJmZTd2In0.sHV9n3l-dmiouWxxLcZmdw';
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?steps=true&access_token=${accessToken}`;

        return fetch(url)
            .then(response => response.json())
            .then(data => { return data.routes && data.routes.length > 0; })
            .catch(error => {
                console.error('Error checking land route availability:', error);
                return false;
            });
    }

    map.on('load', () => {
        map.addSource('route', {
            'type': 'geojson',
            'data': route
        });

        map.addSource('point', {
            'type': 'geojson',
            'data': point
        });

        map.addLayer({
            'id': 'route',
            'source': 'route',
            'type': 'line',
            'paint': {
                'line-width': 2,
                'line-dasharray': [2, 2],
                'line-color': [
                    'case',
                    ['==', ['get', 'style'], 'default'],
                    '#ff0000',
                    ['==', ['get', 'style'], 'blue'], // blue style
                    '#0000ff',
                    ['==', ['get', 'style'], 'yellow'], // yellow style
                    '#ffff00',
                    '#ff0000' // default color
                ]
            }
        });

        map.addLayer({
            'id': 'point',
            'source': 'point',
            'type': 'symbol',
            'layout': {
                'icon-image': ['get', 'vehicle'],
                'icon-size': 1.5,
                'icon-rotate': ['get', 'bearing'],
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
            }
        });
		
		
		
		
		
		

    // Your existing script for geocoding, animations, and other functionality

document.getElementById('clearAnimationBtn').addEventListener('click', () => {
    resetAnimation();
    document.getElementById('replay').disabled = false;
    document.getElementById('departure').disabled = false;
    document.getElementById('arrival').disabled = false;
    document.getElementById('vehicleDropdown').disabled = false;
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('distanceCheckbox').checked = false;
    toggleDistanceVisibility(); // Now the function is defined
    map.flyTo({
        center: [-96, 37.8],
        zoom: 3,
        pitch: 40,
        essential: true
    });
});

  
        document.getElementById('submitBtn').addEventListener('click', () => {
            const departureInput = document.getElementById('departure').value;
            const arrivalInput = document.getElementById('arrival').value;
            const selectedVehicle = document.getElementById('vehicleDropdown').value;
            const selectedStyle = document.getElementById('routeLineStyleDropdown').value;
            const selectedTravelMode = document.getElementById('travelModeDropdown').value;

            point.features[0].properties.vehicle = selectedVehicle;

            geocode(departureInput, originCoordinates => {
                geocode(arrivalInput, destinationCoordinates => {
                    origin = originCoordinates;
                    destination = destinationCoordinates;

                    point.features[0].geometry.coordinates = origin;

                    route.features[0].properties.style = selectedStyle;

                    resetAnimation(); // Reset animation before starting a new one
                    animateRoute(selectedVehicle, selectedTravelMode);

                    const lineDistance = turf.distance(turf.point(origin), turf.point(destination));
                    console.log('Distance:', lineDistance.toFixed(2), 'kilometers');
                    distanceTag.innerText = `Distance: ${lineDistance.toFixed(2)} kilometers`;
                });
            });
        });

    document.getElementById('record').addEventListener('click', () => {
        startRecording();
    });

document.getElementById('stopRecord').addEventListener('click', () => {
    stopRecording();
});

        document.getElementById('darkStyleBtn').addEventListener('click', () => {
            goToDarkPage();
        });
    });
