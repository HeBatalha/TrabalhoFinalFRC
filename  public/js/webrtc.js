export const configuration = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };
  
  export let peerConnection = null;
  
  export function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
  }
  
  export function registerPeerConnectionListeners() {
    peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });
    peerConnection.addEventListener('connectionstatechange', () => {
      console.log(`Connection state change: ${peerConnection.connectionState}`);
    });
    peerConnection.addEventListener('signalingstatechange', () => {
      console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });
    peerConnection.addEventListener('iceconnectionstatechange', () => {
      console.log(`ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
  }
  