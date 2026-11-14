(function(){
  var grid=document.getElementById('grid'); if(!grid) return;
  var cards=[].slice.call(grid.children);
  var FACETS=['status','sig','grade','rb','pb','family','season','house'];
  var MULTI={season:1,family:1,sig:1};
  var KEY={status:'status',sig:'sig',grade:'grade',rb:'rb',pb:'pb',family:'family',season:'season',house:'house'};
  var sel={}; FACETS.forEach(function(f){sel[f]=new Set()});
  var q='', sortKey='r';
  var qInput=document.getElementById('q'), sortSel=document.getElementById('sort');
  function vals(card,f){var v=card.dataset[KEY[f]]||'';return MULTI[f]?(v?v.split('|'):[]):[v]}
  function matchFacet(card,f){var s=sel[f];if(!s.size)return true;var v=vals(card,f);for(var i=0;i<v.length;i++)if(s.has(v[i]))return true;return false}
  function matchQ(card){if(!q)return true;var t=card.dataset.search+' '+card.dataset.housename;return q.split(/\s+/).every(function(w){return t.indexOf(w)>-1})}
  function matches(card,skip){if(!matchQ(card))return false;for(var i=0;i<FACETS.length;i++){var f=FACETS[i];if(f!==skip&&!matchFacet(card,f))return false}return true}
  function num(c,k){return parseFloat(c.dataset[k])}
  var sorters={
    r:function(a,b){return num(b,'r')-num(a,'r')||num(b,'n')-num(a,'n')||a.dataset.name.localeCompare(b.dataset.name)},
    p:function(a,b){return num(b,'p')-num(a,'p')||num(b,'r')-num(a,'r')||a.dataset.name.localeCompare(b.dataset.name)},
    n:function(a,b){return num(b,'n')-num(a,'n')||num(b,'r')-num(a,'r')},
    name:function(a,b){return a.dataset.name.localeCompare(b.dataset.name)},
    house:function(a,b){return a.dataset.housename.localeCompare(b.dataset.housename)},
    added:function(a,b){return b.dataset.added.localeCompare(a.dataset.added)||num(b,'r')-num(a,'r')}
  };
  function render(push){
    var shown=0;
    cards.slice().sort(sorters[sortKey]).forEach(function(c){grid.appendChild(c);var ok=matches(c);c.hidden=!ok;if(ok)shown++});
    document.getElementById('count').textContent=shown;
    document.getElementById('countLbl').textContent=shown===1?'fragrance':'fragrances';
    document.getElementById('empty').hidden=shown>0;
    // live facet counts (other facets applied)
    FACETS.forEach(function(f){
      var counts={};cards.forEach(function(c){if(matches(c,f))vals(c,f).forEach(function(v){counts[v]=(counts[v]||0)+1})});
      document.querySelectorAll('.facet[data-facet="'+f+'"] .fopt').forEach(function(l){
        var v=l.querySelector('input').value,n=counts[v]||0;l.querySelector('.fcount').textContent=n;l.classList.toggle('zero',n===0&&!sel[f].has(v))});
    });
    // chips
    var chips=document.getElementById('chips');chips.innerHTML='';
    if(q){addChip('Search: '+q,function(){q='';if(qInput)qInput.value='';render(true)})}
    FACETS.forEach(function(f){sel[f].forEach(function(v){
      var lab=document.querySelector('.facet[data-facet="'+f+'"] input[value="'+CSS.escape(v)+'"]');
      var t=lab?lab.parentNode.querySelector('.ftxt').textContent:v;
      addChip(t,function(){sel[f].delete(v);if(lab)lab.checked=false;render(true)})})});
    if(push)syncURL();
    var only=function(f,v){return sel[f].size===1&&sel[f].has(v)&&FACETS.every(function(g){return g===f||!sel[g].size})&&!q};
    var key=only('grade','Alpha')?'Alpha':only('grade','Beta')?'Beta':only('grade','Gamma')?'Gamma':only('status','prospective')?'prospective':'catalogue';
    document.querySelectorAll('.catnav a').forEach(function(a){a.classList.toggle('on',a.dataset.k===key)});
  }
  function addChip(t,fn){var b=document.createElement('button');b.type='button';b.className='chip';b.textContent=t;b.onclick=fn;document.getElementById('chips').appendChild(b)}
  function syncURL(){var p=new URLSearchParams();if(q)p.set('q',q);FACETS.forEach(function(f){sel[f].forEach(function(v){p.append(f,v)})});if(sortKey!=='r')p.set('sort',sortKey);
    var s=p.toString();history.replaceState(null,'',location.pathname+(s?'?'+s:''))}
  function readURL(){var p=new URLSearchParams(location.search);q=(p.get('q')||'').trim().toLowerCase();if(qInput)qInput.value=p.get('q')||'';
    FACETS.forEach(function(f){p.getAll(f).forEach(function(v){sel[f].add(v);var i=document.querySelector('.facet[data-facet="'+f+'"] input[value="'+CSS.escape(v)+'"]');if(i)i.checked=true})});
    if(p.get('sort')&&sorters[p.get('sort')]){sortKey=p.get('sort');sortSel.value=sortKey}}
  document.querySelectorAll('.facet input[type=checkbox]').forEach(function(i){i.addEventListener('change',function(){
    var f=i.name;if(i.checked)sel[f].add(i.value);else sel[f].delete(i.value);render(true)})});
  sortSel.addEventListener('change',function(){sortKey=sortSel.value;render(true)});
  var form=document.querySelector('form.search');
  if(form){form.addEventListener('submit',function(e){e.preventDefault();q=qInput.value.trim().toLowerCase();render(true)});
    qInput.addEventListener('input',function(){q=qInput.value.trim().toLowerCase();render(true)})}
  function clearAll(){q='';if(qInput)qInput.value='';FACETS.forEach(function(f){sel[f].clear()});document.querySelectorAll('.facet input[type=checkbox]').forEach(function(i){i.checked=false});document.querySelectorAll('.fsearch').forEach(function(s){s.value='';filterOpts(s)});render(true)}
  document.getElementById('clearAll').onclick=clearAll;document.getElementById('clearAll2').onclick=clearAll;
  document.getElementById('openF').onclick=function(){document.body.classList.add('fopen')};
  document.getElementById('closeF').onclick=document.getElementById('scrim').onclick=function(){document.body.classList.remove('fopen')};
  // brand search box: narrows the option list (checked brands always stay visible)
  function filterOpts(s){var t=s.value.trim().toLowerCase();s.parentNode.querySelectorAll('.fopt').forEach(function(l){var i=l.querySelector('input');l.classList.toggle('fhide',!!t&&!i.checked&&l.querySelector('.ftxt').textContent.toLowerCase().indexOf(t)<0)})}
  document.querySelectorAll('.fsearch').forEach(function(s){s.addEventListener('input',function(){filterOpts(s)});s.addEventListener('keydown',function(e){if(e.key==='Enter')e.preventDefault()})});
  // highlight nav for preset filters
  readURL();render(false);
})();
