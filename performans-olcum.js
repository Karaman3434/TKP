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

  try{
    if(typeof CustomerData !== "undefined" && typeof CustomerData.listeDegistiginde === "function"){
      CustomerData.listeDegistiginde(function(){ mark("customers_ready"); });
    }else{
      mark("customers_observer_unavailable");
    }
  }catch(e){ mark("customers_observer_unavailable"); }

  try{
    if(typeof ReportsData !== "undefined" && typeof ReportsData.arsivDegistiginde === "function"){
      ReportsData.arsivDegistiginde(function(){ mark("reports_archive_ready"); });
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