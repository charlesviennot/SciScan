// Utility to handle Gemini Raw PCM Audio

export const playAudioData = (base64String: string): { promise: Promise<void>, stop: () => void } => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  
  let isStopped = false;

  const promise = new Promise<void>((resolve) => {
    source.onended = () => {
      // Ensure we clean up context
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
      resolve();
    };
    source.start(0);
  });

  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    try {
      source.stop(); 
      // onended will fire and resolve the promise
    } catch (e) {
      // Ignore if already stopped
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    }
  };

  return { promise, stop };
};