// Creates (or removes) the throwaway accounts and shop products used by the visual pass. Everything is marked ZZ / ascentor-test.invalid.
const path=require('path');const fs=require('fs');const root=path.resolve(__dirname,'../..');
require(path.join(root,'node_modules/dotenv')).config({path:path.join(root,'.env.local')});
const {createClient}=require(path.join(root,'node_modules/@supabase/supabase-js'));
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const STATE=path.join(__dirname,'visual_state.json');
const mode=process.argv[2];
(async()=>{
 if(mode==='up'){
  const st={};const ts=Date.now();
  const mk=async(label,role)=>{const email=`e2e.visual.${label}.${ts}@ascentor-test.invalid`;const password='Vz7!kRt-4mQp-Ascent'+label;
    const {data,error}=await sb.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Visual '+label}});if(error)throw error;
    for(let i=0;i<12;i++){const {data:p}=await sb.from('profiles').select('id').eq('id',data.user.id);if(p&&p.length)break;await new Promise(r=>setTimeout(r,500));}
    const patch={onboarding_completed:true,full_name:'Visual '+label};if(role)patch.role=role;
    const u=await sb.from('profiles').update(patch).eq('id',data.user.id);if(u.error)throw u.error;
    return {id:data.user.id,email,password};};
  st.member=await mk('member');st.admin=await mk('admin','admin');
  const {data:prof}=await sb.from('profiles').select('referral_code').eq('id',st.member.id).single();st.refCode=prof?.referral_code||null;
  const base={price:0,currency:'NGN',cta_label:'x',cta_url:'',published:true,sort_order:900,lead_capture:false,stock:null,sizes:null,badge:null,is_featured:false,tagline:'',file_path:null};
  const prods=[
   {name:'ZZ Rise by Choice hoodie',slug:'zz-hoodie',tagline:'Heavyweight cotton',description:'Heavyweight cotton hoodie. The Ascentor mark on the chest.',shop_category:'Apparel',fulfilment:'ship',price_ngn:25000,stock:38,sizes:['S','M','L','XL','XXL'],badge:'Bestseller',is_featured:true,category:'Apparel'},
   {name:'ZZ Summit tee',slug:'zz-tee',description:'Made for the Summit.',shop_category:'Apparel',fulfilment:'ship',price_ngn:12000,stock:120,sizes:['S','M','L','XL'],badge:'Limited',category:'Apparel'},
   {name:'ZZ Ascentor cap',slug:'zz-cap',description:'Six-panel cotton cap.',shop_category:'Accessories',fulfilment:'ship',price_ngn:8000,stock:0,category:'Accessories'},
   {name:'ZZ Purpose workbook (PDF)',slug:'zz-workbook',description:'A printable workbook.',shop_category:'Digital',fulfilment:'digital',price_ngn:3500,category:'Digital'},
   {name:'ZZ Free leadership guide',slug:'zz-free-guide',description:'A free guide. Enter your name and email.',shop_category:'Digital',fulfilment:'digital',price_ngn:0,lead_capture:true,category:'Digital'},
  ].map(p=>({...base,...p}));
  const {data:ins,error:pe}=await sb.from('products').insert(prods).select('id,slug');if(pe)throw pe;st.products=ins;
  fs.writeFileSync(STATE,JSON.stringify(st,null,2));console.log('created member, admin and',ins.length,'products');
 } else if(mode==='down'){
  const st=JSON.parse(fs.readFileSync(STATE,'utf8'));const errs=[];
  const {data:orders}=await sb.from('shop_orders').select('id').in('email',[st.member.email,st.admin.email]);
  for(const o of orders||[])await sb.from('shop_orders').delete().eq('id',o.id);
  const {error:de}=await sb.from('products').delete().in('id',st.products.map(p=>p.id));if(de)errs.push('products '+de.message);
  for(const k of ['member','admin']){const u=st[k];
    await sb.from('notifications').delete().eq('user_id',u.id);await sb.from('member_presence').delete().eq('user_id',u.id);
    await sb.from('shop_leads').delete().eq('email',u.email);
    const r=await sb.auth.admin.deleteUser(u.id);if(r.error)errs.push(k+' '+r.error.message);
    const p=await sb.from('profiles').select('id').eq('id',u.id);if(p.data&&p.data.length){await sb.from('profiles').delete().eq('id',u.id);}}
  console.log('cleanup errors:',errs.length?errs.join(' | '):'none');fs.unlinkSync(STATE);
 } else if(mode==='plan'){
  const st=JSON.parse(fs.readFileSync(STATE,'utf8'));const [plan,status,days]=[process.argv[3],process.argv[4],Number(process.argv[5]||30)];
  const patch={subscription_plan:plan,subscription_status:status,subscription_end:new Date(Date.now()+days*864e5).toISOString(),subscription_start:new Date().toISOString()};
  const r=await sb.from('profiles').update(patch).eq('id',st.member.id);console.log('plan set',plan,status,r.error?r.error.message:'ok');
 }
})().catch(e=>{console.error('ERR',e.message||e);process.exit(1)});
