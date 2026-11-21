import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const magic=Buffer.from('SHOPPING-STAGE2-BACKUP-v1\n');
export function encryptBackup(plain,key){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic);
  const bytes=Buffer.concat([cipher.update(plain),cipher.final()]);
  return Buffer.concat([magic,iv,cipher.getAuthTag(),bytes]);
}
export function decryptBackup(bytes,key){
  if(!bytes.subarray(0,magic.length).equals(magic)||bytes.length<magic.length+29)throw new Error('Invalid backup format');
  const offset=magic.length,decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(offset,offset+12));
  decipher.setAAD(magic);decipher.setAuthTag(bytes.subarray(offset+12,offset+28));
  // No restore process receives any plaintext until authentication completes.
  return Buffer.concat([decipher.update(bytes.subarray(offset+28)),decipher.final()]);
}
