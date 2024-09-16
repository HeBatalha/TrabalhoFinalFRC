// Funções de interação com Firestore:

import { createPeerConnection, addLocalTracks } from './webrtc.js';

export async function createRoom(db, localStream) {
  const roomRef = await db.collection('rooms').doc();
  const peerConnection = createPeerConnection();

  addLocalTracks(localStream);
  
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await roomRef.set({ 'offer': { type: offer.type, sdp: offer.sdp } });
  return roomRef;
}

export async function joinRoomById(db, roomId, localStream) {
  const roomRef = db.collection('rooms').doc(roomId);
  const roomSnapshot = await roomRef.get();

  if (roomSnapshot.exists) {
    const peerConnection = createPeerConnection();
    addLocalTracks(localStream);

    const offer = roomSnapshot.data().offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await roomRef.update({ answer: { type: answer.type, sdp: answer.sdp } });
  }
}
