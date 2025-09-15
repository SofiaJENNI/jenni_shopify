javascript:(async function(){
  var src = (window.JENNI_EDGE_SRC||'http://localhost:4000/edge/client.js');
  var s = document.createElement('script');
  s.src = src; s.defer = true; document.head.appendChild(s);
  s.onload = async function(){ 
    try{
      var jenni = (window.JenniEdge||{init:function(){}});
      await jenni.init({ 
        tenant:'demo',
        apiBase: 'http://localhost:4000/edge',
        debug: true,
        autoOpenPanel: true,
        keepOpenOnRefresh: true
      });
      // Show success message with detected ZIP
      setTimeout(function(){
        var zip = jenni.config ? jenni.config.zip : 'unknown';
        if(window.JenniEdge && window.JenniEdge.state && window.JenniEdge.state.panelOpen){
          console.log('✅ JENNi loaded! Panel is open. ZIP: ' + zip);
        } else {
          console.log('✅ JENNi loaded! ZIP detected: ' + zip + '. Click the delivery pill to open panel.');
        }
      }, 1500);
    }catch(e){
      console.error('JenniEdge error:', e);
      // Fallback with prompt if auto-detection fails
      try{
        var zip = prompt('ZIP Code for delivery check (auto-detection failed):','60612') || '60612';
        jenni.init({ 
          tenant:'demo', 
          zip: zip, 
          apiBase: 'http://localhost:4000/edge',
          debug: true,
          autoOpenPanel: true,
          keepOpenOnRefresh: true
        });
      }catch(e2){
        alert('JenniEdge init failed: '+e2.message);
      }
    }
  };
})();
