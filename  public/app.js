mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

// DEfault configuration - Change these if you have a different STUN or TURN server.
const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;
let isCameraOn = true;
let isMicOn = true;


function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
  document.querySelector('#sendMessageBtn').addEventListener('click', sendMessage); // Event listener das mensagens
  document.querySelector('#toggleCamBtn').addEventListener('click', toggleCam);
  document.querySelector('#toggleMicBtn').addEventListener('click', toggleMic);

  // Inicializa chat em salas já criadas
  if (roomId) {
    const db = firebase.firestore();
    chatRef = db.collection('rooms').doc(roomId).collection('messages');
    listenForMessages();
  }
}

async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  const db = firebase.firestore();

  const roomRef = await db.collection('rooms').doc(); // ADD

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  // Add code for creating a room here
  
  // Code for creating room above
  
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Code for creating a room below
  
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log('Created offer:', offer);

  const roomWithOffer = {
    'offer': {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  await roomRef.set(roomWithOffer);
  roomId = roomRef.id;
  console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
  document.querySelector(
      '#currentRoom').innerText = `O ID da sala atual é: ${roomRef.id} - You are the caller!`;

  // Code for creating a room above
  
  // Code for collecting ICE candidates below
  const callerCandidatesCollection = roomRef.collection('callerCandidates'); // ADD
  
  // Code for collecting ICE candidates above

  peerConnection.addEventListener('track', event => { // REVISAR
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  // Change room to here

  // Listening for remote session description below
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      console.log('Got remote description: ', data.answer);
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });
  // Listening for remote session description above

  // Listen for remote ICE candidates below
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
  // Listen for remote ICE candidates above
  chatRef = roomRef.collection('messages');
  listenForMessages(); // Espera por mensagens

}

function joinRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        document.querySelector(
            '#currentRoom').innerText = `O ID da sala atual é: ${roomId} - You are the callee!`;
        await joinRoomById(roomId);
      }, {once: true});
  roomDialog.open();
}

async function joinRoomById(roomId) {
  const db = firebase.firestore();
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  console.log('Got room:', roomSnapshot.exists);

  if (roomSnapshot.exists) {
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Code for collecting ICE candidates below
    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });

    // Code for collecting ICE candidates above

    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });

    // Code for creating SDP answer below

    const offer = roomSnapshot.data().offer;
    console.log('Got offer:', offer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await roomRef.update(roomWithAnswer);
    // Code for creating SDP answer above

    // Listening for remote ICE candidates below
    roomRef.collection('callerCandidates').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
          if (change.type === 'added') {
            let data = change.doc.data();
            console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    // Listening for remote ICE candidates above
    chatRef = roomRef.collection('messages');
    listenForMessages(); // Espera por mensagens
  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

async function sendMessage() {
  const messageInput = document.querySelector('#messageInput');
  const messageText = messageInput.value.trim();

  if (messageText) {
    await chatRef.add({
      text: messageText,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    messageInput.value = ''; // Limpa a caixa de input
  }
}

function listenForMessages() {
  chatRef.orderBy('timestamp').onSnapshot(snapshot => {
    const messagesContainer = document.querySelector('#messages');
    messagesContainer.innerHTML = ''; // Limpa mensagens existentes
    
    snapshot.forEach(doc => {
      const message = doc.data();
      const messageElement = document.createElement('div');
      messageElement.textContent = message.text;
      messagesContainer.appendChild(messageElement);
    });
  });
}

function toggleCam() {
  if (localStream) {
    // Obtém a track de vídeo
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      // Alterna entre habilitar/desabilitar
      videoTrack.enabled = !videoTrack.enabled;
      isCameraOn = videoTrack.enabled;

      // Atualiza o texto do botão
      document.querySelector('#toggleCameraBtn').innerText = isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera';
    }
  }
}

function toggleMic() {
  if (localStream) {
    // Obtém a track de áudio
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      // Alterna entre habilitar/desabilitar
      audioTrack.enabled = !audioTrack.enabled;
      isMicOn = audioTrack.enabled;

      // Atualiza o texto do botão
      document.querySelector('#toggleMicBtn').innerText = isMicOn ? 'Mutar' : 'Desmutar';
    }
  }
}

init();
