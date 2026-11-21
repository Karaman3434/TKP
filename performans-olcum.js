/* TKP Performans Ölçümü — yalnızca test dalı
 * Sürüm: 17.11.2026
 * Amaç: Ana sayfa açılış ve veri-hazır olaylarının sürelerini gözlemlemek.
 * Güvenlik: Firebase çağrısı yapmaz; ağ isteği göndermez; DOM/görsel değiştirmez.
 * Kişisel/veri içeriği kaydetmez. Yalnızca süre ve olay adlarını sessionStorage'a yazar.
 */
(function(){
  "use strict";
  if(window.__TKP_PERF_DIAG__) return;

  var KEY = "tkp_perf_diag_v1";
  var perf = window.performance;
  var report = {
    schema: 1,
    page: "home",
    startedAt: new Date().toISOString(),
    timeOrigin: perf && typeof perf.timeOrigin === "number" ? perf.timeOrigin : Date.now(),
    phases: {},
    events: []
  };

  function persist(){
    try{ sessionStorage.setItem(KEY, JSON.stringify(report)); }catch(e){}
  }

  function mark(name, detail){
    if(!report.phases[name]){
      report.phases[name] = {
        elapsedMs: perf && typeof perf.now === "function" ? Math.round(perf.now()*100)/100 : null,
        detail: detail || null
      };
      report.events.push(name);
      if(report.events.length > 30) report.events.shift();
      persist();
      try{ console.info("[TKP_PERF]", name, report.phases[name].elapsedMs); }catch(e){}
    }
  }

  function navigationTimings(){
    try{
      if(!perf || !perf.getEntriesByType) return;
      var entries = perf.getEntriesByType("navigation");
      if(!entries || !entries.length) return;
      var n = entries[0];
      report.navigation = {
        responseStartMs: Math.round(n.responseStart*100)/100,
        domInteractiveMs: Math.round(n.domInteractive*100)/100,
        domContentLoadedMs: Math.round(n.domContentLoadedEventEnd*100)/100,
        loadEventMs: Math.round(n.loadEventEnd*100)/100
      };
      persist();
    }catch(e){}
  }

  window.__TKP_PERF_DIAG__ = report;
  mark("measurement_script_installed");

  window.addEventListener("istakipAuthHazir", function(){
    mark("auth_ready_event");
  });

  document.addEventListener("DOMContentLoaded", function(){
    mark("dom_content_loaded");
    navigationTimings();
  }, {once:true});

  window.addEventListener("load", function(){
    mark("window_load");
    navigationTimings();
  }, {once:true});

  try{
    if(typeof IsTakipData !== "undefined"){
      IsTakipData.veriDegistiginde(function(){ mark("home_archive_ready"); });
      if(typeof IsTakipData.hazirMi === "function" && IsTakipData.hazirMi()){
        mark("home_archive_ready", "already_ready_at_measurement_install");
      }
    }
  }catch(e){ mark("home_archive_observer_unavailable"); }

  // CustomerData exposes listeDegistiginde, but no hazirMi() getter.
  // Its Firebase value callback dispatches this listener after the customer list loads.
  try{
    if(typeof CustomerData !== "undefined" && typeof CustomerData.listeDegistiginde === "function"){
      CustomerData.listeDegistiginde(function(){ mark("customers_ready", "customer_list_listener_callback"); });
    }else{
      mark("customers_observer_unavailable");
    }
  }catch(e){ mark("customers_observer_unavailable"); }

  // ReportsData listener callback is fired from its archive Firebase value handler.
  try{
    if(typeof ReportsData !== "undefined" && typeof ReportsData.arsivDegistiginde === "function"){
      ReportsData.arsivDegistiginde(function(){ mark("reports_archive_ready", "reports_archive_listener_callback"); });
    }else{
      mark("reports_archive_observer_unavailable");
    }
  }catch(e){ mark("reports_archive_observer_unavailable"); }

  window.addEventListener("pagehide", function(){
    mark("page_hide");
    navigationTimings();
  }, {once:true});

  persist();
})();

// Tanılama verisini kullanıcı tetiklemeli dışa aktarma (Firebase / ağ erişimi yok).
// Sadece ölçüm verisini panoya kopyalamaya yönelik küçük geçici kontrol.
(function(){
  function addExportControl(){
    if(document.getElementById("tkp-perf-export")) return;
    var btn=document.createElement("button");
    btn.id="tkp-perf-export";
    btn.type="button";
    btn.textContent="ÖLÇÜMÜ KOPYALA";
    btn.setAttribute("aria-label","Performans ölçüm verisini kopyala");
    btn.style.cssText="position:fixed;right:10px;bottom:10px;z-index:2147483647;padding:10px 12px;border:1px solid #555;border-radius:8px;background:#222;color:#fff;font:12px sans-serif;opacity:.88;";
    btn.addEventListener("click",function(){
      var data;
      try{data=JSON.stringify(window.__TKP_PERF_DIAG__||JSON.parse(sessionStorage.getItem("tkp_perf_diag_v1")||"{}"),null,2);}catch(e){data="Ölçüm verisi okunamadı.";}
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(data).then(function(){btn.textContent="KOPYALANDI";},function(){fallback(data,btn);});
      }else fallback(data,btn);
    });
    document.body.appendChild(btn);
  }
  function fallback(data,btn){
    var ta=document.createElement("textarea");ta.value=data;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;left:-9999px;top:0;";
    document.body.appendChild(ta);ta.select();
    try{document.execCommand("copy");btn.textContent="KOPYALANDI";}catch(e){btn.textContent="KOPYALAMA HATASI";}
    ta.remove();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",addExportControl,{once:true});else addExportControl();
})();
