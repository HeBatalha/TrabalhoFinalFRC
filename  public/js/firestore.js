import { peerConnection } from './webrtc.js';

export let chatRef = null;

export async function createRoomInFirestore(db, localDescription) {
  const roomRef = await db.collection('rooms').doc();
  await roomRef.set({ 'offer': localDescription });
  return roomRef.id;
}

export async function joinRoomById(db, roomId) {
  const roomRef = db.collection('rooms').doc(roomId);
  const roomSnapshot = await roomRef.get();
  return roomSnapshot.exists ? roomRef : null;
}

export async function addIceCandidateToFirestore(roomRef, candidate) {
  await roomRef.collection('calleeCandidates').add(candidate);
}
