import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {backupKey,encryptStream,decryptedHash} from '../scripts/lib/backup-crypto.mjs'
import {publicThumbnail,publicImageSiblings} from '../src/lib/media/paths.ts'
test('thumbnails are derived only for our versioned public photos; legacy/private URLs stay unchanged',()=>{
  const full='https://project.test/storage/v1/object/public/product-images/store/random-full.webp'
  assert.equal(publicThumbnail(full),full.replace('-full.webp','-thumb.webp'))
  for(const value of ['https://other.test/photo.jpg','https://project.test/storage/v1/object/sign/kyc-documents/id-full.webp','/brand/logo.png'])assert.equal(publicThumbnail(value),value)
  assert.deepEqual(publicImageSiblings(full.replace('-full.webp','-thumb.webp')),[full,full.replace('-full.webp','-thumb.webp')])
})
test('encrypted storage snapshots can be verified and explicitly restored to an isolated local sample',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'campusmart-backup-')),key=backupKey('a'.repeat(64)),plain=Buffer.from('synthetic image bytes')
  const run=promisify(execFile),env={...process.env,BACKUP_DIR:root,BACKUP_ENCRYPTION_KEY:'a'.repeat(64)}
  try{
    await mkdir(path.join(root,'objects'));await encryptStream(Readable.from([plain]),path.join(root,'objects/sample.cmbackup'),key)
    const manifest={files:[{bucket:'product-images',name:'photo.png',backup:'objects/sample.cmbackup',sha256:createHash('sha256').update(plain).digest('hex')}]}
    await encryptStream(Readable.from([JSON.stringify(manifest)]),path.join(root,'storage-test.cmbackup'),key);await writeFile(path.join(root,'latest-storage'),'storage-test.cmbackup')
    const verified=await run(process.execPath,['scripts/backup.mjs','verify-storage'],{env});assert.match(verified.stdout,/verified 1/)
    await assert.rejects(run(process.execPath,['scripts/backup.mjs','restore-storage-test'],{env}))
    await run(process.execPath,['scripts/backup.mjs','restore-storage-test','--confirm-private-local'],{env})
    const restored=(await readdir(root)).find(name=>name.startsWith('restore-test-'));assert.ok(restored)
    assert.deepEqual(await readFile(path.join(root,restored,'1.png')),plain)
  }finally{const resolved=path.resolve(root);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('campusmart-backup-'))throw new Error('Unsafe test cleanup path.');await rm(resolved,{recursive:true,force:true})}
})
test('backup encryption authenticates content and rejects wrong keys, tampering and truncation',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'campusmart-backup-')),file=path.join(root,'test.cmbackup'),key=backupKey('a'.repeat(64)),plain=Buffer.from('Private customer records must never be written in plaintext.')
  try{
    await encryptStream(Readable.from([plain]),file,key)
    const saved=await readFile(file);assert.equal(saved.includes(plain),false)
    assert.equal(await decryptedHash(file,key),createHash('sha256').update(plain).digest('hex'))
    await assert.rejects(decryptedHash(file,backupKey('b'.repeat(64))))
    saved[20]^=1;await writeFile(file,saved);await assert.rejects(decryptedHash(file,key))
    await writeFile(file,saved.subarray(0,12));await assert.rejects(decryptedHash(file,key),/incomplete/)
    assert.throws(()=>backupKey('short'))
  }finally{const resolved=path.resolve(root);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('campusmart-backup-'))throw new Error('Unsafe test cleanup path.');await rm(resolved,{recursive:true,force:true})}
})
