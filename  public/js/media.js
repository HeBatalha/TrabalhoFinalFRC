export let localStream = null;
export let remoteStream = new MediaStream();

export async function openUserMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.querySelector('#localVideo').srcObject = localStream;
  document.querySelector('#remoteVideo').srcObject = remoteStream;
}

export function toggleTrack(trackType) {
  if (localStream) {
    const track = localStream.getTracks().find(t => t.kind === trackType);
    if (track) track.enabled = !track.enabled;
  }
}
