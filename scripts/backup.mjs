// Secrets are read from the process environment, never printed or passed as argv.
import {createClient} from '@supabase/supabase-js'
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises'
import {Readable,Transform} from 'node:stream'
import {createWriteStream} from 'node:fs'
import {pipeline} from 'node:stream/promises'
import {createHash,randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import path from 'node:path'
import {backupKey,encryptStream,decryptStream,decryptedHash} from './lib/backup-crypto.mjs'
const action=process.argv[2],root=path.resolve(process.env.BACKUP_DIR??'backups'),key=backupKey(process.env.BACKUP_ENCRYPTION_KEY)
for(const directory of ['public','src'])if(root===path.resolve(directory)||root.startsWith(path.resolve(directory)+path.sep))throw new Error('Keep encrypted backups outside public and source directories.')
await mkdir(root,{recursive:true,mode:0o700});await mkdir(path.join(root,'objects'),{recursive:true,mode:0o700})
function inside(name){if(!/^[a-zA-Z0-9._/-]+$/.test(name)||name.split('/').some(p=>p==='..'||!p))throw new Error('Invalid backup filename.');const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw new Error('Invalid backup path.');return file}
async function jsonRead(name){const chunks=[];for await(const chunk of await decryptStream(inside(name),key))chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
async function jsonWrite(value,name){await encryptStream(Readable.from([JSON.stringify(value)]),inside(name),key)}
function postgresEnv(value,local=false){
  const url=new URL(value??'');if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('Configure a PostgreSQL connection URL.')
  if(local&&(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!/^campusmart_restore_[a-zA-Z0-9_]+$/.test(url.pathname.slice(1))))throw new Error('Restore tests require a localhost database named campusmart_restore_... .')
  return {...process.env,PGHOST:url.hostname.replace(/^\[|\]$/g,''),PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:local?'prefer':url.searchParams.get('sslmode')||'verify-full'}
}
function command(binary,args,env){
  const child=spawn(binary,args,{env,stdio:['pipe','pipe','pipe'],windowsHide:true})
  child.stderr.resume() // Provider errors may contain connection details; do not echo them.
  const done=new Promise((resolve,reject)=>{child.on('error',()=>reject(new Error(`${binary} is unavailable. Install PostgreSQL client tools.`)));child.on('exit',code=>code===0?resolve():reject(new Error(`${binary} failed. Check your configuration and target permissions.`)))})
  done.catch(()=>{});return {child,done}
}
try{
  if(action==='database'){
    const name=`database-${Date.now()}-${randomUUID()}.cmbackup`,{child,done}=command('pg_dump',['--format=custom','--no-owner'],postgresEnv(process.env.BACKUP_DATABASE_URL))
    child.stdin.end();await Promise.all([encryptStream(child.stdout,inside(name),key),done]);await writeFile(path.join(root,'latest-database'),name,{mode:0o600});console.log('Encrypted database backup saved:',name)
  }else if(action==='storage'){
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY
    if(!url||!secret)throw new Error('Configure Supabase backup credentials.')
    const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}),buckets=await client.storage.listBuckets()
    if(buckets.error)throw new Error('Bucket inventory could not load.')
    let previous={files:[]};try{previous=await jsonRead((await readFile(path.join(root,'latest-storage'),'utf8')).trim())}catch{/* First backup has no previous snapshot. */}
    const prior=new Map(previous.files.map(f=>[f.bucket+'/'+f.name,f])),files=[];let downloaded=0
    async function walk(bucket,prefix='',depth=0){
      if(depth>16)throw new Error('Storage nesting exceeds the backup safety limit.')
      for(let offset=0;;offset+=100){
        const rows=await client.storage.from(bucket).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}})
        if(rows.error)throw new Error('Storage inventory failed; the previous snapshot remains available.')
        for(const file of rows.data??[]){
          if(!file.name||file.name.includes('/')||file.name==='.'||file.name==='..')throw new Error('Unsafe storage filename.')
          const name=prefix?prefix+'/'+file.name:file.name
          if(!file.id){await walk(bucket,name,depth+1);continue}
          if(files.length>=50000)throw new Error('Backup file limit exceeded. Review capacity before retrying.')
          const old=prior.get(bucket+'/'+name)
          if(old&&typeof file.updated_at==='string'&&old.updated_at===file.updated_at&&old.object_id===file.id&&await stat(inside(old.backup)).then(()=>true,()=>false)){files.push(old);continue}
          const response=await fetch(`${url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${name.split('/').map(encodeURIComponent).join('/')}`,{headers:{Authorization:`Bearer ${secret}`,apikey:secret},signal:AbortSignal.timeout(60000),redirect:'error'})
          if(!response.ok||!response.body)throw new Error('Storage download failed; the previous snapshot remains available.')
          const hash=createHash('sha256'),backup='objects/'+randomUUID()+'.cmbackup'
          const digest=new Transform({transform(chunk,encoding,callback){hash.update(chunk);callback(null,chunk)}})
          const source=Readable.fromWeb(response.body);source.on('error',error=>digest.destroy(error))
          await encryptStream(source.pipe(digest),inside(backup),key)
          files.push({bucket,name,object_id:file.id,updated_at:file.updated_at,backup,sha256:hash.digest('hex')});downloaded++
        }
        if((rows.data?.length??0)<100)break
      }
    }
    for(const bucket of buckets.data??[])await walk(bucket.name)
    const name=`storage-${Date.now()}-${randomUUID()}.cmbackup`;await jsonWrite({version:1,created_at:new Date().toISOString(),files},name);await writeFile(path.join(root,'latest-storage'),name,{mode:0o600});console.log(`Encrypted storage snapshot saved: ${name}. ${files.length} files, ${downloaded} newly downloaded.`)
  }else if(action==='verify-storage'){
    const name=process.argv.slice(3).find(a=>!a.startsWith('--'))??(await readFile(path.join(root,'latest-storage'),'utf8')).trim(),manifest=await jsonRead(name)
    for(const file of manifest.files)if(await decryptedHash(inside(file.backup),key)!==file.sha256)throw new Error('Backup integrity verification failed.')
    console.log(`Authenticated and verified ${manifest.files.length} encrypted files. This is not a restoration test.`)
  }else if(action==='restore-storage-test'){
    if(!process.argv.includes('--confirm-private-local'))throw new Error('Explicit --confirm-private-local is required: this creates local plaintext test copies of private files.')
    const name=process.argv.slice(3).find(a=>!a.startsWith('--'))??(await readFile(path.join(root,'latest-storage'),'utf8')).trim(),manifest=await jsonRead(name)
    const testDir=inside('restore-test-'+randomUUID());await mkdir(testDir,{mode:0o700})
    const limit=Math.max(1,Math.min(20,Number(process.env.BACKUP_RESTORE_SAMPLE_LIMIT)||3));let restored=0
    for(const file of manifest.files.slice(0,limit)){
      if(await decryptedHash(inside(file.backup),key)!==file.sha256)throw new Error('Backup integrity verification failed.')
      const extension=/^[.][a-zA-Z0-9]{1,8}$/.test(path.extname(file.name))?path.extname(file.name):'.bin'
      await pipeline(await decryptStream(inside(file.backup),key),createWriteStream(path.join(testDir,String(++restored)+extension),{flags:'wx',mode:0o600}))
    }
    await writeFile(path.join(root,'storage-restore-test-result.json'),JSON.stringify({completed_at:new Date().toISOString(),files:restored,sample:true}),{mode:0o600})
    console.log(`Restored ${restored} local sample files in ${path.basename(testDir)}. Inspect them, then securely remove these plaintext test copies. This does not restore Supabase Storage.`)
  }else if(action==='verify-database'||action==='restore-test'){
    const name=process.argv.slice(3).find(a=>!a.startsWith('--'))??(await readFile(path.join(root,'latest-database'),'utf8')).trim()
    // Authenticate the whole archive before feeding any SQL to pg_restore.
    await decryptedHash(inside(name),key)
    let env=process.env,args=['--list']
    if(action==='restore-test'){
      if(!process.argv.includes('--confirm-empty-local'))throw new Error('Explicit --confirm-empty-local is required.')
      env=postgresEnv(process.env.BACKUP_RESTORE_DATABASE_URL,true)
      const check=command('psql',['--no-psqlrc','-At','-c',"select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')"],env);check.child.stdin.end();let output='';for await(const c of check.child.stdout)output+=c;await check.done
      if(output.trim()!=='0')throw new Error('Restore target is not empty. Refusing to overwrite it.')
      args=['--no-owner','--exit-on-error','--dbname',env.PGDATABASE]
    }
    const {child,done}=command('pg_restore',args,env);child.stdout.resume();const source=await decryptStream(inside(name),key);await Promise.all([pipeline(source,child.stdin),done])
    if(action==='restore-test')await writeFile(path.join(root,'restore-test-result.json'),JSON.stringify({completed_at:new Date().toISOString(),database:env.PGDATABASE}),{mode:0o600})
    console.log(action==='restore-test'?'Restored into the explicitly selected empty local database. Check rows and application behavior next.':'Database archive authenticated and readable. This is not a restoration test.')
  }else throw new Error('Use database, storage, verify-storage, verify-database, restore-storage-test, or restore-test.')
}catch(error){console.error(error instanceof Error?error.message:'Backup failed.');process.exitCode=1}
