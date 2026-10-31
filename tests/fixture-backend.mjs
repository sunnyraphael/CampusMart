// Local-only Supabase protocol fixture for browser tests. Never contacts the live project.
import { createServer } from 'node:http'
export const ids={user:'11111111-1111-4111-8111-111111111111',vendor:'44444444-4444-4444-8444-444444444444',product:'55555555-5555-4555-8555-555555555555',order:'66666666-6666-4666-8666-666666666666',chat:'77777777-7777-4777-8777-777777777777',message:'88888888-8888-4888-8888-888888888888'}
const now=()=>new Date().toISOString()
export const user={id:ids.user,aud:'authenticated',role:'authenticated',email:'buyer@example.test',email_confirmed_at:now(),app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'Test Buyer',role:'buyer'},created_at:now(),identities:[]}
export function session(){const exp=Math.floor(Date.now()/1000)+3600;const token=[{alg:'HS256',typ:'JWT'},{sub:ids.user,aud:'authenticated',role:'authenticated',exp,iat:Math.floor(Date.now()/1000)},'test'].map((v)=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');return {access_token:token,refresh_token:'fixture-refresh',expires_in:3600,expires_at:exp,token_type:'bearer',user}}

if(process.argv[1]?.endsWith('fixture-backend.mjs')) {
  let favorites=[];let saved=[];let support=[];let read=false;let messages=[];let failures=new Set();let temporaryFailures=new Map();let calls=[];let role='buyer';let hasStore=false;let removedProduct=false;let storageFailure=false;let cleanupQueued=false;let extraProducts=[];let itemStatus='received';let transactions=[]
  const product={id:ids.product,title:'Campus headphones',description:'Comfortable headphones for lectures and study.',price:12000,images:[],avg_rating:4.5,total_reviews:2,stock_quantity:5,status:'active',seller_id:ids.vendor,category_id:'99999999-9999-4999-8999-999999999999',compare_at_price:15000,sale_ends_at:null,condition:'used_like_new',availability:'on_campus',delivery_days:2,categories:{name:'Electronics',slug:'electronics'},sellers:{id:ids.vendor,store_name:'Campus Store',is_verified:true,logo_url:null,description:'Study essentials'}}
  const categories=[{id:product.category_id,name:'Electronics',slug:'electronics'},{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Books & Notes',slug:'books'}]
  const order={id:ids.order,user_id:ids.user,created_at:now(),status:'pending',payment_status:'paid',total_amount:12240,delivery_address:'Hall A',order_items:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',product_id:ids.product,seller_id:ids.vendor,quantity:1,unit_price:12000,subtotal:12000,fulfillment_status:'received',products:{title:product.title,images:[]}}]}
  createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,HEAD,OPTIONS')
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
    const url=new URL(req.url,'http://localhost')
    const buffers=[];for await(const chunk of req)buffers.push(chunk)
    let body={};try{body=JSON.parse(Buffer.concat(buffers).toString()||'{}')}catch{}
    const json=(data,status=200)=>{res.setHeader('Content-Type','application/json');res.writeHead(status);res.end(req.method==='HEAD'?undefined:JSON.stringify(data))}
    if(url.pathname==='/health')return json({ok:true})
    if(url.pathname==='/__reset'){favorites=[];saved=[];support=[];read=false;messages=[];failures=new Set();temporaryFailures=new Map();calls=[];role='buyer';hasStore=false;removedProduct=false;storageFailure=false;cleanupQueued=false;extraProducts=[];itemStatus='received';transactions=[];return json({ok:true})}
    if(url.pathname==='/__fail'){if(body.times)temporaryFailures.set(body.table,{remaining:body.times,status:body.status??503});else failures.add(body.table);return json({ok:true})}
    if(url.pathname==='/__recover'){failures.delete(body.table);temporaryFailures.delete(body.table);return json({ok:true})}
    if(url.pathname==='/__vendor'){role=body.role??role;hasStore=body.store??hasStore;storageFailure=body.storageFailure??storageFailure;extraProducts=body.products??extraProducts;itemStatus=body.itemStatus??itemStatus;transactions=body.transactions??transactions;return json({ok:true})}
    if(url.pathname==='/__calls')return json(calls)
    calls.push({path:url.pathname,method:req.method,query:url.search})
    if(url.pathname==='/auth/v1/user')return json(req.headers.authorization?.includes('Bearer')?user:{},req.headers.authorization?200:401)
    if(url.pathname==='/auth/v1/token')return json(session())
    if(url.pathname==='/auth/v1/logout')return json({})
    if(url.pathname==='/auth/v1/recover')return json({})
    if(url.pathname==='/auth/v1/verify')return json(session())
    if(url.pathname==='/storage/v1/object/product-images'&&req.method==='DELETE')return storageFailure?json({statusCode:'500',error:'server_error',message:'Simulated cleanup failure'},500):json([{name:'shared.jpg'}])
    if(url.pathname==='/auth/v1/signup')return json({user,session:null})
    const rpc=url.pathname.split('/rpc/')[1]
    if(rpc) {
      if(failures.has(rpc))return json({code:'XX000',message:'Fixture request failed'},500)
      if(rpc==='vendor_update_item_status'){itemStatus=body.p_new_status;return json(null)}
      if(rpc==='cm_enroll_vendor'){role='vendor';return json(null)}
      if(rpc==='cm_delete_listing'){removedProduct=true;cleanupQueued=true;return json(null)}
      if(rpc==='cm_claim_listing_image_cleanup')return json(cleanupQueued?[{id:ids.message,image_url:`http://127.0.0.1:54329/storage/v1/object/public/product-images/${ids.vendor}/shared.jpg`,vendor_id:ids.vendor,lease_token:ids.chat}]:[])
      if(rpc==='cm_finish_listing_image_cleanup'){if(body.p_result==='deleted')cleanupQueued=false;return json(null)}
      if(rpc==='is_admin')return json(false)
      if(rpc==='cm_conversations')return json([{id:ids.chat,other_name:'Campus Store',product_id:ids.product,updated_at:now(),last_message:messages.at(-1)?.body??'Hello from the vendor',unread_count:0}])
      if(rpc==='cm_start_conversation')return json(ids.chat)
      if(rpc==='cm_send_message'){messages.push({id:crypto.randomUUID(),conversation_id:ids.chat,sender_id:ids.user,body:body.p_body,created_at:now()});return json(messages.at(-1).id)}
      if(rpc==='cm_set_favorite'){favorites=body.p_saved?[{product_id:body.p_product_id,user_id:ids.user,saved_at:now()}]:[];return json(null)}
      if(rpc==='cm_read_notifications'){read=true;return json(null)}
      if(rpc==='cm_support_request'){const id=crypto.randomUUID();support.push({id,subject:body.p_subject,body:body.p_body,status:'open',created_at:now(),admin_reply:null});return json(id)}
      return json(null)
    }
    const table=url.pathname.split('/rest/v1/')[1]
    const temporary=temporaryFailures.get(table)
    if(temporary?.remaining>0){temporary.remaining--;return json({code:'PGRST000',message:'Temporary fixture outage'},temporary.status)}
    if(failures.has(table))return json({code:'XX000',message:'Fixture database failure'},500)
    if(table==='saved_searches'&&req.method==='POST'){saved.push({...body,id:crypto.randomUUID()});return json(null,201)}
    if(table==='saved_searches'&&req.method==='DELETE'){saved=[];return json(null)}
    const tables={products:[...(removedProduct?[]:[{...product,created_at:now()}]),...extraProducts],categories,users:[{id:ids.user,full_name:'Test Buyer',phone:'08012345678',email:user.email,role}],sellers:hasStore?[{id:ids.vendor,user_id:ids.user,store_name:'Campus Store',wallet_balance:0,kyc_status:'not_submitted',is_kyc_verified:false,phone:'08012345678',description:'Study essentials for students',logo_url:null,category:'Electronics & Gadgets',whatsapp:null,state:'Lagos',campus:'Campus',bank_name:null,account_name:null,account_number:null}]:[],public_vendors:[{id:ids.vendor,store_name:'Campus Store',description:'Study essentials',logo_url:null,is_verified:true,campus:'Campus',state:'Lagos'}],orders:[order],order_items:[{...order.order_items[0],order_id:ids.order,seller_id:ids.vendor,payout_amount:11400,released_at:itemStatus==='received'?now():null,orders:{user_id:ids.user,payment_status:'paid'},fulfillment_status:itemStatus}],transactions,reviews:[],wishlist:favorites,saved_searches:saved,notifications:read?[]:[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',user_id:ids.user,message:'Your order has been delivered',is_read:false,created_at:now(),order_id:ids.order}],buyer_messages:messages,support_requests:support}
    if(!(table in tables))return json({code:'PGRST205',message:'Unknown fixture table'},404)
    let rows=tables[table]
    for(const [key,value]of url.searchParams)if(key==='id'&&value.startsWith('eq.'))rows=rows.filter((r)=>r.id===value.slice(3))
    if(table==='products'&&url.searchParams.get('title')?.includes('nothingmatches'))rows=[]
    const count=rows.length
    rows=rows.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??100))
    res.setHeader('Content-Range',count?`0-${count-1}/${count}`:'*/0')
    const object=req.headers.accept?.includes('vnd.pgrst.object')
    return json(object?rows[0]??null:rows)
  }).listen(54329,'127.0.0.1')
}
