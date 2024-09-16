// Arquivo principal que integra tudo

import { openUserMedia } from './media.js';
import { createRoom, joinRoomById } from './firestore.js';
import { sendMessage, listenForMessages } from './chat.js';

document.querySelector('#createBtn').addEventListener('click', async () => {
  const db = firebase.firestore();
  const localStream = await openUserMedia();
  const roomRef = await createRoom(db, localStream);
  listenForMessages();
});

document.querySelector('#joinBtn').addEventListener('click', async () => {
  const db = firebase.firestore();
  const roomId = document.querySelector('#room-id').value;
  const localStream = await openUserMedia();
  await joinRoomById(db, roomId, localStream);
  listenForMessages();
});

document.querySelector('#sendMessageBtn').addEventListener('click', async () => {
  const messageText = document.querySelector('#messageInput').value.trim();
  const username = document.querySelector('#usernameInput').value.trim() || 'Anônimo';
  await sendMessage(messageText, username);
});
