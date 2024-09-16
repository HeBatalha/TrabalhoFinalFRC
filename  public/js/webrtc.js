// Lógica do WebRTC (conexões peer-to-peer)

import { configuration } from './config.js';
import { addPeerTrackListener, registerPeerConnectionListeners } from './media.js';

export let peerConnection = null;
export let localStream = null;
export let remoteStream = new MediaStream();

export function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);
  registerPeerConnectionListeners(peerConnection);
  addPeerTrackListener(peerConnection, remoteStream);
}

export async function addLocalTracks(stream) {
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
}

export function closePeerConnection() {
  if (peerConnection) peerConnection.close();
}
