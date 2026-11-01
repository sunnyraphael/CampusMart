// Local-only Supabase protocol fixture for browser tests. Never contacts the live project.
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
export const ids={user:'11111111-1111-4111-8111-111111111111',vendor:'44444444-4444-4444-8444-444444444444',product:'55555555-5555-4555-8555-555555555555',order:'66666666-6666-4666-8666-666666666666',chat:'77777777-7777-4777-8777-777777777777',message:'88888888-8888-4888-8888-888888888888'}
const now=()=>new Date().toISOString()
export const user={id:ids.user,aud:'authenticated',role:'authenticated',email:'buyer@example.test',email_confirmed_at:now(),app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'Test Buyer',role:'buyer'},created_at:now(),identities:[]}
export function session(){const exp=Math.floor(Date.now()/1000)+3600;const token=[{alg:'HS256',typ:'JWT'},{sub:ids.user,aud:'authenticated',role:'authenticated',exp,iat:Math.floor(Date.now()/1000)},'test'].map((v)=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');return {access_token:token,refresh_token:'fixture-refresh',expires_in:3600,expires_at:exp,token_type:'bearer',user}}

if(process.argv[1]?.endsWith('fixture-backend.mjs')) {
  let kyc=[];let favorites=[];let saved=[];let support=[];let read=false;let messages=[];let failures=new Set();let temporaryFailures=new Map();let delays=new Map();let isAdmin=false;let calls=[];let role='buyer';let hasStore=false;let removedProduct=false;let storageFailure=false;let cleanupQueued=false;let extraProducts=[];let itemStatus='received';let transactions=[];let delivery={};let verifiedPayment=false;let credited=true;let handoverCode=null;let trial=false;let trialRequests=new Map();let loseTrialResponse=false;let disputeDecision=null;let notificationOrders=[];let notificationRows=null;let orderBuyerId=ids.user
  const product={id:ids.product,title:'Campus headphones',description:'Comfortable headphones for lectures and study.',price:12000,images:[],avg_rating:null,total_reviews:0,stock_quantity:5,status:'active',seller_id:ids.vendor,category_id:'99999999-9999-4999-8999-999999999999',compare_at_price:15000,sale_ends_at:null,condition:'used_like_new',availability:'on_campus',delivery_days:2,categories:{name:'Electronics',slug:'electronics'},sellers:{id:ids.vendor,store_name:'Campus Store',is_verified:true,logo_url:null,description:'Study essentials'}}
  const categories=[{id:product.category_id,name:'Electronics',slug:'electronics'},{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Books & Notes',slug:'books'}]
  const order={id:ids.order,user_id:ids.user,created_at:now(),status:'pending',payment_status:'paid',total_amount:12240,delivery_address:'Hall A',order_items:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',product_id:ids.product,seller_id:ids.vendor,quantity:1,unit_price:12000,subtotal:12000,fulfillment_status:'received',products:{title:product.title,images:[]}}]}
  const defaultConsent=()=>({accepted:true,eligible:true,selling_eligible:true,age_band:'adult',accepted_at:now(),guardian_request_id:null,vendor_terms:true})
  const emailHash=email=>createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex')
  let consent=defaultConsent(),accountActive=true,accountClosedAt=null,storeClosedAt=null,accountRequests=[],guardians=[],sellerFields={}
  const normalizeRequest=row=>({id:crypto.randomUUID(),user_id:ids.user,kind:'delete_data',status:'pending',note:null,admin_note:null,created_at:now(),reviewed_at:null,reviewed_by:null,full_name:'Test Buyer',email:user.email,store_name:hasStore?'Campus Store':null,store_closed_at:storeClosedAt,events:[],...row})
  const normalizeGuardian=row=>{const {student_email,...values}=row;return {id:crypto.randomUUID(),guardian_id:ids.user,student_email_hash:emailHash(student_email??user.email),relationship:'parent',allows_selling:false,state:'pending',created_at:now(),reviewed_at:null,reviewed_by:null,review_note:null,guardian_email:'guardian@example.test',guardian_name:'Test Guardian',...values}}
  function consentStatus(){
    const permission=guardians.find(row=>row.id===consent.guardian_request_id&&row.state==='approved'&&row.student_email_hash===emailHash(user.email))
    const eligible=accountActive&&!!consent.accepted&&!!consent.eligible&&(consent.age_band==='adult'||!!permission)
    return {...consent,eligible,selling_eligible:eligible&&!!consent.selling_eligible&&(consent.age_band==='adult'||!!permission?.allows_selling)}
  }
  function closeStore(closed){storeClosedAt=closed?storeClosedAt??now():null;if(closed){product.status='draft';extraProducts=extraProducts.map(row=>({...row,status:row.status==='active'?'draft':row.status}))}}
  createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,HEAD,OPTIONS')
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
    const url=new URL(req.url,'http://localhost')
    const buffers=[];for await(const chunk of req)buffers.push(chunk)
    let body={};try{body=JSON.parse(Buffer.concat(buffers).toString()||'{}')}catch{}
    const json=(data,status=200)=>{res.setHeader('Content-Type','application/json');res.writeHead(status);res.end(req.method==='HEAD'?undefined:JSON.stringify(data))}
    if(url.pathname==='/health')return json({ok:true})
    if(url.pathname==='/__reset'){consent=defaultConsent();accountActive=true;accountClosedAt=null;storeClosedAt=null;accountRequests=[];guardians=[];sellerFields={};product.status='active';kyc=[];favorites=[];saved=[];support=[];read=false;messages=[];failures=new Set();temporaryFailures=new Map();delays=new Map();isAdmin=false;calls=[];role='buyer';hasStore=false;removedProduct=false;storageFailure=false;cleanupQueued=false;extraProducts=[];itemStatus='received';transactions=[];delivery={};verifiedPayment=false;credited=true;handoverCode=null;trial=false;trialRequests=new Map();loseTrialResponse=false;disputeDecision=null;notificationOrders=[];notificationRows=null;orderBuyerId=ids.user;product.price=12000;product.stock_quantity=5;order.total_amount=12240;order.delivery_method=undefined;order.delivery_address='Hall A';order.phone_number=undefined;order.delivery_notes=undefined;order.order_items[0].unit_price=12000;order.order_items[0].quantity=1;order.order_items[0].subtotal=12000;return json({ok:true})}
    if(url.pathname==='/__privacy'){
      if(body.consent)consent={...consent,...body.consent}
      if(typeof body.active==='boolean'){accountActive=body.active;accountClosedAt=body.active?null:now();if(!body.active&&hasStore)closeStore(true)}
      if(typeof body.storeClosed==='boolean')closeStore(body.storeClosed)
      if(Array.isArray(body.requests))accountRequests=body.requests.map(normalizeRequest)
      if(Array.isArray(body.guardians))guardians=body.guardians.map(normalizeGuardian)
      return json({ok:true})
    }
    if(url.pathname==='/__delay'){delays.set(body.table,body.ms??0);return json({ok:true})}
    if(url.pathname==='/__admin_data'){kyc=body.kyc??kyc;support=body.support??support;return json({ok:true})}
    if(url.pathname==='/__admin'){isAdmin=!!body.enabled;return json({ok:true})}
    if(url.pathname==='/__fail'){if(body.times)temporaryFailures.set(body.table,{remaining:body.times,status:body.status??503});else failures.add(body.table);return json({ok:true})}
    if(url.pathname==='/__recover'){failures.delete(body.table);temporaryFailures.delete(body.table);return json({ok:true})}
    if(url.pathname==='/__vendor'){role=body.role??role;hasStore=body.store??hasStore;storageFailure=body.storageFailure??storageFailure;extraProducts=body.products??extraProducts;itemStatus=body.itemStatus??itemStatus;if(body.itemStatus)credited=body.itemStatus==='received';transactions=body.transactions??transactions;return json({ok:true})}
    if(url.pathname==='/__delivery'){delivery={...delivery,...body.tracking};verifiedPayment=body.verifiedPayment??verifiedPayment;credited=body.credited??credited;return json({ok:true})}
    if(url.pathname==='/__trial'){loseTrialResponse=body.loseResponse??loseTrialResponse;product.price=body.price??product.price;product.stock_quantity=body.stock??product.stock_quantity;return json({ok:true})}
    if(url.pathname==='/__trial_state')return json({created:trialRequests.size})
    if(url.pathname==='/__notification_context'){notificationOrders=body.orders??[];notificationRows=body.notifications??null;orderBuyerId=body.buyerId??ids.user;return json({ok:true})}
    if(url.pathname==='/__calls')return json(calls)
    calls.push({path:url.pathname,method:req.method,query:url.search,isService:req.headers.authorization==='Bearer fixture-service-key',requestId:body.p_request_id,fields:Object.keys(body)})
    const track=()=>({is_trial:trial,item_id:order.order_items[0].id,status:itemStatus,created_at:order.created_at,expected_by:null,courier:null,tracking_number:null,tracking_url:null,delivery_note:null,reported_at:['delivered','received'].includes(itemStatus)?now():null,review_after:null,buyer_confirmed_at:itemStatus==='received'?now():null,code_verified_at:null,held_at:null,approved_at:null,events:[],...delivery,released_at:credited?now():null})
    if(url.pathname==='/auth/v1/user')return json(req.headers.authorization?.includes('Bearer')?user:{},req.headers.authorization?200:401)
    if(url.pathname==='/auth/v1/token')return json(session())
    if(url.pathname==='/auth/v1/logout')return json({})
    if(url.pathname==='/auth/v1/recover')return json({})
    if(url.pathname==='/auth/v1/verify')return json(session())
    if(url.pathname==='/storage/v1/object/product-images'&&req.method==='DELETE')return storageFailure?json({statusCode:'500',error:'server_error',message:'Simulated cleanup failure'},500):json([{name:'shared.jpg'}])
    if(url.pathname==='/auth/v1/signup'){
      if(body.data?.age_band==='under_18'&&!guardians.some(row=>row.id===body.data.guardian_request_id&&row.state==='approved'&&row.student_email_hash===emailHash(body.email)))return json({code:'unexpected_failure',message:'Guardian permission must be approved before student registration.'},400)
      return json({user,session:null})
    }
    const rpc=url.pathname.split('/rpc/')[1]
    if(rpc) {
      if(delays.get(rpc))await new Promise(resolve=>setTimeout(resolve,delays.get(rpc)))
      const temporaryRpc=temporaryFailures.get(rpc)
      if(temporaryRpc?.remaining>0){temporaryRpc.remaining--;return json({code:'PGRST000',message:'Temporary fixture outage'},temporaryRpc.status)}
      if(failures.has(rpc))return json({code:'XX000',message:'Fixture request failed'},500)
      const rejected=message=>json({code:'P0001',message},400)
      const signedIn=!!req.headers.authorization&&!req.headers.authorization.includes('fixture-anon-key')
      if(['cm_consent_status','cm_accept_marketplace_terms','cm_accept_vendor_terms','cm_account_status','cm_set_store_closed','cm_request_account_change','cm_cancel_account_change','cm_admin_account_requests','cm_admin_review_account_change','cm_request_guardian_permission','cm_withdraw_guardian_permission','cm_admin_guardian_queue','cm_admin_review_guardian'].includes(rpc)&&!signedIn)return rejected('Please sign in to continue.')
      if(rpc==='cm_account_is_active')return json(body.p_user_id&&body.p_user_id!==ids.user?true:accountActive)
      if(rpc==='cm_consent_status')return json(consentStatus())
      if(rpc==='cm_accept_marketplace_terms'){
        if(!accountActive)return rejected('An active signed-in account is required.')
        if(body.p_accepted!==true||!['adult','under_18'].includes(body.p_age_band))return rejected('Choose an age band and accept the terms to continue.')
        if(consent.age_band&&consent.age_band!==body.p_age_band)return rejected('Contact support to correct your recorded age band.')
        const guardian=guardians.find(row=>row.id===body.p_guardian_request_id&&row.state==='approved'&&row.student_email_hash===emailHash(user.email))
        if(body.p_age_band==='under_18'&&!guardian)return rejected('A reviewed guardian permission matching your sign-in email is required.')
        consent={...consent,accepted:true,eligible:true,selling_eligible:body.p_age_band==='adult'||!!guardian?.allows_selling,age_band:body.p_age_band,accepted_at:now(),guardian_request_id:body.p_age_band==='under_18'?guardian.id:null}
        return json(null)
      }
      if(rpc==='cm_accept_vendor_terms'){
        if(body.p_accepted!==true||!consentStatus().selling_eligible)return rejected('An adult account or reviewed guardian permission to sell is required before accepting vendor terms.')
        consent.vendor_terms=true;return json(null)
      }
      if(rpc==='cm_account_status')return json({active:accountActive,closed_at:accountClosedAt,has_store:hasStore,store_closed_at:storeClosedAt,requests:accountRequests.filter(row=>row.user_id===ids.user).sort((a,b)=>b.created_at.localeCompare(a.created_at))})
      if(rpc==='cm_set_store_closed'){
        if(!accountActive)return rejected('This account is closed. Contact support about reopening.')
        if(!hasStore)return rejected('There is no store on this account.')
        if(typeof body.p_closed!=='boolean')return rejected('Choose whether to close or reopen your store.')
        closeStore(body.p_closed);return json(null)
      }
      if(rpc==='cm_request_account_change'){
        if(!['delete_data','close_account','close_both'].includes(body.p_kind))return rejected('Choose a valid account request.')
        if(!accountActive&&body.p_kind!=='delete_data')return rejected('This account is already closed. Contact support if you need help.')
        const existing=accountRequests.find(row=>row.user_id===ids.user&&['pending','in_review'].includes(row.status)&&(row.kind===body.p_kind||(body.p_kind!=='delete_data'&&row.kind!=='delete_data')))
        if(existing)return json(existing.id)
        if(body.p_kind==='close_account'&&hasStore&&!storeClosedAt)return rejected('Close your store first, or choose account and store together.')
        if(body.p_kind==='close_both'&&hasStore)closeStore(true)
        const row=normalizeRequest({kind:body.p_kind,note:body.p_note??null,events:[{id:crypto.randomUUID(),status:'pending',note:'Request submitted by the account owner.',created_at:now()}]})
        accountRequests.push(row);return json(row.id)
      }
      if(rpc==='cm_cancel_account_change'){
        const row=accountRequests.find(row=>row.id===body.p_id&&row.user_id===ids.user&&row.status==='pending')
        if(!row)return rejected('Only a pending request belonging to your account can be cancelled.')
        row.status='cancelled';row.events.push({id:crypto.randomUUID(),status:'cancelled',note:'Cancelled by the account owner. Store closure is not reversed by cancellation.',created_at:now()});return json(null)
      }
      if(rpc==='cm_admin_account_requests'){
        if(!isAdmin||!accountActive)return rejected('Administrator access is required.')
        return json(accountRequests.filter(row=>body.p_view==='closed'?!['pending','in_review'].includes(row.status):['pending','in_review'].includes(row.status)).sort((a,b)=>a.created_at.localeCompare(b.created_at)).slice(0,100))
      }
      if(rpc==='cm_admin_review_account_change'){
        if(!isAdmin||!accountActive)return rejected('Administrator access is required.')
        const row=accountRequests.find(row=>row.id===body.p_id&&['pending','in_review'].includes(row.status))
        if(!row)return rejected('This request is no longer open.')
        if(!['in_review','decline','approve_closure'].includes(body.p_action)||String(body.p_note??'').trim().length<10)return rejected('Choose a review action and explain the outcome in 10 to 2,000 characters.')
        if(body.p_action==='approve_closure'){
          if(row.kind==='delete_data')return rejected('Data removal is handled separately. A review action does not erase data.')
          if(row.user_id===ids.user)return rejected('Another administrator must review your own account closure.')
          if(row.user_id===orderBuyerId&&(!['received','refunded'].includes(itemStatus)||(itemStatus==='received'&&!credited)))return rejected('Resolve open orders, delivery reviews and disputes before closing this account.')
          if(row.kind==='close_account'&&row.store_name&&!row.store_closed_at)return rejected('The store is open. Ask the owner to close it or request both closures.')
          row.store_closed_at=row.store_name?row.store_closed_at??now():null
        }
        row.status=body.p_action==='approve_closure'?'completed':body.p_action==='decline'?'declined':'in_review';row.admin_note=body.p_note.trim();row.reviewed_at=now();row.reviewed_by=ids.user
        row.events.push({id:crypto.randomUUID(),status:row.status,note:row.admin_note,created_at:row.reviewed_at});return json(null)
      }
      if(rpc==='cm_request_guardian_permission'){
        if(!consentStatus().eligible||consent.age_band!=='adult')return rejected('A confirmed adult account is required to request guardian permission.')
        if(body.p_accepted!==true||!['parent','legal_guardian'].includes(body.p_relationship))return rejected('Parent or legal guardian permission is required.')
        if(typeof body.p_student_email!=='string'||!/^\S+@\S+\.\S+$/.test(body.p_student_email))return rejected('Enter the student sign-in email.')
        if(body.p_student_email.trim().toLowerCase()===user.email.toLowerCase())return rejected('The student must use a separate sign-in email.')
        if(body.p_allow_selling&&!consent.vendor_terms)return rejected('Accept the vendor terms before authorizing a student store.')
        const hash=emailHash(body.p_student_email)
        const existing=guardians.find(row=>row.guardian_id===ids.user&&row.student_email_hash===hash&&['pending','approved'].includes(row.state))
        if(existing)return json(existing.id)
        const row=normalizeGuardian({student_email:body.p_student_email,relationship:body.p_relationship,allows_selling:body.p_allow_selling===true,guardian_email:user.email,guardian_name:'Test Buyer'})
        guardians.push(row);return json(row.id)
      }
      if(rpc==='cm_withdraw_guardian_permission'){
        const row=guardians.find(row=>row.id===body.p_id&&row.guardian_id===ids.user&&['pending','approved'].includes(row.state))
        if(!row)return rejected('Permission is not available for withdrawal.')
        row.state='withdrawn';return json(null)
      }
      if(rpc==='cm_admin_guardian_queue'){
        if(!isAdmin||!accountActive)return rejected('Administrator access is required.')
        return json(guardians.filter(row=>row.state==='pending').map(({student_email_hash,guardian_id,...row})=>row).sort((a,b)=>a.created_at.localeCompare(b.created_at)).slice(0,100))
      }
      if(rpc==='cm_admin_review_guardian'){
        if(!isAdmin||!accountActive)return rejected('Administrator access is required.')
        const row=guardians.find(row=>row.id===body.p_id&&row.state==='pending')
        if(!row)return rejected('This request has already been reviewed or withdrawn.')
        if(row.guardian_id===ids.user)return rejected('Another administrator must review your own guardian request.')
        if(typeof body.p_approved!=='boolean'||String(body.p_note??'').trim().length<10)return rejected('Record your verification and decision in 10 to 1,000 characters.')
        if(body.p_approved&&body.p_verified!==true)return rejected('Check guardian identity, authority and permission before approving.')
        row.state=body.p_approved?'approved':'rejected';row.reviewed_at=now();row.reviewed_by=ids.user;row.review_note=body.p_note.trim()
        if(consent.age_band==='under_18'&&consent.guardian_request_id===row.id){consent.eligible=body.p_approved;consent.selling_eligible=body.p_approved&&row.allows_selling}
        return json(null)
      }
      if(rpc==='cm_create_trial_order'){
        if(!accountActive||!consentStatus().eligible)return rejected('Review your account permissions before placing an order.')
        if(product.status!=='active'||storeClosedAt)return rejected('An item belongs to a closed store. Remove it from your cart.')
        if(trialRequests.has(body.p_request_id))return json(trialRequests.get(body.p_request_id));
        const sub=body.p_items.reduce((sum,i)=>sum+product.price*i.quantity,0),total=sub+(sub>=20000?0:Math.round(sub*.02))+(body.p_delivery_method==='delivery'?500:0);
        if(total!==body.p_expected_total)return json({code:'P0001',message:'Prices changed. Refresh your cart and review the new total before placing the order.'},400);
        if(body.p_items.some(i=>i.quantity>product.stock_quantity))return json({code:'P0001',message:'An item exceeds stock. Refresh your cart.'},400);
        trial=true;credited=false;itemStatus='pending';verifiedPayment=false;delivery={};order.delivery_method=body.p_delivery_method;order.delivery_address=body.p_address;order.phone_number=body.p_phone;order.delivery_notes=body.p_note;order.total_amount=total;order.order_items[0].unit_price=product.price;order.order_items[0].quantity=body.p_items[0].quantity;order.order_items[0].subtotal=sub;
        const result={id:ids.order,total_amount:total,is_trial:true};trialRequests.set(body.p_request_id,result);
        if(loseTrialResponse){loseTrialResponse=false;return json({code:'XX000',message:'Response lost after commit'},500)}
        return json(result)
      }
      if(rpc==='cm_vendor_delivery_holds')return json(delivery.held_at?[order.order_items[0].id]:[])
      if(rpc==='cm_order_tracking')return json([track()])
      if(rpc==='cm_order_cancellation_quote'||rpc==='cm_cancel_buyer_order'){
        if(!signedIn||body.p_order_id!==ids.order)return rejected('This order is not available.')
        const cancelled=itemStatus==='cancelled'
        const reason=!trial?'Online cancellation of real orders is not enabled until payment and refund integration is connected. Contact support.':!['pending','confirmed'].includes(itemStatus)?'An item is already dispatched or ready for pickup. Contact support.':null
        if(rpc==='cm_cancel_buyer_order'&&!cancelled){if(reason)return rejected(reason);itemStatus='cancelled'}
        return json({cancelled:itemStatus==='cancelled',can_cancel:itemStatus!=='cancelled'&&!reason,reason,is_trial:trial,deadline:new Date(Date.now()+30*60000).toISOString(),refund_amount:0,retained_service_fee:0,refund_status:itemStatus==='cancelled'?'not_charged':undefined})
      }
      if(rpc==='cm_vendor_update_delivery'){itemStatus=body.p_status;for(const key of ['expected_by','courier','tracking_number','tracking_url'])if(body['p_'+key]!=null)delivery[key]=body['p_'+key];if(body.p_note!=null)delivery.delivery_note=body.p_note;return json(null)}
      if(rpc==='cm_issue_delivery_code'){handoverCode='482731';return json({code:handoverCode,expires_at:new Date(Date.now()+1800000).toISOString()})}
      if(rpc==='cm_verify_delivery_code'){if(body.p_code!==handoverCode)return json({ok:false,message:'That code does not match. Check with the buyer before trying again.'});delivery.code_verified_at=now();if(itemStatus==='shipped')itemStatus='delivered';return json({ok:true})}
      if(rpc==='cm_confirm_delivery'){itemStatus='received';delivery.buyer_confirmed_at=now();return json(null)}
      if(rpc==='cm_report_order_problem'){itemStatus='disputed';delivery.held_at=now();delivery.dispute_reason=body.p_reason;return json(null)}
      if(rpc==='cm_admin_order_disputes')return json((body.p_resolved?!!disputeDecision:itemStatus==='disputed')?[{item_id:order.order_items[0].id,order_id:ids.order,product_title:product.title,quantity:1,subtotal:12000,dispute_reason:delivery.dispute_reason??'Trial item did not arrive',ordered_at:order.created_at,buyer_name:'Test Buyer',buyer_email:user.email,buyer_phone:'08012345678',delivery_method:order.delivery_method??'pickup',store_name:'Campus Store',seller_phone:'08012345678',resolution:disputeDecision,resolved_at:disputeDecision?now():null,admin_note:'Trial decision',is_trial:trial}]:[])
      if(rpc==='cm_admin_resolve_delivery_dispute'){disputeDecision=body.p_decision;itemStatus=body.p_decision==='refund'?'refunded':'delivered';delivery.held_at=null;delivery.buyer_confirmed_at=null;return json(null)}
      if(rpc==='cm_admin_hold_delivery'){delivery.held_at=body.p_hold?now():null;delivery.hold_note=body.p_hold?body.p_note:null;return json(null)}
      if(rpc==='cm_admin_approve_delivery'){credited=true;delivery.approved_at=now();delivery.approval_note=body.p_note;return json(null)}
      if(rpc==='cm_admin_delivery_queue'){
        const t=track();const row={...t,order_id:ids.order,fulfillment_status:itemStatus,quantity:1,subtotal:12000,commission_amount:600,payout_amount:11400,product_title:product.title,store_name:'Campus Store',buyer_name:'Test Buyer',buyer_email:user.email,buyer_phone:'08012345678',delivery_method:order.delivery_method??'delivery',delivery_address:'Hall A',payment_status:trial?'unpaid':'paid',payment_verified_at:verifiedPayment?now():null,payment_verification_ref:verifiedPayment?'fixture-verified-payment':null,hold_note:delivery.hold_note??null,approval_note:delivery.approval_note??null};
        return json(body.p_view==='approved'?(credited&&delivery.approved_at?[row]:[]):body.p_view==='held'?(!credited&&delivery.held_at?[row]:[]):(!credited&&!delivery.held_at&&['delivered','received'].includes(itemStatus)?[row]:[]))
      }

      if(rpc==='cm_enroll_vendor'){if(!accountActive||!consentStatus().selling_eligible||!consent.vendor_terms)return rejected('Review your account permissions and vendor terms before opening a store.');role='vendor';return json(null)}
      if(rpc==='cm_delete_listing'){removedProduct=true;cleanupQueued=true;return json(null)}
      if(rpc==='cm_claim_listing_image_cleanup')return json(cleanupQueued?[{id:ids.message,image_url:`http://127.0.0.1:54329/storage/v1/object/public/product-images/${ids.vendor}/shared.jpg`,vendor_id:ids.vendor,lease_token:ids.chat}]:[])
      if(rpc==='cm_finish_listing_image_cleanup'){if(body.p_result==='deleted')cleanupQueued=false;return json(null)}
      if(rpc==='admin_kyc_queue')return json(kyc)
      if(rpc==='admin_review_kyc'){if(!isAdmin)return json({message:'Forbidden'},403);kyc=kyc.filter(i=>i.seller_id!==body.p_seller_id);return json(null)}
      if(rpc==='is_admin')return json(isAdmin)
      if(rpc==='cm_conversations')return json([{id:ids.chat,other_name:'Campus Store',product_id:ids.product,updated_at:now(),last_message:messages.at(-1)?.body??'Hello from the vendor',unread_count:0}])
      if(rpc==='cm_start_conversation'){if(!accountActive||!consentStatus().eligible)return rejected('Review your account permissions before using messages.');return json(ids.chat)}
      if(rpc==='cm_send_message'){if(!accountActive||!consentStatus().eligible)return rejected('Review your account permissions before using messages.');messages.push({id:crypto.randomUUID(),conversation_id:ids.chat,sender_id:ids.user,body:body.p_body,created_at:now()});return json(messages.at(-1).id)}
      if(rpc==='cm_set_favorite'){favorites=body.p_saved?[{product_id:body.p_product_id,user_id:ids.user,saved_at:now()}]:[];return json(null)}
      if(rpc==='cm_read_notifications'){read=true;return json(null)}
      if(rpc==='cm_support_request'){const id=crypto.randomUUID();support.push({id,subject:body.p_subject,body:body.p_body,status:'open',created_at:now(),admin_reply:null});return json(id)}
      return json(null)
    }
    const table=url.pathname.split('/rest/v1/')[1]
    if(delays.get(table))await new Promise(resolve=>setTimeout(resolve,delays.get(table)))
    const temporary=temporaryFailures.get(table)
    if(temporary?.remaining>0){temporary.remaining--;return json({code:'PGRST000',message:'Temporary fixture outage'},temporary.status)}
    if(failures.has(table))return json({code:'XX000',message:'Fixture database failure'},500)
    if(table==='sellers'&&req.method==='POST'){
      if(!accountActive||!consentStatus().selling_eligible||!consent.vendor_terms)return json({code:'P0001',message:'Review your account permissions and vendor terms before opening a store.'},400)
      const values=Array.isArray(body)?body[0]:body
      if(values.user_id!==ids.user)return json({code:'42501',message:'This store does not belong to your account.'},403)
      hasStore=true;role='vendor';sellerFields={...values};return json(null,201)
    }
    if(table==='guardian_permissions'&&req.method!=='GET'&&req.method!=='HEAD')return json({code:'42501',message:'Use the checked guardian permission actions.'},403)
    if(table==='support_requests'&&req.method==='PATCH'){if(!isAdmin)return json({message:'Forbidden'},403);const id=url.searchParams.get('id')?.slice(3);const item=support.find(i=>i.id===id);if(item)Object.assign(item,body);return json(item?[{id}]:[])}
    if(table==='saved_searches'&&req.method==='POST'){saved.push({...body,id:crypto.randomUUID()});return json(null,201)}
    if(table==='saved_searches'&&req.method==='DELETE'){saved=[];return json(null)}
    const tables={guardian_permissions:guardians.filter(row=>row.guardian_id===ids.user),account_change_requests:accountRequests.filter(row=>row.user_id===ids.user||isAdmin),products:[...(removedProduct?[]:[{...product,created_at:now()}]),...extraProducts],categories,users:[{id:ids.user,full_name:'Test Buyer',phone:'08012345678',email:user.email,role}],sellers:hasStore?[{id:ids.vendor,user_id:ids.user,store_name:'Campus Store',wallet_balance:0,kyc_status:'not_submitted',is_kyc_verified:false,phone:'08012345678',description:'Study essentials for students',logo_url:null,category:'Electronics & Gadgets',whatsapp:null,state:'Lagos',campus:'Campus',bank_name:null,account_name:null,account_number:null,store_closed_at:storeClosedAt,...sellerFields}]:[],public_vendors:[{id:ids.vendor,store_name:'Campus Store',description:'Study essentials',logo_url:null,is_verified:true,campus:'Campus',state:'Lagos'}],orders:[{...order,user_id:orderBuyerId,is_trial:trial,payment_status:trial?'unpaid':'paid',payment_verified_at:verifiedPayment?now():null,order_items:order.order_items.map(i=>({...i,fulfillment_status:itemStatus,released_at:credited?now():null,dispute_reason:delivery.dispute_reason}))},...notificationOrders.map(o=>({...order,...o}))],order_items:[{...order.order_items[0],order_id:ids.order,seller_id:ids.vendor,payout_amount:11400,released_at:credited?now():null,orders:{user_id:orderBuyerId,payment_status:trial?'unpaid':'paid',is_trial:trial},fulfillment_status:itemStatus}],transactions,reviews:[],wishlist:favorites,saved_searches:saved,notifications:read?[]:notificationRows??[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',user_id:ids.user,message:'Your order has been delivered',is_read:false,created_at:now(),order_id:ids.order}],buyer_messages:messages,support_requests:support}
    if(!(table in tables))return json({code:'PGRST205',message:'Unknown fixture table'},404)
    let rows=tables[table]
    for(const [key,value]of url.searchParams)if(key==='id'&&value.startsWith('eq.'))rows=rows.filter((r)=>r.id===value.slice(3))
    if(table==='orders'&&url.searchParams.get('user_id')?.startsWith('eq.'))rows=rows.filter(r=>r.user_id===url.searchParams.get('user_id').slice(3))
    if(table==='guardian_permissions'&&url.searchParams.get('guardian_id')?.startsWith('eq.'))rows=rows.filter(row=>row.guardian_id===url.searchParams.get('guardian_id').slice(3))
    if(table==='products'&&url.searchParams.get('status')?.startsWith('eq.'))rows=rows.filter(row=>row.status===url.searchParams.get('status').slice(3))
    if(table==='products'&&url.searchParams.get('title')?.includes('nothingmatches'))rows=[]
    if(table==='orders'&&url.searchParams.get('is_trial')==='eq.false')rows=rows.filter(r=>!r.is_trial)
    if(table==='orders'&&url.searchParams.get('payment_status')==='eq.paid')rows=rows.filter(r=>r.payment_status==='paid')
    if(table==='support_requests'&&url.searchParams.get('status')==='neq.resolved')rows=rows.filter(r=>r.status!=='resolved')
    const count=rows.length
    rows=rows.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??100))
    res.setHeader('Content-Range',count?`0-${count-1}/${count}`:'*/0')
    const object=req.headers.accept?.includes('vnd.pgrst.object')
    return json(object?rows[0]??null:rows)
  }).listen(54329,'127.0.0.1')
}
