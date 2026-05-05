import com.pegusapps.jctep.*;
import com.pegusapps.jctep.transaction.sale.*;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class WorldlineCtepBrowserBridge implements ServiceListener, ServiceNotificationsListener {
    private volatile Service service;
    private volatile Terminal connectedTerminal;
    private volatile boolean serviceStarted = false;
    private final int ctepPort;
    private final int httpPort;
    private final File logFile = new File("logs/ctep-browser-bridge.log");

    private volatile Map<String,Object> terminalSnapshot = new LinkedHashMap<>();
    private final ExecutorService httpExecutor = Executors.newCachedThreadPool();
    private final ExecutorService txExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean transactionBusy = new AtomicBoolean(false);
    private volatile Map<String,Object> lastTransaction = txState("none", "No transaction yet");

    public WorldlineCtepBrowserBridge(int ctepPort, int httpPort) {
        this.ctepPort = ctepPort;
        this.httpPort = httpPort;
    }

    public static void main(String[] args) throws Exception {
        int ctepPort = getIntArg(args, "--ctep-port", 9000);
        int httpPort = getIntArg(args, "--http-port", 3210);
        WorldlineCtepBrowserBridge bridge = new WorldlineCtepBrowserBridge(ctepPort, httpPort);
        bridge.startCtepService();
        bridge.startHttpServer();
        bridge.log("READY. C-TEP listener=0.0.0.0:" + ctepPort + " | Browser UI=http://localhost:" + httpPort + "/");
        bridge.log("Terminal must point to THIS PC IP on port " + ctepPort + ". Browser/POS uses localhost:" + httpPort + ".");
        Thread.currentThread().join();
    }

    private static int getIntArg(String[] args, String name, int def) {
        for (int i = 0; i < args.length - 1; i++) if (name.equalsIgnoreCase(args[i])) try { return Integer.parseInt(args[i+1]); } catch(Exception ignored) {}
        return def;
    }

    private synchronized void startCtepService() {
        if (service != null && serviceStarted) return;
        log("Starting C-TEP listener on 0.0.0.0:" + ctepPort + " ...");
        service = ServiceFactory.createTcpIpService(ctepPort, this, this);
        service.startService();
    }

    private synchronized void stopCtepService() {
        if (service != null) { log("Stopping C-TEP service ..."); service.stopService(); }
    }

    private void startHttpServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", httpPort), 0);
        server.createContext("/", ex -> { if (preflight(ex)) return; String path=ex.getRequestURI().getPath(); if ("/".equals(path)||"/index.html".equals(path)) html(ex,200,INDEX_HTML); else json(ex,404,err("Not found")); });
        server.createContext("/ping", ex -> { if (preflight(ex)) return; json(ex,200,"{\"ok\":true,\"message\":\"bridge_alive\"}"); });
        server.createContext("/status", ex -> { if (preflight(ex)) return; json(ex,200,toJson(statusMap())); });
        server.createContext("/transaction", ex -> { if (preflight(ex)) return; json(ex,200,toJson(lastTransaction)); });
        server.createContext("/service/start", ex -> { if (preflight(ex)) return; if(!post(ex))return; startCtepService(); json(ex,200,"{\"ok\":true,\"message\":\"service_start_requested\"}"); });
        server.createContext("/service/stop", ex -> { if (preflight(ex)) return; if(!post(ex))return; stopCtepService(); json(ex,200,"{\"ok\":true,\"message\":\"service_stop_requested\"}"); });
        server.createContext("/cancel", ex -> { if (preflight(ex)) return; if(!post(ex))return; try { if(connectedTerminal!=null){connectedTerminal.resetTransaction(); log("resetTransaction sent");} transactionBusy.set(false); lastTransaction=txState("cancel_requested","Cancel/reset requested"); json(ex,200,toJson(lastTransaction)); } catch(Exception e){ json(ex,500,err(e.toString())); } });
        server.createContext("/sale", this::handleSaleAsync);
        server.createContext("/sale-sync", this::handleSaleSync);
        server.setExecutor(httpExecutor);
        server.start();
    }

    private Map<String,Object> statusMap() {
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("ok", true);
        m.put("serviceStarted", serviceStarted);
        m.put("ctepPort", ctepPort);
        m.put("httpPort", httpPort);
        boolean connected = connectedTerminal != null && connectedTerminal.isConnected();
        m.put("terminalConnected", connected);
        m.putAll(terminalSnapshot);
        m.put("transactionBusy", transactionBusy.get());
        m.put("lastTransactionStatus", String.valueOf(lastTransaction.get("status")));
        return m;
    }

    private void handleSaleAsync(HttpExchange ex) throws IOException {
        if (preflight(ex)) return; if(!post(ex)) return;
        if (connectedTerminal == null || !connectedTerminal.isConnected()) { json(ex,409,err("No terminal connected")); return; }
        if (!transactionBusy.compareAndSet(false, true)) { json(ex,409,err("Transaction already running. Use /transaction to poll or /cancel.")); return; }
        String body = readBody(ex);
        double amount = getDouble(body,"amount",-1);
        String reference = getString(body,"reference","POS-"+System.currentTimeMillis());
        int timeoutSec = (int)getDouble(body,"timeoutSec",180);
        if (amount <= 0) { transactionBusy.set(false); json(ex,400,err("amount must be > 0")); return; }
        String txId = "TX-" + System.currentTimeMillis();
        lastTransaction = txState("running", "Transaction sent to terminal");
        lastTransaction.put("txId", txId); lastTransaction.put("amount", amount); lastTransaction.put("reference", reference);
        log("SALE async requested txId="+txId+" amount="+amount+" reference="+reference);
        txExecutor.submit(() -> runSale(amount, reference, timeoutSec, txId));
        Map<String,Object> accepted = new LinkedHashMap<>();
        accepted.put("ok", true); accepted.put("accepted", true); accepted.put("txId", txId); accepted.put("message", "Sale started. Poll /transaction for result.");
        json(ex,202,toJson(accepted));
    }

    private void handleSaleSync(HttpExchange ex) throws IOException {
        if (preflight(ex)) return; if(!post(ex)) return;
        if (connectedTerminal == null || !connectedTerminal.isConnected()) { json(ex,409,err("No terminal connected")); return; }
        if (!transactionBusy.compareAndSet(false, true)) { json(ex,409,err("Transaction already running")); return; }
        String body = readBody(ex);
        double amount = getDouble(body,"amount",-1);
        String reference = getString(body,"reference","POS-"+System.currentTimeMillis());
        int timeoutSec = (int)getDouble(body,"timeoutSec",180);
        if (amount <= 0) { transactionBusy.set(false); json(ex,400,err("amount must be > 0")); return; }
        String txId = "TX-" + System.currentTimeMillis();
        runSale(amount, reference, timeoutSec, txId);
        json(ex,200,toJson(lastTransaction));
    }

    private void runSale(double amount, String reference, int timeoutSec, String txId) {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<SaleResult> resultRef = new AtomicReference<>();
        AtomicReference<Exception> exceptionRef = new AtomicReference<>();
        try {
            lastTransaction = txState("running", "Waiting for terminal result");
            lastTransaction.put("txId", txId); lastTransaction.put("amount", amount); lastTransaction.put("reference", reference);
            SaleTransaction tx = new SaleTransaction(amount, reference, result -> { resultRef.set(result); latch.countDown(); });
            tx.send(connectedTerminal);
            boolean done = latch.await(timeoutSec, TimeUnit.SECONDS);
            if (!done) { lastTransaction = txState("timeout", "Timeout waiting for terminal result"); lastTransaction.put("txId", txId); log("SALE timeout txId="+txId); return; }
            if (exceptionRef.get() != null) { lastTransaction = txState("error", exceptionRef.get().toString()); lastTransaction.put("txId", txId); log("SALE exception txId="+txId+" " + exceptionRef.get()); return; }
            SaleResult r = resultRef.get();
            if (r == null) { lastTransaction = txState("error", "No result object returned"); lastTransaction.put("txId", txId); return; }
            lastTransaction = saleResultMap(r, reference, txId);
            log("SALE result txId="+txId+" " + toJson(lastTransaction));
        } catch(Exception e) {
            lastTransaction = txState("error", e.toString()); lastTransaction.put("txId", txId); log("SALE exception txId="+txId+" " + e);
        } finally {
            transactionBusy.set(false);
        }
    }

    private static Map<String,Object> txState(String status, String message) { Map<String,Object> m=new LinkedHashMap<>(); m.put("ok", !"error".equals(status) && !"timeout".equals(status)); m.put("status", status); m.put("message", message); m.put("timestamp", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date())); return m; }

    private Map<String,Object> saleResultMap(SaleResult r, String reference, String txId) {
        Map<String,Object> m = txState(r.getError()==null ? "done" : "declined_or_error", r.getError()==null ? "Terminal result received" : String.valueOf(r.getError()));
        boolean approved = r.getError() == null;
        m.put("txId", txId); m.put("approved", approved); m.put("reference", reference);
        m.put("terminalId", safe(r.getTerminalIdentifier())); m.put("authorizedAmount", r.getAuthorizedAmount());
        m.put("authorizationCode", safe(r.getAuthorizationCode())); m.put("cardBrandName", safe(r.getCardBrandName()));
        m.put("cardBrandIdentifier", safe(r.getCardBrandIdentifier())); m.put("clippedPAN", safe(r.getClippedPAN()));
        m.put("merchantText", safe(r.getMerchantText())); m.put("signatureRequired", r.isSignatureRequired());
        m.put("partialApproval", r.isPartialApproval()); m.put("backupMode", r.isBackupMode());
        m.put("clientTicket", safe(r.getClientTicket())); m.put("merchantTicket", safe(r.getMerchantTicket()));
        if (r.getTimestamp() != null) m.put("terminalTimestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").format(r.getTimestamp()));
        if (r.getError() != null) m.put("error", safe(r.getError().toString()));
        return m;
    }

    @Override public void onServiceStart() { serviceStarted = true; log("C-TEP service started. Waiting for terminal connection..."); }
    @Override public void onServiceStop() { serviceStarted = false; connectedTerminal = null; terminalSnapshot = new LinkedHashMap<>(); log("C-TEP service stopped"); }
    @Override public void onTerminalConnect(Terminal terminal) { connectedTerminal = terminal; Map<String,Object> snap=new LinkedHashMap<>(); try{snap.put("terminalId", safe(terminal.getTerminalId()));}catch(Exception ignored){} try{snap.put("model", safe(terminal.getModel()));}catch(Exception ignored){} try{snap.put("serialNumber", safe(terminal.getSerialNumber()));}catch(Exception ignored){} try{snap.put("softwareVersion", safe(terminal.getSoftwareVersion()));}catch(Exception ignored){} try{snap.put("connection", safe(terminal.getConnectionDescription()));}catch(Exception ignored){} terminalSnapshot=snap; log("Terminal connected: " + toJson(snap)); }
    @Override public void onTerminalDisconnect(Terminal terminal) { connectedTerminal = null; terminalSnapshot = new LinkedHashMap<>(); log("Terminal disconnected"); }
    @Override public void onTerminalEvent(TerminalEvent terminalEvent) { log("Terminal event: " + terminalEvent); }

    private boolean post(HttpExchange ex) throws IOException { if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) { json(ex,405,err("POST required")); return false; } return true; }
    private boolean preflight(HttpExchange ex) throws IOException { if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) { cors(ex); ex.sendResponseHeaders(204, -1); return true; } return false; }
    private static String readBody(HttpExchange ex) throws IOException { try(InputStream is=ex.getRequestBody(); ByteArrayOutputStream bos=new ByteArrayOutputStream()) { byte[] buf=new byte[4096]; int n; while((n=is.read(buf))>0) bos.write(buf,0,n); return new String(bos.toByteArray(), StandardCharsets.UTF_8); } }
    private static double getDouble(String json, String key, double def) { try { java.util.regex.Matcher m=java.util.regex.Pattern.compile("\\\""+key+"\\\"\\s*:\\s*([-0-9.]+)").matcher(json); return m.find()?Double.parseDouble(m.group(1)):def; } catch(Exception e){return def;} }
    private static String getString(String json, String key, String def) { try { java.util.regex.Matcher m=java.util.regex.Pattern.compile("\\\""+key+"\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"").matcher(json); return m.find()?m.group(1):def; } catch(Exception e){return def;} }
    private static void json(HttpExchange ex, int code, String text) throws IOException { byte[] b=text.getBytes(StandardCharsets.UTF_8); cors(ex); ex.getResponseHeaders().add("Content-Type","application/json; charset=utf-8"); ex.sendResponseHeaders(code,b.length); try(OutputStream os=ex.getResponseBody()){os.write(b);} }
    private static void html(HttpExchange ex, int code, String text) throws IOException { byte[] b=text.getBytes(StandardCharsets.UTF_8); cors(ex); ex.getResponseHeaders().add("Content-Type","text/html; charset=utf-8"); ex.sendResponseHeaders(code,b.length); try(OutputStream os=ex.getResponseBody()){os.write(b);} }
    private static void cors(HttpExchange ex) { ex.getResponseHeaders().add("Access-Control-Allow-Origin","*"); ex.getResponseHeaders().add("Access-Control-Allow-Methods","GET,POST,OPTIONS"); ex.getResponseHeaders().add("Access-Control-Allow-Headers","Content-Type"); }
    private static String err(String msg) { return "{\"ok\":false,\"error\":" + quote(msg) + "}"; }
    private static String safe(String s) { return s == null ? "" : s; }
    private static String quote(String s) { return "\"" + safe(s).replace("\\","\\\\").replace("\"","\\\"").replace("\r","\\r").replace("\n","\\n") + "\""; }
    private static String toJson(Map<String,Object> m) { StringBuilder sb=new StringBuilder("{"); boolean first=true; for (Map.Entry<String,Object> e:m.entrySet()) { if(!first) sb.append(','); first=false; sb.append(quote(e.getKey())).append(':'); Object v=e.getValue(); if(v instanceof Number || v instanceof Boolean) sb.append(v); else sb.append(quote(String.valueOf(v))); } return sb.append('}').toString(); }
    private synchronized void log(String s) { String line=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()) + "  " + s; System.out.println(line); try { logFile.getParentFile().mkdirs(); try(FileWriter fw=new FileWriter(logFile,true)){fw.write(line + System.lineSeparator());} } catch(Exception ignored){} }

    private static final String INDEX_HTML = """
<!doctype html><html lang='nl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Worldline C-TEP Browser Test</title><style>
body{font-family:Arial,sans-serif;margin:30px;background:#f5f5f5;color:#111}.box{background:white;border-radius:12px;padding:18px;margin-bottom:16px;box-shadow:0 2px 10px #0001}button{padding:12px 18px;border:0;border-radius:8px;background:#111;color:#fff;cursor:pointer;margin:4px}button.secondary{background:#666}button.danger{background:#b00020}input{padding:10px;border:1px solid #ccc;border-radius:8px;margin:4px}.ok{color:#0a7a2f}.bad{color:#b00020}pre{background:#111;color:#0f0;padding:12px;border-radius:8px;white-space:pre-wrap;min-height:130px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
</style></head><body><h1>Worldline C-TEP Browser Test - non blocking</h1><div class='box'><b>Flow:</b> Terminal → PC-IP:9000. Browser/POS → localhost:3210. Betaling start async zodat de pagina niet bevriest.</div><div class='grid'><div class='box'><h2>Status</h2><button type='button' onclick='uiStatus()'>Status opvragen</button><button type='button' onclick='uiPing()' class='secondary'>Ping bridge</button><button type='button' class='secondary' onclick='uiStartSvc()'>Service start</button><button type='button' class='secondary' onclick='uiStopSvc()'>Service stop</button><div id='statusView'>Nog niet getest</div></div><div class='box'><h2>Betaling</h2><label>Bedrag €</label><input id='amount' type='number' step='0.01' value='1.00'><br><label>Referentie</label><input id='reference' value='POS-TEST-001'><br><button type='button' onclick='uiSale()'>Start betaling</button><button type='button' class='danger' onclick='uiCancelTx()'>Cancel/reset</button><button type='button' class='secondary' onclick='uiTransaction()'>Laatste transactie</button><div id='txView'></div></div></div><div class='box'><h2>Log</h2><pre id='log'></pre></div><script>
window.onerror=function(msg,src,line,col,err){try{document.getElementById('log').textContent='JS FOUT: '+msg+' regel '+line+'\n'+document.getElementById('log').textContent}catch(e){alert('JS FOUT: '+msg)}};
const API = location.origin; let poll=null; function add(s){const d=new Date().toLocaleTimeString(); document.getElementById('log').textContent='['+d+'] '+s+'\n'+document.getElementById('log').textContent}
async function call(path, opts={}){try{const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),5000); opts.signal=controller.signal; const r=await fetch(API+path,opts); clearTimeout(timeout); const t=await r.text(); let j; try{j=JSON.parse(t)}catch{j={raw:t}}; add(path+' -> HTTP '+r.status+' '+JSON.stringify(j)); return j}catch(e){add(path+' -> FOUT '+e.message); return {ok:false,error:e.message}}}
async function uiPing(){await call('/ping')} async function uiStatus(){const j=await call('/status'); document.getElementById('statusView').innerHTML = j.terminalConnected ? '<p class=ok>Terminal verbonden</p><pre>'+JSON.stringify(j,null,2)+'</pre>' : '<p class=bad>Geen terminal verbonden</p><pre>'+JSON.stringify(j,null,2)+'</pre>'}
async function uiTransaction(){const j=await call('/transaction'); document.getElementById('txView').innerHTML='<pre>'+JSON.stringify(j,null,2)+'</pre>'; return j}
async function uiStartSvc(){await call('/service/start',{method:'POST'}); await uiStatus()} async function uiStopSvc(){await call('/service/stop',{method:'POST'}); await uiStatus()}
async function uiSale(){const amount=Number(document.getElementById('amount').value); const reference=document.getElementById('reference').value; add('Betaling starten '+amount+' ref='+reference); const j=await call('/sale',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,reference,timeoutSec:180})}); await uiStatus(); if(j.accepted){ if(poll) clearInterval(poll); poll=setInterval(async()=>{const t=await uiTransaction(); if(t.status && t.status!=='running'){clearInterval(poll); poll=null;}},1500);} }
async function uiCancelTx(){await call('/cancel',{method:'POST'}); await uiTransaction(); await uiStatus()} window.addEventListener('load',()=>{add('UI geladen. Klik op Ping bridge of Status opvragen.'); uiStatus(); uiTransaction();});
</script></body></html>
""";
}
