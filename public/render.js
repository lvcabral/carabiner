const video = document.querySelector("video");
const videoPlayer = document.getElementById("video-player");

function handleSetResolution(style) {
  videoPlayer.style.width = style.width;
  videoPlayer.style.height = style.height;
}

function handleSetBorderWidth(borderWidth) {
  videoPlayer.style.borderWidth = borderWidth;
}

function handleSetBorderStyle(borderStyle) {
  videoPlayer.style.borderStyle = borderStyle;
}

function handleSetBorderColor(borderColor) {
  videoPlayer.style.borderColor = borderColor;
}

function handleSetVideoStream(constraints) {
  renderDisplay(constraints);
}

function handleSetVideoFilter(data) {
  videoPlayer.style.filter = data.filter;
  videoPlayer.style["-webkit-filter"] = `-webkit-${data.filter}`;
}

const eventHandlers = {
  "set-resolution": handleSetResolution,
  "set-border-width": handleSetBorderWidth,
  "set-border-style": handleSetBorderStyle,
  "set-border-color": handleSetBorderColor,
  "set-video-stream": handleSetVideoStream,
  "set-video-filter": handleSetVideoFilter,
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
