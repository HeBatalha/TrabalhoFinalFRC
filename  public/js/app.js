import { openUserMedia, toggleTrack } from './media.js';
import { createPeerConnection } from './webrtc.js';
import { sendMessage, listenForMessages } from './chat.js';
import { createRoomInFirestore, joinRoomById } from './firestore.js';

document.querySelector('#createBtn').addEventListener('click', async () => {
  await openUserMedia();
  createPeerConnection();
  const db = firebase.firestore();
  const roomId = await createRoomInFirestore(db, peerConnection.localDescription);
  console.log('Room created with ID:', roomId);
});

document.querySelector('#sendMessageBtn').addEventListener('click', async () => {
  const message = document.querySelector('#messageInput').value;
  await sendMessage(message, 'username');
});

listenForMessages();
