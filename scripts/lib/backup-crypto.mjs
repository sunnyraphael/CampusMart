import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto'
import {createReadStream,createWriteStream} from 'node:fs'
import {open,appendFile,stat,unlink} from 'node:fs/promises'
import {pipeline} from 'node:stream/promises'
const magic=Buffer.from('CMBK01')
export function backupKey(value){if(!/^[a-f0-9]{64}$/i.test(value??''))throw new Error('BACKUP_ENCRYPTION_KEY must contain 64 random hexadecimal characters.');return Buffer.from(value,'hex')}
export async function encryptStream(source,target,key){
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce),temporary=target+'.partial'
  try{
    const header=await open(temporary,'wx',0o600);await header.write(Buffer.concat([magic,nonce]));await header.close()
    await pipeline(source,cipher,createWriteStream(temporary,{flags:'a'}))
    await appendFile(temporary,cipher.getAuthTag())
    const {rename}=await import('node:fs/promises');await rename(temporary,target)
  }catch(error){await unlink(temporary).catch(()=>{});throw error}
}
export async function decryptStream(file,key){
  const size=(await stat(file)).size;if(size<34)throw new Error('Backup is incomplete.')
  const handle=await open(file,'r'),head=Buffer.alloc(18),tag=Buffer.alloc(16)
  try{await handle.read(head,0,18,0);await handle.read(tag,0,16,size-16)}finally{await handle.close()}
  if(!head.subarray(0,6).equals(magic))throw new Error('Unknown backup format.')
  const decipher=createDecipheriv('aes-256-gcm',key,head.subarray(6));decipher.setAuthTag(tag)
  const input=createReadStream(file,{start:18,end:size-17});input.on('error',error=>decipher.destroy(error));return input.pipe(decipher)
}
export async function decryptedHash(file,key){const hash=createHash('sha256');for await(const chunk of await decryptStream(file,key))hash.update(chunk);return hash.digest('hex')}
