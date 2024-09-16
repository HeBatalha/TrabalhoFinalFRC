// Manipulação de câmera e microfone

export async function openUserMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.querySelector('#localVideo').srcObject = stream;
    return stream;
  }
  
  export function addPeerTrackListener(peerConnection, remoteStream) {
    peerConnection.addEventListener('track', event => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    });
  }
  
  export function registerPeerConnectionListeners(peerConnection) {
    peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });
    peerConnection.addEventListener('connectionstatechange', () => {
      console.log(`Connection state change: ${peerConnection.connectionState}`);
    });
  }
  