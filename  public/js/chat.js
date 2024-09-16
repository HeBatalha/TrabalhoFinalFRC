//  Lógica para chat


export let chatRef = null;

export function setupChat(roomId, db) {
  chatRef = db.collection('rooms').doc(roomId).collection('messages');
}

export async function sendMessage(messageText, username) {
  if (messageText) {
    await chatRef.add({
      username,
      text: messageText,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
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
      const date = message.timestamp.toDate().toLocaleTimeString();
      messageElement.textContent = `(${date}) ${message.username}: ${message.text}`;
      messagesContainer.appendChild(messageElement);
    });
  });
}
