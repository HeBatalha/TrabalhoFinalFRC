import { chatRef } from './firestore.js';

export async function sendMessage(message, username) {
  if (message) {
    await chatRef.add({
      username,
      text: message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

export function listenForMessages() {
  chatRef.orderBy('timestamp').onSnapshot(snapshot => {
    const messagesContainer = document.querySelector('#messages');
    messagesContainer.innerHTML = '';
    snapshot.forEach(doc => {
      const message = doc.data();
      const messageElement = document.createElement('div');
      messageElement.textContent = `${message.username}: ${message.text}`;
      messagesContainer.appendChild(messageElement);
    });
  });
}
