<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Teachers - SomaHub KNEC PRO</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
<style>
body{font-family:'Nunito',sans-serif;background:#f6f6f7}
@keyframes m{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}.marquee{animation:m 22s linear infinite}
.knec-q{background:#e0f2ff;border-left:5px solid #4a86ff}
.knec-ans{background:#dcfce7;border-left:5px solid #22c55e}
.knec-key{background:#fef08a;border-left:5px solid #ffcc1a}
.knec-weak{background:#fee2e2;border-left:5px solid #ef4444}
.knec-help{background:#ccfbf1;border-left:5px solid #2ac5a0}
.bubble{padding:8px 12px;border-radius:12px;border:2px solid #000;margin:6px 0;font-size:11px;line-height:1.5}
</style>
<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const cfg={apiKey:"AIzaSyA93BNes3AmFyxIEgjSbvbIWqLyorLsuj8",authDomain:"somahubkenya-9e458.firebaseapp.com",projectId:"somahubkenya-9e458",storageBucket:"somahubkenya-9e458.firebasestorage.app",messagingSenderId:"615579085715",appId:"1:615579085715:web:28fca37ba498324bb49666"};
const app=initializeApp(cfg); const auth=getAuth(app); const db=getFirestore(app);
window.FB={auth,db,doc,getDoc,onAuthStateChanged};
</script>
</head>
<body class="flex justify-center"><div class="w-full max-w-[480px] bg-[#f6f6f7] min-h-screen pb-[140px]">
<div class="h-2 flex"><div class="flex-1 bg-[#ff8a2a]"></div><div class="flex-1 bg-[#2ac5a0]"></div><div class="flex-1 bg-[#4a86ff]"></div><div class="flex-1 bg-[#ffcc1a]"></div></div>

<div class="bg-white border-b-2 border-black sticky top-0 z-40">
<div class="p-3 flex items-center gap-2">
<div class="w-10 h-10 rounded-full border-2 border-black bg-[#ffcc1a] flex items-center justify-center font-black">SH</div>
<div class="flex-1"><p class="font-black text-[14px]">Welcome, Mwalimu! 👩‍🏫</p><p class="text-[10px] font-bold text-gray-600" id="teacherInfo">PP1 - Grade 9 • KNEC Style</p></div>
<div class="bg-[#ffcc1a] border-2 border-black px-3 py-1 rounded-full shadow-[2px_2px_0_0_#000]"><p class="font-black text-[10px]" id="teacherIdShow">SHKET...</p></div>
</div>
<div class="bg-black text-white overflow-hidden whitespace-nowrap border-y-2 border-black h-8 flex items-center"><div class="marquee flex gap-8 text-[10px] font-black"><span>📸 Smart Marker PRO - PP1 to Grade 9</span><span>🎨 Bold & Colored</span><span>📋 KNEC Style + Teacher Weakness</span><span>✅ Copy + Done - No Address</span></div></div>
</div>

<div class="p-3">
<!-- GRADE SELECTOR PP1 to G9 -->
<div class="bg-white border-[2.5px] border-black rounded-[16px] p-3 shadow-[3px_3px_0_0_#000] flex gap-2 items-center">
<p class="font-black text-[11px]">🎓 Level:</p>
<select id="gradeSel" class="flex-1 border-2 border-black rounded-full px-3 py-2 font-black text-[12px] bg-[#fffc8a]">
<option>PP1</option><option>PP2</option><option>Grade 1</option><option>Grade 2</option><option>Grade 3</option><option>Grade 4</option><option>Grade 5</option><option>Grade 6</option><option selected>Grade 7</option><option>Grade 8</option><option>Grade 9</option>
</select>
<span id="levelBadge" class="bg-[#4a86ff] text-white border-2 border-black px-3 py-1 rounded-full text-[9px] font-black">KNEC</span>
</div>

<!-- SMART MARKER -->
<div class="mt-3 bg-[#fffc8a] border-[2.5px] border-black rounded-[22px] p-4 shadow-[4px_4px_0_0_#000]">
<div class="flex justify-between items-center"><p class="font-black text-[14px]">📸 Smart Marker - KNEC PRO</p><span class="bg-black text-white px-3 py-1 rounded-full text-[8px] font-black">PP1-G9 • COLORED</span></div>
<p class="text-[10px] mt-2 font-bold">Snap exam → <span class="bg-white border border-black px-1 rounded">Bold Answer</span> + <span class="bg-[#ffcc1a] border border-black px-1 rounded">Key Words</span> + Teacher Help</p>

<div class="mt-3 bg-white border-2 border-black rounded-xl p-2">
<div id="smartPreview" class="hidden"></div>
<p id="smartHint" class="text-[11px] text-center font-black opacity-60 py-6">📸 Tap 📷 Photo / 🖼️ Gallery / 🎥 Video<br><span class="text-[9px]">Supports exam paper, practical video, learner work</span></p>
<div id="smartResult" class="mt-2 hidden bg-[#fffde7] border-2 border-black rounded-xl p-3 text-[11px] leading-6"></div>

<div id="smartActions" class="hidden mt-4">
<div class="border-t-2 border-dashed border-black pt-3">
<p class="text-[10px] font-black text-center mb-2">⬇️ ACTIONS ⬇️</p>
<div class="grid grid-cols-2 gap-3">
<button onclick="copySmartResult()" class="bg-white border-[2.5px] border-black rounded-full py-3.5 font-black text-[12px] shadow-[3px_3px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_#000]">📋 COPY</button>
<button onclick="doneSmart()" class="bg-black text-white border-[2.5px] border-black rounded-full py-3.5 font-black text-[12px] shadow-[3px_3px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_#000]">✅ DONE / EXIT</button>
</div>
</div>
</div>
</div>

<div class="mt-3 grid grid-cols-3 gap-2">
<button onclick="document.getElementById('smartPhoto').click()" class="bg-white border-2 border-black rounded-full py-3 font-black text-[10px] shadow-[2px_2px_0_0_#000]">📷 Photo</button>
<button onclick="document.getElementById('smartPhoto').removeAttribute('capture');document.getElementById('smartPhoto').click()" class="bg-[#ffcc1a] border-2 border-black rounded-full py-3 font-black text-[10px] shadow-[2px_2px_0_0_#000]">🖼️ Gallery</button>
<button onclick="document.getElementById('smartVideo').click()" class="bg-[#2ac5a0] text-white border-2 border-black rounded-full py-3 font-black text-[10px] shadow-[2px_2px_0_0_#000]">🎥 Video</button>
</div>
<div class="mt-2">
<button onclick="markSmart()" id="smartBtn" class="w-full bg-black text-white border-2 border-black rounded-full py-4 font-black text-[13px] shadow-[3px_3px_0_0_#000]">✨ Mark Smart - KNEC Teacher Mode</button>
</div>
<input type="file" id="smartPhoto" hidden accept="image/*,image/jpeg,image/png,image/webp" capture="environment" onchange="handleSmartPhoto(this)">
<input type="file" id="smartVideo" hidden accept="video/*,image/*" onchange="handleSmartPhoto(this)">
</div>
</div>

<div class="px-3 mt-4">
<p class="font-black text-[14px] mb-2">🚀 Quick Access - No 404</p>
<div class="grid grid-cols-2 gap-2">
<div onclick="location.href='notes.html'" class="bg-white rounded-xl p-3 border-2 border-black shadow-[2px_2px_0_0_#000] cursor-pointer"><p class="font-black text-[12px]">📚 Notes</p><p class="text-[9px]">PP1-G9</p></div>
<div onclick="location.href='exam.html'" class="bg-white rounded-xl p-3 border-2 border-black shadow-[2px_2px_0_0_#000] cursor-pointer"><p class="font-black text-[12px]">📝 Exams</p><p class="text-[9px]">KNEC</p></div>
<div onclick="location.href='homework.html'" class="bg-[#ffcc1a] rounded-xl p-3 border-2 border-black shadow-[2px_2px_0_0_#000] cursor-pointer"><p class="font-black text-[12px]">📝 Homework</p><p class="text-[9px]">Colored</p></div>
<div onclick="location.href='lesson-plans.html'" class="bg-[#fff7e0] rounded-xl p-3 border-2 border-black shadow-[2px_2px_0_0_#000] cursor-pointer"><p class="font-black text-[12px]">📝 Lesson Plans</p><p class="text-[9px]">CBC</p></div>
</div>
</div>

</div>

<!-- TOAST - NO DOMAIN -->
<div id="toast" class="hidden fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full border-2 border-black font-black text-[12px] z-[9999] shadow-[4px_4px_0_0_#000]">✅ COPIED!</div>

<script>
let smartPhotoData='', currentTeacherId=null;
const PROXY_URL="/api/gemini";
function showToast(msg){
  let t=document.getElementById('toast');
  t.innerText=msg;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),2600);
}
function handleSmartPhoto(input){
  let f=input.files[0]; if(!f) return;
  let r=new FileReader();
  r.onload=e=>{
    smartPhotoData=e.target.result;
    let preview=document.getElementById('smartPreview');
    if(f.type.startsWith('video')){
      preview.innerHTML='<video src="'+smartPhotoData+'" controls class="rounded-lg max-h-[200px] mx-auto border-2 border-black w-full bg-black"></video>';
    }else{
      preview.innerHTML='<img src="'+smartPhotoData+'" class="rounded-lg max-h-[200px] mx-auto border-2 border-black">';
    }
    preview.classList.remove('hidden');
    document.getElementById('smartHint').classList.add('hidden');
    document.getElementById('smartResult').classList.add('hidden');
    document.getElementById('smartActions').classList.add('hidden');
    showToast(f.type.startsWith('video')?"🎥 Video loaded":"📸 Photo loaded");
  };
  r.readAsDataURL(f);
}
function renderColoredKNEC(text){
  // Clean leaks
  text=text.replace(/Abigail Wanjiru Kimani|Abigail|Private Schools|Kasarani|Cluster|Assessment|###+/gi,"").trim();
  // SVG blocks to pretty div
  text=text.replace(/```svg([\s\S]*?)```/gi,(m,code)=>`<div class="bg-white border-[2.5px] border-black rounded-[14px] p-2 my-3 shadow-[2px_2px_0_0_#000]">${code}</div>`);
  text=text.replace(/```[\s\S]*?```/g,"");
  // Color the sections
  let html=text
   .replace(/\*\*Q\d+\.[^\n]*\*\*/g, m=>`<div class="bubble knec-q font-black">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*✅[^\n]*\*\*/g, m=>`<div class="bubble knec-ans font-black">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*🔑[^\n]*\*\*/g, m=>`<div class="bubble knec-key font-black">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*📖[^\n]*\*[\s\S]*?(?=\n\*\*|$)/g, m=>`<div class="bubble bg-white font-bold">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*⚠️[^\n]*\*\*[\s\S]*?(?=\n\*\*|$)/g, m=>`<div class="bubble knec-weak font-black">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*🩺[^\n]*\*\*[\s\S]*?(?=\n\*\*|$)/g, m=>`<div class="bubble knec-help font-black">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*👨‍🎓[^\n]*\*\*/g, m=>`<div class="bubble bg-[#e0f2ff] font-black border-l-4 border-l-[#4a86ff]">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*⭐[^\n]*\*\*/g, m=>`<div class="bubble bg-black text-white font-black">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*📊[^\n]*\*\*/g, m=>`<div class="bubble bg-[#ffcc1a] font-black">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*📉[^\n]*\*\*[\s\S]*?(?=\n\*\*|$)/g, m=>`<div class="bubble knec-weak font-bold">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\*\*👩‍🏫[^\n]*\*\*[\s\S]*?(?=\n\*\*|$)/g, m=>`<div class="bubble knec-help font-bold">${m.replace(/\*\*/g,'')}</div>`)
   .replace(/\n/g,'<br>');
  // Bold key words inside
  html=html.replace(/\*\*(.*?)\*\*/g,'<b class="bg-[#ffcc1a] px-1 border border-black rounded">$1</b>');
  return html;
}
async function markSmart(){
  if(!smartPhotoData){ showToast("📸 Snap exam first"); return; }
  let btn=document.getElementById('smartBtn'), resDiv=document.getElementById('smartResult'), actDiv=document.getElementById('smartActions');
  let grade=document.getElementById('gradeSel').value;
  let isPP = grade.includes('PP')||grade.includes('1')||grade.includes('2')||grade.includes('3');
  btn.innerText="⏳ Marking KNEC..."; btn.disabled=true;
  resDiv.classList.remove('hidden');
  resDiv.innerHTML='<div class="text-center py-4 font-black">⏳ Marking... <br><span class="text-[10px]">Bold + Colored + Teacher Weakness</span></div>';
  try{
    let photo=smartPhotoData.split(',')[1];
    let resp=await fetch(PROXY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      question: `Mark this ${grade} exam photo - KNEC style teacher mode: bold answer, colored key words, learner weakness, teacher action suggestions. ${isPP?"Use simple language, big emojis, very colorful for PP1-Grade3":"Use CBC KNEC detailed analysis for Grade 4-9"}. Do not include student name.`,
      grade: grade, shke:"SHKE", mode:"mark", photo: photo
    })});
    let data=await resp.json();
    let ans=data.answer||data.error||"No result";
    resDiv.innerHTML=renderColoredKNEC(ans);
    actDiv.classList.remove('hidden');
    actDiv.scrollIntoView({behavior:'smooth'});
    showToast("✅ Marked - Teacher Mode");
  }catch(e){ resDiv.innerHTML="❌ Error: "+e.message; }
  btn.innerText="✨ Mark Smart - KNEC Teacher Mode"; btn.disabled=false;
}
function copySmartResult(){
  let t=document.getElementById('smartResult').innerText;
  if(!t){ showToast("⚠️ No result"); return; }
  navigator.clipboard.writeText(t).then(()=>showToast("✅ COPIED!")).catch(()=>{
    let ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast("✅ COPIED!");
  });
}
function doneSmart(){
  document.getElementById('smartResult').classList.add('hidden');
  document.getElementById('smartActions').classList.add('hidden');
  document.getElementById('smartPreview').classList.add('hidden');
  document.getElementById('smartPreview').innerHTML='';
  document.getElementById('smartHint').classList.remove('hidden');
  smartPhotoData=''; document.getElementById('smartPhoto').value=''; document.getElementById('smartVideo').value='';
  window.scrollTo({top:0,behavior:'smooth'});
  showToast("🔄 Cleared");
}
document.getElementById('gradeSel').addEventListener('change',e=>{
  let v=e.target.value;
  let badge=document.getElementById('levelBadge');
  if(v.includes('PP')){ badge.innerText='PP1-PP2 • COLORFUL 🎨'; badge.className='bg-[#ff8a2a] text-white border-2 border-black px-3 py-1 rounded-full text-[8px] font-black'; }
  else if(['Grade 1','Grade 2','Grade 3'].includes(v)){ badge.innerText='Grade 1-3 • BRIGHT 🌈'; badge.className='bg-[#2ac5a0] text-white border-2 border-black px-3 py-1 rounded-full text-[8px] font-black'; }
  else{ badge.innerText='Grade 4-9 • KNEC 📝'; badge.className='bg-[#4a86ff] text-white border-2 border-black px-3 py-1 rounded-full text-[8px] font-black'; }
});
setTimeout(()=>{ const FB=window.FB; FB.onAuthStateChanged(FB.auth, async(u)=>{ if(!u) return; try{ let s=await FB.getDoc(FB.doc(FB.db,"users",u.uid)); if(s.exists()){ let d=s.data(); document.getElementById('teacherIdShow').innerText=d.indexNumber||"SHKET"; document.getElementById('teacherInfo').innerText=(d.subjects||"PP1-Grade9")+" • KNEC"; } }catch(e){} }); },600);
</script>
</body></html>
