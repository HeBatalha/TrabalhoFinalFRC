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
let roomId = null;
let isCameraOn = true;
let isMicOn = true;


function init() {
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  document.querySelector('#sendMessageBtn').addEventListener('click', sendMessage);
  document.querySelector('#toggleCamBtn').addEventListener('click', toggleCam);
  document.querySelector('#toggleMicBtn').addEventListener('click', toggleMic);

  // Inicializa chat em salas já criadas
  if (roomId) {
    const db = firebase.firestore();
    chatRef = db.collection('rooms').doc(roomId).collection('messages');
    listenForMessages();
  }
  document.getElementById('mainApp').style.display = 'none';
}

async function createRoom() {
  // Abre o acesso à mídia do usuário
  await openUserMedia();

  // Inicializa o Firestore
  const db = firebase.firestore();

  // Cria uma referência para a nova sala no Firestore
  const roomRef = await db.collection('rooms').doc();

  // Configura e cria a conexão peer (WebRTC)
  peerConnection = new RTCPeerConnection(configuration);
  registerPeerConnectionListeners();
  addPeerTrackListener();

  // Adiciona as faixas de mídia local à conexão peer
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Cria uma oferta (offer) para iniciar a negociação peer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Salva a oferta (offer) no Firestore para que outros participantes possam se conectar
  await roomRef.set({ 'offer': { type: offer.type, sdp: offer.sdp } });
  
  roomId = roomRef.id;
  document.querySelector(
      '#currentRoom').innerText = `ID da Sala: ${roomId} \n[Proprietário]`;

  // Escuta por mudanças na descrição remota da sessão
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  // Escuta por candidatos ICE remotos e os adiciona à conexão peer
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  // Configura a referência para o chat na sala atual
  chatRef = roomRef.collection('messages');
  // Escuta por mensagens no chat da sala
  listenForMessages();
}


async function joinRoom() {
  // Abre o acesso à mídia do usuário
  await openUserMedia();

  // Obtém o ID da sala inserido pelo usuário
  roomId = document.querySelector('#room-id').value;
  
  // Atualiza o texto para mostrar o ID da sala e o papel do usuário
  document.querySelector(
      '#currentRoom').innerText = `ID da Sala: ${roomId} \n[Convidado]`;
    
  // Chama a função para entrar na sala com o ID especificado 
  await joinRoomById(roomId);
}


async function joinRoomById(roomId) {
  // Inicializa o Firestore
  const db = firebase.firestore();

  // Cria uma referência para a sala no Firestore
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();

  // Verifica se a sala existe
  if (roomSnapshot.exists) {
    // Configura e cria a conexão peer (WebRTC)
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    addPeerTrackListener();

    // Adiciona as faixas de mídia local à conexão peer
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Coleta e adiciona candidatos ICE locais à coleção 'calleeCandidates'
    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    peerConnection.addEventListener('icecandidate', event => {
      if (event.candidate) {
        calleeCandidatesCollection.add(event.candidate.toJSON());
      }
    });

    // Configura a descrição da sessão remota e cria uma resposta SDP
    const offer = roomSnapshot.data().offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Atualiza a sala com a resposta SDP
    await roomRef.update({ answer: { type: answer.type, sdp: answer.sdp } });

    // Escuta por candidatos ICE remotos e os adiciona à conexão peer
    roomRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

    // Configura a referência para o chat na sala atual
    chatRef = roomRef.collection('messages');
    // Escuta por mensagens no chat da sala
    listenForMessages();
  }
}


async function openUserMedia() {
  // Solicita permissão para acessar a câmera e o microfone do usuário
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
  // Define o stream local (câmera e microfone) para ser exibido no elemento de vídeo local
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;

  // Inicializa um novo MediaStream para o vídeo remoto e define no elemento de vídeo remoto
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  // Atualiza a interface do usuário
  document.getElementById('buttons').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
}


async function hangUp() {
  // Para todas as faixas de mídia (vídeo e áudio) do stream local
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => track.stop());

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
  document.querySelector('#currentRoom').innerText = '';

  // Atualiza a interface do usuário
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('buttons').style.display = 'flex';

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

function addPeerTrackListener() {
  // Escuta por faixas de mídia remotas e as adiciona ao 'remoteStream'
  peerConnection.addEventListener('track', event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  });
}

async function sendMessage() {
  const messageInput = document.querySelector('#messageInput');
  const messageText = messageInput.value.trim();
  const usernameInput = document.querySelector('#usernameInput');
  const usernameText =  usernameInput.value.trim() === '' ? 'Anônimo' : usernameInput.value.trim();

  if (messageText) {
    // Adiciona uma nova mensagem e o horário no chat do Firestore
    await chatRef.add({
      username: usernameText,
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
      // Converte o timestamp para tempo local
      let date = message.timestamp.toDate();
      date = date.toLocaleTimeString();
      messageElement.textContent = `(${date}) ${message.username}: ${message.text}`;
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

      // Atualiza os ícones do botão
      const toggleCamBtn = document.querySelector('#toggleCamBtn');
      const icons = toggleCamBtn.querySelectorAll('.material-icons');

      // Mostra/esconde os ícones de acordo com o estado da câmera
      icons[0].hidden = !isCameraOn; 
      icons[1].hidden = isCameraOn;
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

    // Atualiza os ícones do botão
    const toggleMicBtn = document.querySelector('#toggleMicBtn');
    const icons = toggleMicBtn.querySelectorAll('.material-icons');

    // Mostra/esconde os ícones de acordo com o estado do mic
    icons[0].hidden = !isMicOn; 
    icons[1].hidden = isMicOn;
    }
  }
}

init();
