var gamepadIndex = null;
var gamepad = null;

function gamepadconnected(e) {
  if(gamepadIndex == null) {
    gamepadIndex = e.gamepad.index;
    gamepad = e.gamepad;
    document.getElementById("gamepadState").innerHTML = "connected";
    console.log("Connect: %s", e.gamepad.id);
  }
}

function gamepaddisconnected(e) {
  if(gamepadIndex == e.gamepad.index) {
    gamepadIndex = null;
    gamepad = null;
    document.getElementById("gamepadState").innerHTML = "disconnected";
    console.log("Disconnect: %s", e.gamepad.id);
  }
}

var buttonDown = false;

function mainloop() {
  if (gamepadIndex != null) {
    updateGamepadState();
    
    if (buttonDown) {
      if (!isButtonPressed(gamepad, 0)) {
        buttonDown = false;
      }
    } else {
      if (isButtonPressed(gamepad, 0)) {
        buttonDown = true;
        
        var newCoords = getNewCoordinates(coords, pov.heading, 10);
        svService.getPanorama({location: newCoords, radius: 20}, processSVData);
      }
    }
    
    // Update heading wrt controller x-axis - ranges from -1 (left) to +1 (right)
    var xAxis = getAxisValue(gamepad, 0);
    pov.heading += xAxis;
    
    // Simple rotation of steering wheel based on controller input
    document.getElementById("wheel").style.transform = "rotate(" + (xAxis*90) + "deg)";
    
    // Simple map
    document.getElementById("map").style.transform = "rotate(" + (-pov.heading) + "deg)";
    
    // Update pitch wrt controller y-axis - ranges from -1 (up) to +1 (down)
    var yAxis = getAxisValue(gamepad, 1);
    pov.pitch -= yAxis; // Need to invert y-axis control
    // Clamp value to +/- 20 so you don't end up looking at your feet or the sky
    if (pov.pitch > 20) {
      pov.pitch = 20;
    }
    if (pov.pitch < -20) {
      pov.pitch = -20;
    }
    pov.pitch *= 0.95; // Automatically drift pitch back to level
    //console.log(pov.pitch);
    
    streetView.setPov(pov);
  }
  
  window.requestAnimationFrame(mainloop);
}

function getGamepads() {
  return navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
}

function isButtonPressed(gamepad, buttonId) {
  var button = gamepad.buttons[buttonId];
  //console.log("button[%d]: pressed: %s, value: %d", buttonId, button.pressed, button.value);
  return button.pressed;
}

function getAxisValue(gamepad, axisId) {
  return gamepad.axes[axisId];
}

function updateGamepadState() {
  var connectedGamepads = getGamepads();
  for (var i = 0; i < connectedGamepads.length; i++) {
    if (connectedGamepads[i] && connectedGamepads[i].index == gamepadIndex) {
      gamepad = connectedGamepads[i];
    }
  }
}

// Calculate new coordinates given current coordinates, a heading, and a distance
function getNewCoordinates(coords, heading, distance) {
  // Current coordinates
  var lat = coords.lat;
  var lng = coords.lng;
  
  // Calculate deviation in meters
  var dx = Math.sin(d2r(heading)) * distance;
  var dy = Math.cos(d2r(heading)) * distance;
  
  // Calculate deviation in degrees lat/long
  var dlng = dx / (111111.1 * Math.cos(d2r(lat)));
  var dlat = dy / 111111.1;
  
  // Calculate new lat/long
  lat += dlat;
  lng += dlng;
  
  // Return new coordinate
  return {lat: lat, lng: lng};
}

// Register event listeners
window.addEventListener("gamepadconnected", gamepadconnected);
window.addEventListener("gamepaddisconnected", gamepaddisconnected);

// Register main update loop
window.requestAnimationFrame(mainloop);

// References to important JS objects
var map;
var streetView;
var svService;
var marker;
// Default view direction
var pov = {heading: 225, pitch: 0};
// Start in Paris
var coords = {lat: 48.8592236, lng: 2.2972824};

function initMap() {
  // Map panel
  map = new google.maps.Map(document.getElementById('map'), {
    center: coords,
    zoom: 18, // Reasonable zoom level for our requirements
    streetViewControl: false // No pegman button
  });
  map.setOptions({
    disableDefaultUI: true,
    draggable: false,
    scrollwheel: false,
    keyboardShortcuts: false
  });
  
  // Show valid Street View locations in a blue overlay on the map
  var streetViewLayer = new google.maps.StreetViewCoverageLayer();
  streetViewLayer.setMap(map);
  
  // Street view panel
  streetView = new google.maps.StreetViewPanorama(document.getElementById("streetView"));
  streetView.setZoom(2);
  streetView.setOptions({
    disableDefaultUI: true, // Remove all controls: compass, zoom etc
    scrollwheel: false, // Disable zooming using the scroll wheel
    panControl: false
  });
  
  // Hook to communicate with the street view data provider service
  svService = new google.maps.StreetViewService();
  
  // Set the initial Street View camera to near the starting coordinates
  svService.getPanorama({location: coords, radius: 10}, processSVData);
}

function processSVData(data, status) {
  if (status === google.maps.StreetViewStatus.OK) {
    // Update street view with new location
    streetView.setPano(data.location.pano);
    streetView.setPov(pov);
    streetView.setVisible(true);
    
    var dot = {
      url: 'dot.png',
      size: new google.maps.Size(20, 20),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(10, 10)
    };
    
    // Create or update map marker
    if(marker == null) {
      marker = new google.maps.Marker({
        position: data.location.latLng,
        map: map,
        clickable: false,
        icon: dot
      });
    } else {
      marker.setPosition(data.location.latLng);
    }
    
    // Update minimap to show new location
    map.panTo(data.location.latLng);
    
    // Update current coordinates
    coords.lat = data.location.latLng.lat();
    coords.lng = data.location.latLng.lng();
  } else {
    console.error('Street View data not found for this location.');
  }
}

