import { useCallback, useRef, useState } from 'react';

const constraints: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    sampleRate: 16000,
    sampleSize: 16,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
};

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    setStream(mediaStream);
    const preferredMime = 'audio/webm;codecs=opus';
    const mimeType = MediaRecorder.isTypeSupported(preferredMime) ? preferredMime : 'audio/webm';
    const recorder = new MediaRecorder(mediaStream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const finalBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
      setBlob(finalBlob);
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    stream?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
  }, [stream]);

  const reset = useCallback(() => {
    setBlob(null);
  }, []);

  return {
    isRecording,
    stream,
    blob,
    start,
    stop,
    reset
  };
}
