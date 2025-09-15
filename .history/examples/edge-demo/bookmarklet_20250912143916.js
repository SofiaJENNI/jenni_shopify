javascript:(function(){
  var src = (window.JENNI_EDGE_SRC||'http://localhost:4000/edge/client.js');
  var s = document.createElement('script');
  s.src = src; s.defer = true; document.head.appendChild(s);
  s.onload=function(){ 
    try{
      var zip = prompt('ZIP Code for delivery check:','10001') || '10001';
      var jenni = (window.JenniEdge||{init:function(){}});
      jenni.init({ 
        tenant:'demo', 
        zip: zip, 
        apiBase: 'http://localhost:4000/edge',
        debug: true,
        autoOpenPanel: true,
        keepOpenOnRefresh: true
      });
      // Show success message
      setTimeout(function(){
        if(window.JenniEdge && window.JenniEdge.state && window.JenniEdge.state.panelOpen){
          console.log('✅ JENNi loaded! Panel is open.');
        } else {
          console.log('✅ JENNi loaded! Click the delivery pill to open panel.');
        }
      }, 1000);
    }catch(e){
      alert('JenniEdge init failed: '+e.message);
      console.error('JenniEdge error:', e);
    }
  };
})();
