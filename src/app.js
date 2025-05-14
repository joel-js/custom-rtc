const cameraId = import.meta.env.VITE_CAMERA_ID;
const ticket = import.meta.env.VITE_TICKET;
const serverPort = import.meta.env.VITE_SERVER_PORT;

const url = (cameraId, ticket) =>
  `wss://${serverPort}/rest/v3/devices/${cameraId}/webrtc?_ticket=${ticket}`;

const iceServers = [
  { urls: "stun:stun.stunprotocol.org:3478" },
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];


const processSignaling = async (msg, peerConnection, signalWS) => {
  if (msg.sdp?.type === "offer") {
    console.log("Received SDP Offer");

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(msg.sdp)
    );
    console.log("Remote description set");

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log("Local description (answer) set");

    signalWS.send(JSON.stringify({ sdp: peerConnection.localDescription }));
    console.log("Sent SDP Answer back");
  } else if (msg?.ice) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(msg.ice));
      console.log("✅ Added remote ICE candidate:", msg.ice);
    } catch (err) {
      console.warn("⚠️ Failed to add ICE candidate:", err);
    }
  } else {
    console.warn("Unknown signaling message:", msg);
  }
};

const handlePeerConnections = (peerConnection, signalWS) => {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending my ICE candidate:", event.candidate);

      signalWS.send(
        JSON.stringify({
          ice: event.candidate,
        })
      );
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE Connection state:", peerConnection.iceConnectionState);
  };
  peerConnection.onicegatheringstatechange = () => {
    console.log("ICE Gathering state:", peerConnection.iceGatheringState);
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("Connection state:", peerConnection.connectionState);

    if (peerConnection.connectionState === "connected") {
      console.log("🎉 WebRTC connection established successfully!");
    }
  };
};

const initPeerConnection = (iceServers) => {
  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("New ICE candidate:", event.candidate);
      // send candidate if trickle ICE is used
    }
  };

  pc.ontrack = (event) => {
    console.log("Remote track received:", event.streams[0]);
  };

  pc.onconnectionstatechange = () => {
    console.log("Connection state:", pc.connectionState);
  };

  pc.ontrack = (event) => {
    console.log("Remote track received:", event.streams[0]);
    const videoElem = document.getElementById("remoteVideo");
    if (videoElem) {
      videoElem.srcObject = event.streams[0];
    }
  };

  return pc;
};

const initSocket = (cameraId, ticket) => {
  const signalWS = new WebSocket(url(cameraId, ticket));

  signalWS.onopen = () => {
    console.log("WebSocket connected successfully");
  };

  signalWS.onerror = (error) => {
    console.error("WebSocket connection error:", error);
  };

  signalWS.onclose = (event) => {
    console.warn("WebSocket closed:", event);
  };
  return signalWS;
};

const main = () => {
  const peerConnection = initPeerConnection(iceServers);
  const signalWS = initSocket(cameraId, ticket);

  handlePeerConnections(peerConnection, signalWS);

  signalWS.onmessage = async (message) => {
    console.log("onMessage: ", message);
    const msg = JSON.parse(message.data);
    processSignaling(msg, peerConnection, signalWS);
  };
};

window.main = main;