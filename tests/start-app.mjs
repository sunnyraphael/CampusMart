import { spawn } from 'node:child_process'
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3101','--hostname','127.0.0.1'],{stdio:'inherit',env:{...process.env,CAMPUSMART_E2E:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-anon-key',NEXT_TELEMETRY_DISABLED:'1'}})
child.on('exit',(code)=>process.exit(code??0))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal))
