(function(){
  document.getElementById('theme').addEventListener('click',function(){
    var t=document.documentElement.dataset.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=t;
    document.querySelector('meta[name=theme-color]').content=t==='dark'?'#0a1019':'#f3f6fc';
    try{localStorage.setItem('cl-theme',t)}catch(e){}
  });
  var b=document.querySelector('.burger'),m=document.getElementById('menu');
  b.addEventListener('click',function(){var o=m.classList.toggle('open');b.setAttribute('aria-expanded',o)});
  m.addEventListener('click',function(e){if(e.target.tagName==='A'){m.classList.remove('open');b.setAttribute('aria-expanded',false)}});
  var lb=document.getElementById('lb'),li=lb.querySelector('img');
  function close(){lb.hidden=true}
  document.querySelectorAll('.gallery img').forEach(function(i){
    i.addEventListener('click',function(){li.src=i.src;li.alt=i.alt;lb.hidden=false});
  });
  lb.addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
})();
