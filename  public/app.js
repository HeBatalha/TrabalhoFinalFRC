mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

// Configuração inicial e STUN/TURN Servers
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
  document.querySelector('#sendMessageBtn').addEventListener('click', sendMessage);
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
  // Desativa os botões enquanto cria a sala
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  // Inicializa o Firestore
  const db = firebase.firestore();

  // Cria uma referência para a nova sala no Firestore
  const roomRef = await db.collection('rooms').doc();

  // Configura e cria a conexão peer (WebRTC)
  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);
  registerPeerConnectionListeners();

  // Adiciona as faixas de mídia local à conexão peer
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Cria uma oferta (offer) para iniciar a negociação peer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log('Created offer:', offer);

  // Salva a oferta (offer) no Firestore para que outros participantes possam se conectar
  const roomWithOffer = {
    'offer': {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  await roomRef.set(roomWithOffer);
  roomId = roomRef.id;
  console.log(`New room created with SDP offer. Room ID: ${roomId}`);
  document.querySelector(
      '#currentRoom').innerText = `Você é o dono na sala de ID: ${roomId}`;


  // ToDo: Checar a necessidade disso aqui
  // // Configura a coleção para candidatos ICE do chamador
  // const callerCandidatesCollection = roomRef.collection('callerCandidates');

  // // Escuta por candidatos ICE remotos
  // roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
  //   snapshot.docChanges().forEach(async change => {
  //     if (change.type === 'added') {
  //       let data = change.doc.data();
  //       console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
  //       await peerConnection.addIceCandidate(new RTCIceCandidate(data));
  //     }
  //   });
  // });

    // Escuta por faixas de mídia remotas e as adiciona ao 'remoteStream'
    peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });


  // Escuta por mudanças na descrição remota da sessão
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      console.log('Got remote description: ', data.answer);
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });

  // Escuta por candidatos ICE remotos e os adiciona à conexão peer
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });

  // Configura a referência para o chat na sala atual
  chatRef = roomRef.collection('messages');
  // Escuta por mensagens no chat da sala
  listenForMessages();
}


function joinRoom() {
  // Desativa os botões enquanto o usuário tenta entrar na sala
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  // Observa o botão de confirmação de entrada na sala
  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        // Obtém o ID da sala inserido pelo usuário
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        
        // Atualiza o texto para mostrar o ID da sala e o papel do usuário
        document.querySelector(
            '#currentRoom').innerText = `Você é o convidado na sala de ID: ${roomId}`;
        
        // Chama a função para entrar na sala com o ID especificado
        await joinRoomById(roomId);
      }, {once: true});

  // Abre o diálogo para inserir o ID da sala
  roomDialog.open();
}


async function joinRoomById(roomId) {
  // Inicializa o Firestore
  const db = firebase.firestore();

  // Cria uma referência para a sala no Firestore
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  console.log('Got room:', roomSnapshot.exists);

  // Verifica se a sala existe
  if (roomSnapshot.exists) {
    // Configura e cria a conexão peer (WebRTC)
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();

    // Adiciona as faixas de mídia local à conexão peer
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Coleta e adiciona candidatos ICE locais à coleção 'calleeCandidates'
    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });

    // Escuta por faixas de mídia remotas e as adiciona ao 'remoteStream'
    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });

    // Configura a descrição da sessão remota e cria uma resposta SDP
    const offer = roomSnapshot.data().offer;
    console.log('Got offer:', offer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);

    // Atualiza a sala com a resposta SDP
    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await roomRef.update(roomWithAnswer);

    // Escuta por candidatos ICE remotos e os adiciona à conexão peer
    roomRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    // Configura a referência para o chat na sala atual
    chatRef = roomRef.collection('messages');
    // Escuta por mensagens no chat da sala
    listenForMessages();
  }
}


async function openUserMedia(e) {
  // Solicita permissão para acessar a câmera e o microfone do usuário
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
  // Define o stream local (câmera e microfone) para ser exibido no elemento de vídeo local
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;

  // Inicializa um novo MediaStream para o vídeo remoto e define no elemento de vídeo remoto
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);

  // Habilita/desabilita os botões de interface de acordo com o estado atual
  document.querySelector('#cameraBtn').disabled = true; 
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}


async function hangUp(e) {
  // Para todas as faixas de mídia (vídeo e áudio) do stream local
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  // Para todas as faixas do stream remoto, se existirem
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  // Fecha a conexão peer-to-peer, se existir
  if (peerConnection) {
    peerConnection.close();
  }

  // Limpa as referências dos elementos de vídeo
  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;

  // Atualiza o estado dos botões da interface do usuário
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  // Remove a sala do Firestore, se o ID da sala existir
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(roomId);

    // Deleta todos os candidatos ICE do callee
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.delete();
    });

    // Deleta todos os candidatos ICE do caller
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.delete();
    });

    // Deleta o próprio documento da sala
    await roomRef.delete();
  }

  // Recarrega a página para voltar ao estado inicial do app
  document.location.reload(true);
}


function registerPeerConnectionListeners() {
  // Escuta mudanças no estado de coleta de ICE
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  // Escuta mudanças no estado da conexão
  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  // Escuta mudanças no estado de sinalização
  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  // Escuta mudanças no estado da conexão ICE
  peerConnection.addEventListener('iceconnectionstatechange', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}


async function sendMessage() {
  const messageInput = document.querySelector('#messageInput');
  const messageText = messageInput.value.trim();

  if (messageText) {
    // Adiciona uma nova mensagem e o horário no chat do Firestore
    await chatRef.add({
      text: messageText,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    messageInput.value = '';
  }
}

function listenForMessages() {
  // Escuta por novas mensagens na coleção 'messages', ordenadas por horário
  chatRef.orderBy('timestamp').onSnapshot(snapshot => {
    const messagesContainer = document.querySelector('#messages');
    messagesContainer.innerHTML = '';
    
    // Cria um elemento com cada mensagem e o adiciona ao container
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
