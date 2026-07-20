let publications=[
 {c:'extreme',t:'Increasing global precipitation whiplash due to anthropogenic greenhouse gas emissions',a:'<strong>Xuezhi Tan</strong># et al.',j:'Nature Communications 14, 2796 (2023)',u:'https://www.nature.com/articles/s41467-023-38510-9'},
 {c:'extreme',t:'Thermodynamically enhanced precipitation extremes due to counterbalancing influences of anthropogenic greenhouse gases and aerosols',a:'Z. Huang#, <strong>Xuezhi Tan</strong>*# et al.',j:'Nature Water 1, 614–625 (2023)',u:'https://www.nature.com/articles/s44221-023-00107-3'},
 {c:'hazards',t:'Increased dependency of regional drought termination on landfalling tropical cyclones',a:'Y. Liu, <strong>Xuezhi Tan</strong>* et al.',j:'Communications Earth & Environment 6, 566 (2025)',u:'https://www.nature.com/articles/s43247-025-02564-y'},
 {c:'extreme',t:'Dynamics-constrained rainfall projection reveals substantial increase in population exposure to unprecedented floods in the North China Plain',a:'L. Yang et al., <strong>Xuezhi Tan</strong>',j:'Communications Earth & Environment 6, 482 (2025)',u:'https://www.nature.com/articles/s43247-025-02457-0'},
 {c:'water',t:'Combined impacts of climate change and human activities on blue and green water resources in a high-intensity development watershed',a:'X. Tan, B. Liu, <strong>Xuezhi Tan</strong>* et al.',j:'Hydrology and Earth System Sciences 29, 427–445 (2025)',u:'https://hess.copernicus.org/articles/29/427/2025/'},
 {c:'agri',t:'Impacts of changes in climate extremes on maize yields over Mainland China',a:'S. Deng, <strong>Xuezhi Tan</strong>* & B. Liu',j:'Food Security (2024)',u:'https://link.springer.com/article/10.1007/s12571-024-01501-9'},
 {c:'hazards',t:'Decreasing dynamic predictability of global agricultural drought with warming climate',a:'H. Wu et al., <strong>Xuezhi Tan</strong>',j:'Nature Climate Change 15, 411–419 (2025)',u:'https://scholar.google.com/citations?view_op=view_citation&user=nB2d3vgAAAAJ&citation_for_view=nB2d3vgAAAAJ:dshw04ExmUIC'},
 {c:'water',t:'Long-term water imbalances of watersheds resulting from biases in hydroclimatic data sets for water budget analyses',a:'X. Tan, B. Liu, <strong>Xuezhi Tan</strong>*, X. Chen',j:'Water Resources Research 58, e2021WR031209 (2022)',u:'https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2021WR031209'},
 {c:'energy',t:'Deep Learning-Based Evaluation of Offshore Wind Energy Resources in Southeastern China for the Future',a:'C. Lai et al., <strong>Xuezhi Tan</strong>',j:'Energies 19, 1447 (2026)',u:'https://doi.org/10.3390/en19061447'},
 {c:'energy',t:'Impact of Large-Scale Meteorological Patterns on Offshore Wind Energy Variability and Extreme Wind Events in China',a:'T. Zhang, <strong>Xuezhi Tan</strong> et al.',j:'International Journal of Climatology (2026)',u:'https://scholar.google.com/citations?user=nB2d3vgAAAAJ'},
];
const list=document.querySelector('#publication-list');
const escapeHtml=value=>String(value||'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const authorMarkup=value=>escapeHtml(value).replace(/Xuezhi Tan/gi,'<strong>Xuezhi Tan</strong>');
function draw(filter='all'){list.innerHTML=publications.filter(p=>filter==='all'||p.c===filter).map(p=>`<article class="publication"><div class="meta">${p.c.toUpperCase()}</div><div><h3><a target="_blank" rel="noreferrer" href="${p.u}">${p.t} ↗</a></h3><p>${p.a}. <em>${p.j}</em>${p.n!==undefined?` · ${Number(p.n).toLocaleString()} citations`:''}</p></div></article>`).join('')}
document.querySelectorAll('.filters button').forEach(b=>b.addEventListener('click',()=>{document.querySelector('.filters .active').classList.remove('active');b.classList.add('active');draw(b.dataset.filter)}));draw();document.querySelector('#year').textContent=new Date().getFullYear();
const header=document.querySelector('.site-header'),menu=document.querySelector('.menu-button');menu.addEventListener('click',()=>{const open=header.classList.toggle('open');menu.setAttribute('aria-expanded',open)});

// This file is refreshed by GitHub Actions each Sunday from the public Scholar profile.
fetch('data/scholar-stats.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(s=>{
 const metrics=document.querySelector('#scholar-metrics'),updated=document.querySelector('#scholar-updated');
 if(metrics) metrics.textContent=`${Number(s.citations).toLocaleString()} citations · h-index ${s.h_index}`;
 if(updated&&s.updated_at) updated.textContent=`Last checked ${new Date(s.updated_at).toLocaleDateString('en-CA')} · weekly refresh`;
}).catch(()=>{});

fetch('data/scholar-publications.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
 if(!Array.isArray(data.publications)||!data.publications.length) return;
 publications=data.publications.map(p=>({
   c:p.category||'water',t:escapeHtml(p.title),a:authorMarkup(p.authors),
   j:escapeHtml([p.venue,p.year].filter(Boolean).join(' · ')),u:p.url||'https://scholar.google.com/citations?user=nB2d3vgAAAAJ',n:p.citations
 }));
 draw(document.querySelector('.filters .active')?.dataset.filter||'all');
 const label=document.querySelector('#publication-updated');
 if(label&&data.updated_at) label.textContent=`Last checked ${new Date(data.updated_at).toLocaleDateString('en-CA')} · ${publications.length} Scholar records`;
}).catch(()=>{});
