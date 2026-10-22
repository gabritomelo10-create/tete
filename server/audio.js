// Identifica o formato real do áudio pelos primeiros bytes, sem confiar no que o navegador declarou.
// Chrome/Android e Firefox gravam WebM/Ogg (Opus); Safari/iPhone grava MP4 (AAC).
export function identificarAudio(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mime: 'audio/webm', extensao: 'webm' };
  }
  if (buf.toString('ascii', 0, 4) === 'OggS') return { mime: 'audio/ogg', extensao: 'ogg' };
  if (buf.toString('ascii', 4, 8) === 'ftyp') return { mime: 'audio/mp4', extensao: 'm4a' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    return { mime: 'audio/wav', extensao: 'wav' };
  }
  return null;
}
