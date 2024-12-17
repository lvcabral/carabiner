const video = document.querySelector("video");
const videoPlayer = document.getElementById("video-player");
let currentColor =  "#662D91";

window.electronAPI.invoke("load-settings").then((settings) => {
  if (settings.control && settings.control.deviceId) {
    handleControlSelected(settings.control.deviceId);
  }
});

function handleSetResolution(style) {
  videoPlayer.style.width = style.width;
  videoPlayer.style.height = style.height;
}

function handleSetBorderWidth(borderWidth) {
  if (borderWidth === "0.1px") {
    videoPlayer.style.borderColor = "rgba(0, 0, 0, 0.1)";
  } else {
    videoPlayer.style.borderColor = currentColor;
  }
  videoPlayer.style.borderWidth = borderWidth;
}

function handleSetBorderStyle(borderStyle) {
  videoPlayer.style.borderStyle = borderStyle;
}

function handleSetBorderColor(borderColor) {
  currentColor = borderColor;
  videoPlayer.style.borderColor = borderColor;
}

function handleSetVideoStream(constraints) {
  renderDisplay(constraints);
}

function handleSetTransparency(data) {
  videoPlayer.style.filter = data.filter;
  videoPlayer.style["-webkit-filter"] = `-webkit-${data.filter}`;
}

const eventHandlers = {
  "set-resolution": handleSetResolution,
  "set-border-width": handleSetBorderWidth,
  "set-border-style": handleSetBorderStyle,
  "set-border-color": handleSetBorderColor,
  "set-video-stream": handleSetVideoStream,
  "set-transparency": handleSetTransparency,
  "set-control-selected": handleControlSelected,
};

function renderDisplay(constraints) {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
      video.play();
    })
    .catch((err) => {
      console.log(err.name + ": " + err.message);
    });
}

window.addEventListener("DOMContentLoaded", function () {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    const cams = devices.filter((device) => device.kind === "videoinput");
    if (cams?.length) {
      window.electronAPI.sendSync("shared-window-channel", {
        type: "set-webcams",
        payload: JSON.stringify(cams),
      });
      const videoSource = cams[0].deviceId;
      const constraints = {
        video: {
          deviceId: {
            exact: videoSource,
          },
          width: 1280,
          height: 720,
        },
      };
      renderDisplay(constraints);
    } else {
      console.log("No camera/capture card found");
    }
  });

  window.electronAPI.onMessageReceived(
    "shared-window-channel",
    (_, message) => {
      const handler = eventHandlers[message.type];
      if (handler) {
        handler(message.payload);
      }
    }
  );
});

// Remote Control
let controlIp = "";
let controlType = "ecp";

function handleControlSelected(data) {
  if (typeof data === "string" && data.includes("|")) {
    [controlIp, controlType] = data.split("|");
    console.log("Control Selected: ", controlIp, controlType);
  }
}

// Keyboard Events
document.addEventListener("keydown", keyDownHandler);
document.addEventListener("keyup", keyUpHandler);

// Keyboard Mapping
const keysMap = new Map();
keysMap.set("ArrowUp", "up");
keysMap.set("ArrowDown", "down");
keysMap.set("ArrowLeft", "left");
keysMap.set("ArrowRight", "right");
keysMap.set("Enter", "select");
keysMap.set("Escape", "back");
keysMap.set("Delete", "back");
keysMap.set("Home", "home");
keysMap.set("Shift+Escape", "home");
keysMap.set("Control+Escape", "home");
keysMap.set("Backspace", "instantreplay");
keysMap.set("End", "play");
if (process.platform === "darwin") {
    keysMap.set("Command+Backspace", "backspace");
    keysMap.set("Command+Enter", "play");
    keysMap.set("Command+ArrowLeft", "rev");
    keysMap.set("Command+ArrowRight", "fwd");
    keysMap.set("Command+Digit8", "info");
    keysMap.set("Control+KeyC", "break");
} else {
    keysMap.set("Control+Backspace", "backspace");
    keysMap.set("Control+Enter", "play");
    keysMap.set("Control+ArrowLeft", "rev");
    keysMap.set("Control+ArrowRight", "fwd");
    keysMap.set("Control+Digit8", "info");
    keysMap.set("Control+Pause", "break");
}
keysMap.set("PageDown", "rev");
keysMap.set("PageUp", "fwd");
keysMap.set("Insert", "info");
keysMap.set("Control+KeyA", "a");
keysMap.set("Control+KeyZ", "b");
keysMap.set("F10", "volumemute");

// Keyboard handlers
function keyDownHandler(event) {
  if (!event.repeat) {
      handleKeyboardEvent(event, 0);
  }
}
function keyUpHandler(event) {
  handleKeyboardEvent(event, 100);
}
function handleKeyboardEvent(event, mod) {
  let keyCode = event.code;
  if (event.shiftKey && !keyCode.startsWith("Shift")) {
      keyCode = "Shift+" + keyCode;
  } else if (event.ctrlKey && !keyCode.startsWith("Control")) {
      keyCode = "Control+" + keyCode;
  } else if (event.altKey && !keyCode.startsWith("Alt")) {
      keyCode = "Alt+" + keyCode;
  } else if (event.metaKey && !keyCode.startsWith("Meta")) {
      keyCode = "Meta+" + keyCode;
  }
  const key = keysMap.get(keyCode);
  if (key && key.toLowerCase() !== "ignore") {
      sendKey(key, mod);
  } else {
    sendKey(`lit_${encodeURIComponent(event.key)}`, mod);
  }
}

function sendKey(key, mod) {
    if (controlIp !== "" && controlType === "ecp") {
      sendEcpKey(controlIp, key, mod);
    }
}

function sendEcpKey(host, key, mod = -1) {
  if (!isValidIP(host)) {
      return;
  }
  let command = "keypress";
  if (mod !== -1) {
      command = mod === 0 ? "keydown" : "keyup";
  }
  const xhr = new XMLHttpRequest();
  const url = `http://${host}:8060/${command}/${key}`;
  console.log("Sending ECP Key: ", url);
  try {
      xhr.open("POST", url, false);
      xhr.send();
  } catch (e) {
      // ignore;
  }
}

//----------------------- Helper Functions -----------------------//


// Check if the IP address is valid
function isValidIP(ip) {
  if (ip && ip.length >= 7) {
      const ipFormat = /^(\d{1,3}\.){3}\d{1,3}$/;
      return ipFormat.test(ip);
  }
  return false;
}

