require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.BandwidthApproximator=void 0;const SMOOTH_INTERVAL=15*1000;const MEASURE_INTERVAL=60*1000;class NumberWithTime{constructor(value,timeStamp){this.value=value;this.timeStamp=timeStamp;}}
class BandwidthApproximator{constructor(){this.lastBytes=[];this.currentBytesSum=0;this.lastBandwidth=[];this.addBytes=(bytes,timeStamp)=>{this.lastBytes.push(new NumberWithTime(bytes,timeStamp));this.currentBytesSum+=bytes;while(timeStamp-this.lastBytes[0].timeStamp>SMOOTH_INTERVAL){this.currentBytesSum-=this.lastBytes.shift().value;}
const interval=Math.min(SMOOTH_INTERVAL,timeStamp);this.lastBandwidth.push(new NumberWithTime(this.currentBytesSum/interval,timeStamp));};this.getBandwidth=(timeStamp)=>{while(this.lastBandwidth.length!==0&&timeStamp-this.lastBandwidth[0].timeStamp>MEASURE_INTERVAL){this.lastBandwidth.shift();}
let maxBandwidth=0;for(const bandwidth of this.lastBandwidth){if(bandwidth.value>maxBandwidth){maxBandwidth=bandwidth.value;}}
return maxBandwidth;};this.getSmoothInterval=()=>{return SMOOTH_INTERVAL;};this.getMeasureInterval=()=>{return MEASURE_INTERVAL;};}}
exports.BandwidthApproximator=BandwidthApproximator;},{}],2:[function(require,module,exports){"use strict";var __createBinding=(this&&this.__createBinding)||(Object.create?(function(o,m,k,k2){if(k2===undefined)k2=k;Object.defineProperty(o,k2,{enumerable:true,get:function(){return m[k];}});}):(function(o,m,k,k2){if(k2===undefined)k2=k;o[k2]=m[k];}));var __setModuleDefault=(this&&this.__setModuleDefault)||(Object.create?(function(o,v){Object.defineProperty(o,"default",{enumerable:true,value:v});}):function(o,v){o["default"]=v;});var __importStar=(this&&this.__importStar)||function(mod){if(mod&&mod.__esModule)return mod;var result={};if(mod!=null)for(var k in mod)if(k!=="default"&&Object.prototype.hasOwnProperty.call(mod,k))__createBinding(result,mod,k);__setModuleDefault(result,mod);return result;};Object.defineProperty(exports,"__esModule",{value:true});const p2pml=__importStar(require("./index"));if(!window.p2pml){window.p2pml={};}
window.p2pml.core=p2pml;},{"./index":"p2p-media-loader-core"}],3:[function(require,module,exports){"use strict";var __importDefault=(this&&this.__importDefault)||function(mod){return(mod&&mod.__esModule)?mod:{"default":mod};};Object.defineProperty(exports,"__esModule",{value:true});exports.HttpMediaManager=void 0;const debug_1=__importDefault(require("debug"));const stringly_typed_event_emitter_1=require("./stringly-typed-event-emitter");class HttpMediaManager extends stringly_typed_event_emitter_1.STEEmitter{constructor(settings){super();this.settings=settings;this.xhrRequests=new Map();this.failedSegments=new Map();this.debug=debug_1.default("p2pml:http-media-manager");this.download=(segment,downloadedPieces)=>{if(this.isDownloading(segment)){return;}
this.cleanTimedOutFailedSegments();const segmentUrl=this.settings.segmentUrlBuilder?this.settings.segmentUrlBuilder(segment):segment.url;this.debug("http segment download",segmentUrl);segment.requestUrl=segmentUrl;const xhr=new XMLHttpRequest();xhr.open("GET",segmentUrl,true);xhr.responseType="arraybuffer";if(segment.range){xhr.setRequestHeader("Range",segment.range);downloadedPieces=undefined;}
else if(downloadedPieces!==undefined&&this.settings.httpUseRanges){let bytesDownloaded=0;for(const piece of downloadedPieces){bytesDownloaded+=piece.byteLength;}
xhr.setRequestHeader("Range",`bytes=${bytesDownloaded}-`);this.debug("continue download from",bytesDownloaded);}
else{downloadedPieces=undefined;}
this.setupXhrEvents(xhr,segment,downloadedPieces);if(this.settings.xhrSetup){this.settings.xhrSetup(xhr,segmentUrl);}
this.xhrRequests.set(segment.id,{xhr,segment});xhr.send();};this.abort=(segment)=>{const request=this.xhrRequests.get(segment.id);if(request){request.xhr.abort();this.xhrRequests.delete(segment.id);this.debug("http segment abort",segment.id);}};this.isDownloading=(segment)=>{return this.xhrRequests.has(segment.id);};this.isFailed=(segment)=>{const time=this.failedSegments.get(segment.id);return time!==undefined&&time>this.now();};this.getActiveDownloads=()=>{return this.xhrRequests;};this.getActiveDownloadsCount=()=>{return this.xhrRequests.size;};this.destroy=()=>{this.xhrRequests.forEach((request)=>request.xhr.abort());this.xhrRequests.clear();};this.setupXhrEvents=(xhr,segment,downloadedPieces)=>{let prevBytesLoaded=0;xhr.addEventListener("progress",(event)=>{const bytesLoaded=event.loaded-prevBytesLoaded;this.emit("bytes-downloaded",bytesLoaded);prevBytesLoaded=event.loaded;});xhr.addEventListener("load",async(event)=>{if(xhr.status<200||xhr.status>=300){this.segmentFailure(segment,event,xhr);return;}
let data=xhr.response;if(downloadedPieces!==undefined&&xhr.status===206){let bytesDownloaded=0;for(const piece of downloadedPieces){bytesDownloaded+=piece.byteLength;}
const segmentData=new Uint8Array(bytesDownloaded+data.byteLength);let offset=0;for(const piece of downloadedPieces){segmentData.set(new Uint8Array(piece),offset);offset+=piece.byteLength;}
segmentData.set(new Uint8Array(data),offset);data=segmentData.buffer;}
await this.segmentDownloadFinished(segment,data,xhr);});xhr.addEventListener("error",(event)=>{this.segmentFailure(segment,event,xhr);});xhr.addEventListener("timeout",(event)=>{this.segmentFailure(segment,event,xhr);});};this.segmentDownloadFinished=async(segment,data,xhr)=>{segment.responseUrl=xhr.responseURL===null?undefined:xhr.responseURL;if(this.settings.segmentValidator){try{await this.settings.segmentValidator(Object.assign(Object.assign({},segment),{data:data}),"http");}
catch(error){this.debug("segment validator failed",error);this.segmentFailure(segment,error,xhr);return;}}
this.xhrRequests.delete(segment.id);this.emit("segment-loaded",segment,data);};this.segmentFailure=(segment,error,xhr)=>{segment.responseUrl=xhr.responseURL===null?undefined:xhr.responseURL;this.xhrRequests.delete(segment.id);this.failedSegments.set(segment.id,this.now()+this.settings.httpFailedSegmentTimeout);this.emit("segment-error",segment,error);};this.cleanTimedOutFailedSegments=()=>{const now=this.now();const candidates=[];this.failedSegments.forEach((time,id)=>{if(time<now){candidates.push(id);}});candidates.forEach((id)=>this.failedSegments.delete(id));};this.now=()=>performance.now();}}
exports.HttpMediaManager=HttpMediaManager;},{"./stringly-typed-event-emitter":9,"debug":"debug"}],4:[function(require,module,exports){"use strict";var __importDefault=(this&&this.__importDefault)||function(mod){return(mod&&mod.__esModule)?mod:{"default":mod};};Object.defineProperty(exports,"__esModule",{value:true});exports.HybridLoader=void 0;const debug_1=__importDefault(require("debug"));const events_1=require("events");const simple_peer_1=__importDefault(require("simple-peer"));const loader_interface_1=require("./loader-interface");const http_media_manager_1=require("./http-media-manager");const p2p_media_manager_1=require("./p2p-media-manager");const media_peer_1=require("./media-peer");const bandwidth_approximator_1=require("./bandwidth-approximator");const segments_memory_storage_1=require("./segments-memory-storage");const defaultSettings={cachedSegmentExpiration:5*60*1000,cachedSegmentsCount:30,useP2P:true,consumeOnly:false,requiredSegmentsPriority:1,simultaneousHttpDownloads:2,httpDownloadProbability:0.1,httpDownloadProbabilityInterval:1000,httpDownloadProbabilitySkipIfNoPeers:false,httpFailedSegmentTimeout:10000,httpDownloadMaxPriority:20,httpDownloadInitialTimeout:0,httpDownloadInitialTimeoutPerSegment:4000,httpUseRanges:false,simultaneousP2PDownloads:3,p2pDownloadMaxPriority:20,p2pSegmentDownloadTimeout:60000,webRtcMaxMessageSize:64*1024-1,trackerAnnounce:["wss://tracker.novage.com.ua","wss://tracker.openwebtorrent.com"],peerRequestsPerAnnounce:10,rtcConfig:simple_peer_1.default.config,};class HybridLoader extends events_1.EventEmitter{constructor(settings={}){super();this.debug=debug_1.default("p2pml:hybrid-loader");this.debugSegments=debug_1.default("p2pml:hybrid-loader-segments");this.segmentsQueue=[];this.bandwidthApproximator=new bandwidth_approximator_1.BandwidthApproximator();this.httpDownloadInitialTimeoutTimestamp=-Infinity;this.createHttpManager=()=>{return new http_media_manager_1.HttpMediaManager(this.settings);};this.createP2PManager=()=>{return new p2p_media_manager_1.P2PMediaManager(this.segmentsStorage,this.settings);};this.load=async(segments,streamSwarmId)=>{if(this.httpRandomDownloadInterval===undefined){this.httpRandomDownloadInterval=setInterval(this.downloadRandomSegmentOverHttp,this.settings.httpDownloadProbabilityInterval);if(this.settings.httpDownloadInitialTimeout>0&&this.settings.httpDownloadInitialTimeoutPerSegment>0){this.debugSegments("enable initial HTTP download timeout",this.settings.httpDownloadInitialTimeout,"per segment",this.settings.httpDownloadInitialTimeoutPerSegment);this.httpDownloadInitialTimeoutTimestamp=this.now();setTimeout(this.processInitialSegmentTimeout,this.settings.httpDownloadInitialTimeoutPerSegment+100);}}
if(segments.length>0){this.masterSwarmId=segments[0].masterSwarmId;}
if(this.masterSwarmId!==undefined){this.p2pManager.setStreamSwarmId(streamSwarmId,this.masterSwarmId);}
this.debug("load segments");let updateSegmentsMap=false;for(const segment of this.segmentsQueue){if(!segments.find((f)=>f.url===segment.url)){this.debug("remove segment",segment.url);if(this.httpManager.isDownloading(segment)){updateSegmentsMap=true;this.httpManager.abort(segment);}
else{this.p2pManager.abort(segment);}
this.emit(loader_interface_1.Events.SegmentAbort,segment);}}
if(this.debug.enabled){for(const segment of segments){if(!this.segmentsQueue.find((f)=>f.url===segment.url)){this.debug("add segment",segment.url);}}}
this.segmentsQueue=segments;if(this.masterSwarmId===undefined){return;}
let storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);updateSegmentsMap=this.processSegmentsQueue(storageSegments)||updateSegmentsMap;if(await this.cleanSegmentsStorage()){storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);updateSegmentsMap=true;}
if(updateSegmentsMap&&!this.settings.consumeOnly){this.p2pManager.sendSegmentsMapToAll(this.createSegmentsMap(storageSegments));}};this.getSegment=async(id)=>{return this.masterSwarmId===undefined?undefined:this.segmentsStorage.getSegment(id,this.masterSwarmId);};this.getSettings=()=>{return this.settings;};this.getDetails=()=>{return{peerId:this.p2pManager.getPeerId(),};};this.destroy=async()=>{if(this.httpRandomDownloadInterval!==undefined){clearInterval(this.httpRandomDownloadInterval);this.httpRandomDownloadInterval=undefined;}
this.httpDownloadInitialTimeoutTimestamp=-Infinity;this.segmentsQueue=[];this.httpManager.destroy();this.p2pManager.destroy();this.masterSwarmId=undefined;await this.segmentsStorage.destroy();};this.processInitialSegmentTimeout=async()=>{if(this.httpRandomDownloadInterval===undefined){return;}
if(this.masterSwarmId!==undefined){const storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);if(this.processSegmentsQueue(storageSegments)&&!this.settings.consumeOnly){this.p2pManager.sendSegmentsMapToAll(this.createSegmentsMap(storageSegments));}}
if(this.httpDownloadInitialTimeoutTimestamp!==-Infinity){setTimeout(this.processInitialSegmentTimeout,this.settings.httpDownloadInitialTimeoutPerSegment);}};this.processSegmentsQueue=(storageSegments)=>{this.debugSegments("process segments queue. priority",this.segmentsQueue.length>0?this.segmentsQueue[0].priority:0);if(this.masterSwarmId===undefined||this.segmentsQueue.length===0){return false;}
let updateSegmentsMap=false;let segmentsMap;let httpAllowed=true;if(this.httpDownloadInitialTimeoutTimestamp!==-Infinity){let firstNotDownloadePriority;for(const segment of this.segmentsQueue){if(!storageSegments.has(segment.id)){firstNotDownloadePriority=segment.priority;break;}}
const httpTimeout=this.now()-this.httpDownloadInitialTimeoutTimestamp;httpAllowed=httpTimeout>=this.settings.httpDownloadInitialTimeout||(firstNotDownloadePriority!==undefined&&httpTimeout>this.settings.httpDownloadInitialTimeoutPerSegment&&firstNotDownloadePriority<=0);if(httpAllowed){this.debugSegments("cancel initial HTTP download timeout - timed out");this.httpDownloadInitialTimeoutTimestamp=-Infinity;}}
for(let index=0;index<this.segmentsQueue.length;index++){const segment=this.segmentsQueue[index];if(storageSegments.has(segment.id)||this.httpManager.isDownloading(segment)){continue;}
if(segment.priority<=this.settings.requiredSegmentsPriority&&httpAllowed&&!this.httpManager.isFailed(segment)){if(this.httpManager.getActiveDownloadsCount()>=this.settings.simultaneousHttpDownloads){for(let i=this.segmentsQueue.length-1;i>index;i--){const segmentToAbort=this.segmentsQueue[i];if(this.httpManager.isDownloading(segmentToAbort)){this.debugSegments("cancel HTTP download",segmentToAbort.priority,segmentToAbort.url);this.httpManager.abort(segmentToAbort);break;}}}
if(this.httpManager.getActiveDownloadsCount()<this.settings.simultaneousHttpDownloads){const downloadedPieces=this.p2pManager.abort(segment);this.httpManager.download(segment,downloadedPieces);this.debugSegments("HTTP download (priority)",segment.priority,segment.url);updateSegmentsMap=true;continue;}}
if(this.p2pManager.isDownloading(segment)){continue;}
if(segment.priority<=this.settings.requiredSegmentsPriority){segmentsMap=segmentsMap?segmentsMap:this.p2pManager.getOverallSegmentsMap();if(segmentsMap.get(segment.id)!==media_peer_1.MediaPeerSegmentStatus.Loaded){continue;}
if(this.p2pManager.getActiveDownloadsCount()>=this.settings.simultaneousP2PDownloads){for(let i=this.segmentsQueue.length-1;i>index;i--){const segmentToAbort=this.segmentsQueue[i];if(this.p2pManager.isDownloading(segmentToAbort)){this.debugSegments("cancel P2P download",segmentToAbort.priority,segmentToAbort.url);this.p2pManager.abort(segmentToAbort);break;}}}
if(this.p2pManager.getActiveDownloadsCount()<this.settings.simultaneousP2PDownloads){if(this.p2pManager.download(segment)){this.debugSegments("P2P download (priority)",segment.priority,segment.url);continue;}}
continue;}
if(this.p2pManager.getActiveDownloadsCount()<this.settings.simultaneousP2PDownloads&&segment.priority<=this.settings.p2pDownloadMaxPriority){if(this.p2pManager.download(segment)){this.debugSegments("P2P download",segment.priority,segment.url);}}}
return updateSegmentsMap;};this.downloadRandomSegmentOverHttp=async()=>{if(this.masterSwarmId===undefined||this.httpRandomDownloadInterval===undefined||this.httpDownloadInitialTimeoutTimestamp!==-Infinity||this.httpManager.getActiveDownloadsCount()>=this.settings.simultaneousHttpDownloads||(this.settings.httpDownloadProbabilitySkipIfNoPeers&&this.p2pManager.getPeers().size===0)||this.settings.consumeOnly){return;}
const storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);const segmentsMap=this.p2pManager.getOverallSegmentsMap();const pendingQueue=this.segmentsQueue.filter((s)=>!this.p2pManager.isDownloading(s)&&!this.httpManager.isDownloading(s)&&!segmentsMap.has(s.id)&&!this.httpManager.isFailed(s)&&s.priority<=this.settings.httpDownloadMaxPriority&&!storageSegments.has(s.id));if(pendingQueue.length===0){return;}
if(Math.random()>this.settings.httpDownloadProbability*pendingQueue.length){return;}
const segment=pendingQueue[Math.floor(Math.random()*pendingQueue.length)];this.debugSegments("HTTP download (random)",segment.priority,segment.url);this.httpManager.download(segment);this.p2pManager.sendSegmentsMapToAll(this.createSegmentsMap(storageSegments));};this.onPieceBytesDownloaded=(method,bytes,peerId)=>{this.bandwidthApproximator.addBytes(bytes,this.now());this.emit(loader_interface_1.Events.PieceBytesDownloaded,method,bytes,peerId);};this.onPieceBytesUploaded=(method,bytes,peerId)=>{this.emit(loader_interface_1.Events.PieceBytesUploaded,method,bytes,peerId);};this.onSegmentLoaded=async(segment,data,peerId)=>{this.debugSegments("segment loaded",segment.id,segment.url);if(this.masterSwarmId===undefined){return;}
segment.data=data;segment.downloadBandwidth=this.bandwidthApproximator.getBandwidth(this.now());await this.segmentsStorage.storeSegment(segment);this.emit(loader_interface_1.Events.SegmentLoaded,segment,peerId);const storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);this.processSegmentsQueue(storageSegments);if(!this.settings.consumeOnly){this.p2pManager.sendSegmentsMapToAll(this.createSegmentsMap(storageSegments));}};this.onSegmentError=async(segment,details,peerId)=>{this.debugSegments("segment error",segment.id,segment.url,peerId,details);this.emit(loader_interface_1.Events.SegmentError,segment,details,peerId);if(this.masterSwarmId!==undefined){const storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);if(this.processSegmentsQueue(storageSegments)&&!this.settings.consumeOnly){this.p2pManager.sendSegmentsMapToAll(this.createSegmentsMap(storageSegments));}}};this.getStreamSwarmId=(segment)=>{return segment.streamId===undefined?segment.masterSwarmId:`${segment.masterSwarmId}+${segment.streamId}`;};this.createSegmentsMap=(storageSegments)=>{const segmentsMap={};const addSegmentToMap=(segment,status)=>{const streamSwarmId=this.getStreamSwarmId(segment);const segmentId=segment.sequence;let segmentsIdsAndStatuses=segmentsMap[streamSwarmId];if(segmentsIdsAndStatuses===undefined){segmentsIdsAndStatuses=["",[]];segmentsMap[streamSwarmId]=segmentsIdsAndStatuses;}
const segmentsStatuses=segmentsIdsAndStatuses[1];segmentsIdsAndStatuses[0]+=segmentsStatuses.length===0?segmentId:`|${segmentId}`;segmentsStatuses.push(status);};for(const storageSegment of storageSegments.values()){addSegmentToMap(storageSegment.segment,media_peer_1.MediaPeerSegmentStatus.Loaded);}
for(const download of this.httpManager.getActiveDownloads().values()){addSegmentToMap(download.segment,media_peer_1.MediaPeerSegmentStatus.LoadingByHttp);}
return segmentsMap;};this.onPeerConnect=async(peer)=>{this.emit(loader_interface_1.Events.PeerConnect,peer);if(!this.settings.consumeOnly&&this.masterSwarmId!==undefined){this.p2pManager.sendSegmentsMap(peer.id,this.createSegmentsMap(await this.segmentsStorage.getSegmentsMap(this.masterSwarmId)));}};this.onPeerClose=(peerId)=>{this.emit(loader_interface_1.Events.PeerClose,peerId);};this.onTrackerUpdate=async(data)=>{if(this.httpDownloadInitialTimeoutTimestamp!==-Infinity&&data.incomplete!==undefined&&data.incomplete<=1){this.debugSegments("cancel initial HTTP download timeout - no peers");this.httpDownloadInitialTimeoutTimestamp=-Infinity;if(this.masterSwarmId!==undefined){const storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);if(this.processSegmentsQueue(storageSegments)&&!this.settings.consumeOnly){this.p2pManager.sendSegmentsMapToAll(this.createSegmentsMap(storageSegments));}}}};this.cleanSegmentsStorage=async()=>{if(this.masterSwarmId===undefined){return false;}
return this.segmentsStorage.clean(this.masterSwarmId,(id)=>this.segmentsQueue.find((queueSegment)=>queueSegment.id===id)!==undefined);};this.now=()=>{return performance.now();};this.settings=Object.assign(Object.assign({},defaultSettings),settings);const{bufferedSegmentsCount}=settings;if(typeof bufferedSegmentsCount==="number"){if(settings.p2pDownloadMaxPriority===undefined){this.settings.p2pDownloadMaxPriority=bufferedSegmentsCount;}
if(settings.httpDownloadMaxPriority===undefined){this.settings.p2pDownloadMaxPriority=bufferedSegmentsCount;}}
this.segmentsStorage=this.settings.segmentsStorage===undefined?new segments_memory_storage_1.SegmentsMemoryStorage(this.settings):this.settings.segmentsStorage;this.debug("loader settings",this.settings);this.httpManager=this.createHttpManager();this.httpManager.on("segment-loaded",this.onSegmentLoaded);this.httpManager.on("segment-error",this.onSegmentError);this.httpManager.on("bytes-downloaded",(bytes)=>this.onPieceBytesDownloaded("http",bytes));this.p2pManager=this.createP2PManager();this.p2pManager.on("segment-loaded",this.onSegmentLoaded);this.p2pManager.on("segment-error",this.onSegmentError);this.p2pManager.on("peer-data-updated",async()=>{if(this.masterSwarmId===undefined){return;}
const storageSegments=await this.segmentsStorage.getSegmentsMap(this.masterSwarmId);if(this.processSegmentsQueue(storageSegments)&&!this.settings.consumeOnly){this.p2pManager.sendSegmentsMapToAll(this.createSegmentsMap(storageSegments));}});this.p2pManager.on("bytes-downloaded",(bytes,peerId)=>this.onPieceBytesDownloaded("p2p",bytes,peerId));this.p2pManager.on("bytes-uploaded",(bytes,peerId)=>this.onPieceBytesUploaded("p2p",bytes,peerId));this.p2pManager.on("peer-connected",this.onPeerConnect);this.p2pManager.on("peer-closed",this.onPeerClose);this.p2pManager.on("tracker-update",this.onTrackerUpdate);}}
exports.HybridLoader=HybridLoader;HybridLoader.isSupported=()=>{return window.RTCPeerConnection.prototype.createDataChannel!==undefined;};},{"./bandwidth-approximator":1,"./http-media-manager":3,"./loader-interface":5,"./media-peer":6,"./p2p-media-manager":7,"./segments-memory-storage":8,"debug":"debug","events":"events","simple-peer":45}],5:[function(require,module,exports){"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.Events=void 0;var Events;(function(Events){Events["SegmentLoaded"]="segment_loaded";Events["SegmentError"]="segment_error";Events["SegmentAbort"]="segment_abort";Events["PeerConnect"]="peer_connect";Events["PeerClose"]="peer_close";Events["PieceBytesDownloaded"]="piece_bytes_downloaded";Events["PieceBytesUploaded"]="piece_bytes_uploaded";})(Events=exports.Events||(exports.Events={}));},{}],6:[function(require,module,exports){"use strict";var __importDefault=(this&&this.__importDefault)||function(mod){return(mod&&mod.__esModule)?mod:{"default":mod};};Object.defineProperty(exports,"__esModule",{value:true});exports.MediaPeer=exports.MediaPeerSegmentStatus=void 0;const debug_1=__importDefault(require("debug"));const buffer_1=require("buffer");const stringly_typed_event_emitter_1=require("./stringly-typed-event-emitter");var MediaPeerCommands;(function(MediaPeerCommands){MediaPeerCommands[MediaPeerCommands["SegmentData"]=0]="SegmentData";MediaPeerCommands[MediaPeerCommands["SegmentAbsent"]=1]="SegmentAbsent";MediaPeerCommands[MediaPeerCommands["SegmentsMap"]=2]="SegmentsMap";MediaPeerCommands[MediaPeerCommands["SegmentRequest"]=3]="SegmentRequest";MediaPeerCommands[MediaPeerCommands["CancelSegmentRequest"]=4]="CancelSegmentRequest";})(MediaPeerCommands||(MediaPeerCommands={}));var MediaPeerSegmentStatus;(function(MediaPeerSegmentStatus){MediaPeerSegmentStatus[MediaPeerSegmentStatus["Loaded"]=0]="Loaded";MediaPeerSegmentStatus[MediaPeerSegmentStatus["LoadingByHttp"]=1]="LoadingByHttp";})(MediaPeerSegmentStatus=exports.MediaPeerSegmentStatus||(exports.MediaPeerSegmentStatus={}));class DownloadingSegment{constructor(id,size){this.id=id;this.size=size;this.bytesDownloaded=0;this.pieces=[];}}
class MediaPeer extends stringly_typed_event_emitter_1.STEEmitter{constructor(peer,settings){super();this.peer=peer;this.settings=settings;this.remoteAddress="";this.downloadingSegmentId=null;this.downloadingSegment=null;this.segmentsMap=new Map();this.debug=debug_1.default("p2pml:media-peer");this.timer=null;this.onPeerConnect=()=>{this.debug("peer connect",this.id,this);this.remoteAddress=this.peer.remoteAddress;this.emit("connect",this);};this.onPeerClose=()=>{this.debug("peer close",this.id,this);this.terminateSegmentRequest();this.emit("close",this);};this.onPeerError=(error)=>{this.debug("peer error",this.id,error,this);};this.receiveSegmentPiece=(data)=>{if(!this.downloadingSegment){this.debug("peer segment not requested",this.id,this);return;}
this.downloadingSegment.bytesDownloaded+=data.byteLength;this.downloadingSegment.pieces.push(data);this.emit("bytes-downloaded",this,data.byteLength);const segmentId=this.downloadingSegment.id;if(this.downloadingSegment.bytesDownloaded===this.downloadingSegment.size){const segmentData=new Uint8Array(this.downloadingSegment.size);let offset=0;for(const piece of this.downloadingSegment.pieces){segmentData.set(new Uint8Array(piece),offset);offset+=piece.byteLength;}
this.debug("peer segment download done",this.id,segmentId,this);this.terminateSegmentRequest();this.emit("segment-loaded",this,segmentId,segmentData.buffer);}
else if(this.downloadingSegment.bytesDownloaded>this.downloadingSegment.size){this.debug("peer segment download bytes mismatch",this.id,segmentId,this);this.terminateSegmentRequest();this.emit("segment-error",this,segmentId,"Too many bytes received for segment");}};this.getJsonCommand=(data)=>{const bytes=new Uint8Array(data);if(bytes[0]===123&&bytes[1]===34&&bytes[data.byteLength-1]===125){try{return JSON.parse(new TextDecoder().decode(data));}
catch(_a){return null;}}
return null;};this.onPeerData=(data)=>{const command=this.getJsonCommand(data);if(command===null){this.receiveSegmentPiece(data);return;}
if(this.downloadingSegment){this.debug("peer segment download is interrupted by a command",this.id,this);const segmentId=this.downloadingSegment.id;this.terminateSegmentRequest();this.emit("segment-error",this,segmentId,"Segment download is interrupted by a command");return;}
this.debug("peer receive command",this.id,command,this);switch(command.c){case MediaPeerCommands.SegmentsMap:this.segmentsMap=this.createSegmentsMap(command.m);this.emit("data-updated");break;case MediaPeerCommands.SegmentRequest:this.emit("segment-request",this,command.i);break;case MediaPeerCommands.SegmentData:if(this.downloadingSegmentId&&this.downloadingSegmentId===command.i&&typeof command.s==="number"&&command.s>=0){this.downloadingSegment=new DownloadingSegment(command.i,command.s);this.cancelResponseTimeoutTimer();}
break;case MediaPeerCommands.SegmentAbsent:if(this.downloadingSegmentId&&this.downloadingSegmentId===command.i){this.terminateSegmentRequest();this.segmentsMap.delete(command.i);this.emit("segment-absent",this,command.i);}
break;case MediaPeerCommands.CancelSegmentRequest:break;default:break;}};this.createSegmentsMap=(segments)=>{if(!(segments instanceof Object)){return new Map();}
const segmentsMap=new Map();for(const streamSwarmId of Object.keys(segments)){const swarmData=segments[streamSwarmId];if(!(swarmData instanceof Array)||swarmData.length!==2||typeof swarmData[0]!=="string"||!(swarmData[1]instanceof Array)){return new Map();}
const segmentsIds=swarmData[0].split("|");const segmentsStatuses=swarmData[1];if(segmentsIds.length!==segmentsStatuses.length){return new Map();}
for(let i=0;i<segmentsIds.length;i++){const segmentStatus=segmentsStatuses[i];if(typeof segmentStatus!=="number"||MediaPeerSegmentStatus[segmentStatus]===undefined){return new Map();}
segmentsMap.set(`${streamSwarmId}+${segmentsIds[i]}`,segmentStatus);}}
return segmentsMap;};this.sendCommand=(command)=>{this.debug("peer send command",this.id,command,this);this.peer.write(JSON.stringify(command));};this.destroy=()=>{this.debug("peer destroy",this.id,this);this.terminateSegmentRequest();this.peer.destroy();};this.getDownloadingSegmentId=()=>{return this.downloadingSegmentId;};this.getSegmentsMap=()=>{return this.segmentsMap;};this.sendSegmentsMap=(segmentsMap)=>{this.sendCommand({c:MediaPeerCommands.SegmentsMap,m:segmentsMap});};this.sendSegmentData=(segmentId,data)=>{this.sendCommand({c:MediaPeerCommands.SegmentData,i:segmentId,s:data.byteLength,});let bytesLeft=data.byteLength;while(bytesLeft>0){const bytesToSend=bytesLeft>=this.settings.webRtcMaxMessageSize?this.settings.webRtcMaxMessageSize:bytesLeft;const buffer=buffer_1.Buffer.from(data,data.byteLength-bytesLeft,bytesToSend);this.peer.write(buffer);bytesLeft-=bytesToSend;}
this.emit("bytes-uploaded",this,data.byteLength);};this.sendSegmentAbsent=(segmentId)=>{this.sendCommand({c:MediaPeerCommands.SegmentAbsent,i:segmentId});};this.requestSegment=(segmentId)=>{if(this.downloadingSegmentId){throw new Error("A segment is already downloading: "+this.downloadingSegmentId);}
this.sendCommand({c:MediaPeerCommands.SegmentRequest,i:segmentId});this.downloadingSegmentId=segmentId;this.runResponseTimeoutTimer();};this.cancelSegmentRequest=()=>{let downloadingSegment;if(this.downloadingSegmentId){const segmentId=this.downloadingSegmentId;downloadingSegment=this.downloadingSegment?this.downloadingSegment.pieces:undefined;this.terminateSegmentRequest();this.sendCommand({c:MediaPeerCommands.CancelSegmentRequest,i:segmentId});}
return downloadingSegment;};this.runResponseTimeoutTimer=()=>{this.timer=setTimeout(()=>{this.timer=null;if(!this.downloadingSegmentId){return;}
const segmentId=this.downloadingSegmentId;this.cancelSegmentRequest();this.emit("segment-timeout",this,segmentId);},this.settings.p2pSegmentDownloadTimeout);};this.cancelResponseTimeoutTimer=()=>{if(this.timer){clearTimeout(this.timer);this.timer=null;}};this.terminateSegmentRequest=()=>{this.downloadingSegmentId=null;this.downloadingSegment=null;this.cancelResponseTimeoutTimer();};this.peer.on("connect",this.onPeerConnect);this.peer.on("close",this.onPeerClose);this.peer.on("error",this.onPeerError);this.peer.on("data",this.onPeerData);this.id=peer.id;}}
exports.MediaPeer=MediaPeer;},{"./stringly-typed-event-emitter":9,"buffer":"buffer","debug":"debug"}],7:[function(require,module,exports){"use strict";var __importDefault=(this&&this.__importDefault)||function(mod){return(mod&&mod.__esModule)?mod:{"default":mod};};Object.defineProperty(exports,"__esModule",{value:true});exports.P2PMediaManager=void 0;const debug_1=__importDefault(require("debug"));const client_1=__importDefault(require("bittorrent-tracker/client"));const buffer_1=require("buffer");const sha1_1=__importDefault(require("sha.js/sha1"));const stringly_typed_event_emitter_1=require("./stringly-typed-event-emitter");const media_peer_1=require("./media-peer");const index_1=require("./index");const PEER_PROTOCOL_VERSION=2;const PEER_ID_VERSION_STRING=index_1.version.replace(/\d*./g,(v)=>`0${parseInt(v,10)%100}`.slice(-2)).slice(0,4);const PEER_ID_VERSION_PREFIX=`-WW${PEER_ID_VERSION_STRING}-`;class PeerSegmentRequest{constructor(peerId,segment){this.peerId=peerId;this.segment=segment;}}
function generatePeerId(){const PEER_ID_SYMBOLS="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";const PEER_ID_LENGTH=20;let peerId=PEER_ID_VERSION_PREFIX;for(let i=0;i<PEER_ID_LENGTH-PEER_ID_VERSION_PREFIX.length;i++){peerId+=PEER_ID_SYMBOLS.charAt(Math.floor(Math.random()*PEER_ID_SYMBOLS.length));}
return new TextEncoder().encode(peerId).buffer;}
class P2PMediaManager extends stringly_typed_event_emitter_1.STEEmitter{constructor(segmentsStorage,settings){super();this.segmentsStorage=segmentsStorage;this.settings=settings;this.trackerClient=null;this.peers=new Map();this.peerCandidates=new Map();this.peerSegmentRequests=new Map();this.streamSwarmId=null;this.debug=debug_1.default("p2pml:p2p-media-manager");this.pendingTrackerClient=null;this.getPeers=()=>{return this.peers;};this.getPeerId=()=>{return buffer_1.Buffer.from(this.peerId).toString("hex");};this.setStreamSwarmId=(streamSwarmId,masterSwarmId)=>{if(this.streamSwarmId===streamSwarmId){return;}
this.destroy(true);this.streamSwarmId=streamSwarmId;this.masterSwarmId=masterSwarmId;this.debug("stream swarm ID",this.streamSwarmId);this.pendingTrackerClient={isDestroyed:false,};const pendingTrackerClient=this.pendingTrackerClient;const infoHash=new sha1_1.default().update(`${PEER_PROTOCOL_VERSION}${this.streamSwarmId}`).digest();if(!pendingTrackerClient.isDestroyed){this.pendingTrackerClient=null;this.createClient(infoHash);}
else if(this.trackerClient!==null){this.trackerClient.destroy();this.trackerClient=null;}};this.createClient=(infoHash)=>{if(!this.settings.useP2P){return;}
const clientOptions={infoHash:buffer_1.Buffer.from(infoHash,0,20),peerId:buffer_1.Buffer.from(this.peerId,0,20),announce:this.settings.trackerAnnounce,rtcConfig:this.settings.rtcConfig,port:6881,getAnnounceOpts:()=>{return{numwant:this.settings.peerRequestsPerAnnounce};},};let oldTrackerClient=this.trackerClient;this.trackerClient=new client_1.default(clientOptions);this.trackerClient.on("error",this.onTrackerError);this.trackerClient.on("warning",this.onTrackerWarning);this.trackerClient.on("update",this.onTrackerUpdate);this.trackerClient.on("peer",this.onTrackerPeer);this.trackerClient.start();if(oldTrackerClient!==null){oldTrackerClient.destroy();oldTrackerClient=null;}};this.onTrackerError=(error)=>{this.debug("tracker error",error);};this.onTrackerWarning=(warning)=>{this.debug("tracker warning",warning);};this.onTrackerUpdate=(data)=>{this.debug("tracker update",data);this.emit("tracker-update",data);};this.onTrackerPeer=(trackerPeer)=>{this.debug("tracker peer",trackerPeer.id,trackerPeer);if(this.peers.has(trackerPeer.id)){this.debug("tracker peer already connected",trackerPeer.id,trackerPeer);trackerPeer.destroy();return;}
const peer=new media_peer_1.MediaPeer(trackerPeer,this.settings);peer.on("connect",this.onPeerConnect);peer.on("close",this.onPeerClose);peer.on("data-updated",this.onPeerDataUpdated);peer.on("segment-request",this.onSegmentRequest);peer.on("segment-loaded",this.onSegmentLoaded);peer.on("segment-absent",this.onSegmentAbsent);peer.on("segment-error",this.onSegmentError);peer.on("segment-timeout",this.onSegmentTimeout);peer.on("bytes-downloaded",this.onPieceBytesDownloaded);peer.on("bytes-uploaded",this.onPieceBytesUploaded);let peerCandidatesById=this.peerCandidates.get(peer.id);if(!peerCandidatesById){peerCandidatesById=[];this.peerCandidates.set(peer.id,peerCandidatesById);}
peerCandidatesById.push(peer);};this.download=(segment)=>{if(this.isDownloading(segment)){return false;}
const candidates=[];for(const peer of this.peers.values()){if(peer.getDownloadingSegmentId()===null&&peer.getSegmentsMap().get(segment.id)===media_peer_1.MediaPeerSegmentStatus.Loaded){candidates.push(peer);}}
if(candidates.length===0){return false;}
const peer=candidates[Math.floor(Math.random()*candidates.length)];peer.requestSegment(segment.id);this.peerSegmentRequests.set(segment.id,new PeerSegmentRequest(peer.id,segment));return true;};this.abort=(segment)=>{let downloadingSegment;const peerSegmentRequest=this.peerSegmentRequests.get(segment.id);if(peerSegmentRequest){const peer=this.peers.get(peerSegmentRequest.peerId);if(peer){downloadingSegment=peer.cancelSegmentRequest();}
this.peerSegmentRequests.delete(segment.id);}
return downloadingSegment;};this.isDownloading=(segment)=>{return this.peerSegmentRequests.has(segment.id);};this.getActiveDownloadsCount=()=>{return this.peerSegmentRequests.size;};this.destroy=(swarmChange=false)=>{this.streamSwarmId=null;if(this.trackerClient){this.trackerClient.stop();if(swarmChange){this.trackerClient.removeAllListeners("error");this.trackerClient.removeAllListeners("warning");this.trackerClient.removeAllListeners("update");this.trackerClient.removeAllListeners("peer");}
else{this.trackerClient.destroy();this.trackerClient=null;}}
if(this.pendingTrackerClient){this.pendingTrackerClient.isDestroyed=true;this.pendingTrackerClient=null;}
this.peers.forEach((peer)=>peer.destroy());this.peers.clear();this.peerSegmentRequests.clear();for(const peerCandidateById of this.peerCandidates.values()){for(const peerCandidate of peerCandidateById){peerCandidate.destroy();}}
this.peerCandidates.clear();};this.sendSegmentsMapToAll=(segmentsMap)=>{this.peers.forEach((peer)=>peer.sendSegmentsMap(segmentsMap));};this.sendSegmentsMap=(peerId,segmentsMap)=>{const peer=this.peers.get(peerId);if(peer){peer.sendSegmentsMap(segmentsMap);}};this.getOverallSegmentsMap=()=>{const overallSegmentsMap=new Map();for(const peer of this.peers.values()){for(const[segmentId,segmentStatus]of peer.getSegmentsMap()){if(segmentStatus===media_peer_1.MediaPeerSegmentStatus.Loaded){overallSegmentsMap.set(segmentId,media_peer_1.MediaPeerSegmentStatus.Loaded);}
else if(!overallSegmentsMap.get(segmentId)){overallSegmentsMap.set(segmentId,media_peer_1.MediaPeerSegmentStatus.LoadingByHttp);}}}
return overallSegmentsMap;};this.onPieceBytesDownloaded=(peer,bytes)=>{this.emit("bytes-downloaded",bytes,peer.id);};this.onPieceBytesUploaded=(peer,bytes)=>{this.emit("bytes-uploaded",bytes,peer.id);};this.onPeerConnect=(peer)=>{const connectedPeer=this.peers.get(peer.id);if(connectedPeer){this.debug("tracker peer already connected (in peer connect)",peer.id,peer);peer.destroy();return;}
this.peers.set(peer.id,peer);const peerCandidatesById=this.peerCandidates.get(peer.id);if(peerCandidatesById){for(const peerCandidate of peerCandidatesById){if(peerCandidate!==peer){peerCandidate.destroy();}}
this.peerCandidates.delete(peer.id);}
this.emit("peer-connected",{id:peer.id,remoteAddress:peer.remoteAddress});};this.onPeerClose=(peer)=>{if(this.peers.get(peer.id)!==peer){const peerCandidatesById=this.peerCandidates.get(peer.id);if(!peerCandidatesById){return;}
const index=peerCandidatesById.indexOf(peer);if(index!==-1){peerCandidatesById.splice(index,1);}
if(peerCandidatesById.length===0){this.peerCandidates.delete(peer.id);}
return;}
for(const[key,value]of this.peerSegmentRequests){if(value.peerId===peer.id){this.peerSegmentRequests.delete(key);}}
this.peers.delete(peer.id);this.emit("peer-data-updated");this.emit("peer-closed",peer.id);};this.onPeerDataUpdated=()=>{this.emit("peer-data-updated");};this.onSegmentRequest=async(peer,segmentId)=>{if(this.masterSwarmId===undefined){return;}
const segment=await this.segmentsStorage.getSegment(segmentId,this.masterSwarmId);if(segment&&segment.data){peer.sendSegmentData(segmentId,segment.data);}
else{peer.sendSegmentAbsent(segmentId);}};this.onSegmentLoaded=async(peer,segmentId,data)=>{const peerSegmentRequest=this.peerSegmentRequests.get(segmentId);if(!peerSegmentRequest){return;}
const segment=peerSegmentRequest.segment;if(this.settings.segmentValidator){try{await this.settings.segmentValidator(Object.assign(Object.assign({},segment),{data:data}),"p2p",peer.id);}
catch(error){this.debug("segment validator failed",error);this.peerSegmentRequests.delete(segmentId);this.emit("segment-error",segment,error,peer.id);this.onPeerClose(peer);return;}}
this.peerSegmentRequests.delete(segmentId);this.emit("segment-loaded",segment,data,peer.id);};this.onSegmentAbsent=(peer,segmentId)=>{this.peerSegmentRequests.delete(segmentId);this.emit("peer-data-updated");};this.onSegmentError=(peer,segmentId,description)=>{const peerSegmentRequest=this.peerSegmentRequests.get(segmentId);if(peerSegmentRequest){this.peerSegmentRequests.delete(segmentId);this.emit("segment-error",peerSegmentRequest.segment,description,peer.id);}};this.onSegmentTimeout=(peer,segmentId)=>{const peerSegmentRequest=this.peerSegmentRequests.get(segmentId);if(peerSegmentRequest){this.peerSegmentRequests.delete(segmentId);peer.destroy();if(this.peers.delete(peerSegmentRequest.peerId)){this.emit("peer-data-updated");}}};this.peerId=settings.useP2P?generatePeerId():new ArrayBuffer(0);if(this.debug.enabled){this.debug("peer ID",this.getPeerId(),new TextDecoder().decode(this.peerId));}}}
exports.P2PMediaManager=P2PMediaManager;},{"./index":"p2p-media-loader-core","./media-peer":6,"./stringly-typed-event-emitter":9,"bittorrent-tracker/client":11,"buffer":"buffer","debug":"debug","sha.js/sha1":44}],8:[function(require,module,exports){"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.SegmentsMemoryStorage=void 0;class SegmentsMemoryStorage{constructor(settings){this.settings=settings;this.cache=new Map();this.storeSegment=async(segment)=>{this.cache.set(segment.id,{segment,lastAccessed:performance.now()});};this.getSegmentsMap=async()=>{return this.cache;};this.getSegment=async(id)=>{const cacheItem=this.cache.get(id);if(cacheItem===undefined){return undefined;}
cacheItem.lastAccessed=performance.now();return cacheItem.segment;};this.hasSegment=async(id)=>{return this.cache.has(id);};this.clean=async(masterSwarmId,lockedSegmentsFilter)=>{const segmentsToDelete=[];const remainingSegments=[];const now=performance.now();for(const cachedSegment of this.cache.values()){if(now-cachedSegment.lastAccessed>this.settings.cachedSegmentExpiration){segmentsToDelete.push(cachedSegment.segment.id);}
else{remainingSegments.push(cachedSegment);}}
let countOverhead=remainingSegments.length-this.settings.cachedSegmentsCount;if(countOverhead>0){remainingSegments.sort((a,b)=>a.lastAccessed-b.lastAccessed);for(const cachedSegment of remainingSegments){if(lockedSegmentsFilter===undefined||!lockedSegmentsFilter(cachedSegment.segment.id)){segmentsToDelete.push(cachedSegment.segment.id);countOverhead--;if(countOverhead===0){break;}}}}
segmentsToDelete.forEach((id)=>this.cache.delete(id));return segmentsToDelete.length>0;};this.destroy=async()=>{this.cache.clear();};}}
exports.SegmentsMemoryStorage=SegmentsMemoryStorage;},{}],9:[function(require,module,exports){"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.STEEmitter=void 0;const events_1=require("events");class STEEmitter extends events_1.EventEmitter{constructor(){super(...arguments);this.on=(event,listener)=>super.on(event,listener);this.emit=(event,...args)=>super.emit(event,...args);}}
exports.STEEmitter=STEEmitter;},{"events":"events"}],10:[function(require,module,exports){'use strict'
exports.byteLength=byteLength
exports.toByteArray=toByteArray
exports.fromByteArray=fromByteArray
var lookup=[]
var revLookup=[]
var Arr=typeof Uint8Array!=='undefined'?Uint8Array:Array
var code='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for(var i=0,len=code.length;i<len;++i){lookup[i]=code[i]
revLookup[code.charCodeAt(i)]=i}
revLookup['-'.charCodeAt(0)]=62
revLookup['_'.charCodeAt(0)]=63
function getLens(b64){var len=b64.length
if(len%4>0){throw new Error('Invalid string. Length must be a multiple of 4')}
var validLen=b64.indexOf('=')
if(validLen===-1)validLen=len
var placeHoldersLen=validLen===len?0:4-(validLen%4)
return[validLen,placeHoldersLen]}
function byteLength(b64){var lens=getLens(b64)
var validLen=lens[0]
var placeHoldersLen=lens[1]
return((validLen+placeHoldersLen)*3/4)-placeHoldersLen}
function _byteLength(b64,validLen,placeHoldersLen){return((validLen+placeHoldersLen)*3/4)-placeHoldersLen}
function toByteArray(b64){var tmp
var lens=getLens(b64)
var validLen=lens[0]
var placeHoldersLen=lens[1]
var arr=new Arr(_byteLength(b64,validLen,placeHoldersLen))
var curByte=0
var len=placeHoldersLen>0?validLen-4:validLen
var i
for(i=0;i<len;i+=4){tmp=(revLookup[b64.charCodeAt(i)]<<18)|(revLookup[b64.charCodeAt(i+1)]<<12)|(revLookup[b64.charCodeAt(i+2)]<<6)|revLookup[b64.charCodeAt(i+3)]
arr[curByte++]=(tmp>>16)&0xFF
arr[curByte++]=(tmp>>8)&0xFF
arr[curByte++]=tmp&0xFF}
if(placeHoldersLen===2){tmp=(revLookup[b64.charCodeAt(i)]<<2)|(revLookup[b64.charCodeAt(i+1)]>>4)
arr[curByte++]=tmp&0xFF}
if(placeHoldersLen===1){tmp=(revLookup[b64.charCodeAt(i)]<<10)|(revLookup[b64.charCodeAt(i+1)]<<4)|(revLookup[b64.charCodeAt(i+2)]>>2)
arr[curByte++]=(tmp>>8)&0xFF
arr[curByte++]=tmp&0xFF}
return arr}
function tripletToBase64(num){return lookup[num>>18&0x3F]+
lookup[num>>12&0x3F]+
lookup[num>>6&0x3F]+
lookup[num&0x3F]}
function encodeChunk(uint8,start,end){var tmp
var output=[]
for(var i=start;i<end;i+=3){tmp=((uint8[i]<<16)&0xFF0000)+
((uint8[i+1]<<8)&0xFF00)+
(uint8[i+2]&0xFF)
output.push(tripletToBase64(tmp))}
return output.join('')}
function fromByteArray(uint8){var tmp
var len=uint8.length
var extraBytes=len%3
var parts=[]
var maxChunkLength=16383
for(var i=0,len2=len-extraBytes;i<len2;i+=maxChunkLength){parts.push(encodeChunk(uint8,i,(i+maxChunkLength)>len2?len2:(i+maxChunkLength)))}
if(extraBytes===1){tmp=uint8[len-1]
parts.push(lookup[tmp>>2]+
lookup[(tmp<<4)&0x3F]+
'==')}else if(extraBytes===2){tmp=(uint8[len-2]<<8)+uint8[len-1]
parts.push(lookup[tmp>>10]+
lookup[(tmp>>4)&0x3F]+
lookup[(tmp<<2)&0x3F]+
'=')}
return parts.join('')}},{}],11:[function(require,module,exports){(function(process,Buffer){(function(){const debug=require('debug')('bittorrent-tracker:client')
const EventEmitter=require('events')
const once=require('once')
const parallel=require('run-parallel')
const Peer=require('simple-peer')
const queueMicrotask=require('queue-microtask')
const common=require('./lib/common')
const HTTPTracker=require('./lib/client/http-tracker')
const UDPTracker=require('./lib/client/udp-tracker')
const WebSocketTracker=require('./lib/client/websocket-tracker')
class Client extends EventEmitter{constructor(opts={}){super()
if(!opts.peerId)throw new Error('Option `peerId` is required')
if(!opts.infoHash)throw new Error('Option `infoHash` is required')
if(!opts.announce)throw new Error('Option `announce` is required')
if(!process.browser&&!opts.port)throw new Error('Option `port` is required')
this.peerId=typeof opts.peerId==='string'?opts.peerId:opts.peerId.toString('hex')
this._peerIdBuffer=Buffer.from(this.peerId,'hex')
this._peerIdBinary=this._peerIdBuffer.toString('binary')
this.infoHash=typeof opts.infoHash==='string'?opts.infoHash.toLowerCase():opts.infoHash.toString('hex')
this._infoHashBuffer=Buffer.from(this.infoHash,'hex')
this._infoHashBinary=this._infoHashBuffer.toString('binary')
debug('new client %s',this.infoHash)
this.destroyed=false
this._port=opts.port
this._getAnnounceOpts=opts.getAnnounceOpts
this._rtcConfig=opts.rtcConfig
this._userAgent=opts.userAgent
this._wrtc=typeof opts.wrtc==='function'?opts.wrtc():opts.wrtc
let announce=typeof opts.announce==='string'?[opts.announce]:opts.announce==null?[]:opts.announce
announce=announce.map(announceUrl=>{announceUrl=announceUrl.toString()
if(announceUrl[announceUrl.length-1]==='/'){announceUrl=announceUrl.substring(0,announceUrl.length-1)}
return announceUrl})
announce=Array.from(new Set(announce))
const webrtcSupport=this._wrtc!==false&&(!!this._wrtc||Peer.WEBRTC_SUPPORT)
const nextTickWarn=err=>{queueMicrotask(()=>{this.emit('warning',err)})}
this._trackers=announce.map(announceUrl=>{let parsedUrl
try{parsedUrl=new URL(announceUrl)}catch(err){nextTickWarn(new Error(`Invalid tracker URL: ${announceUrl}`))
return null}
const port=parsedUrl.port
if(port<0||port>65535){nextTickWarn(new Error(`Invalid tracker port: ${announceUrl}`))
return null}
const protocol=parsedUrl.protocol
if((protocol==='http:'||protocol==='https:')&&typeof HTTPTracker==='function'){return new HTTPTracker(this,announceUrl)}else if(protocol==='udp:'&&typeof UDPTracker==='function'){return new UDPTracker(this,announceUrl)}else if((protocol==='ws:'||protocol==='wss:')&&webrtcSupport){if(protocol==='ws:'&&typeof window!=='undefined'&&window.location.protocol==='https:'){nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`))
return null}
return new WebSocketTracker(this,announceUrl)}else{nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`))
return null}}).filter(Boolean)}
start(opts){opts=this._defaultAnnounceOpts(opts)
opts.event='started'
debug('send `start` %o',opts)
this._announce(opts)
this._trackers.forEach(tracker=>{tracker.setInterval()})}
stop(opts){opts=this._defaultAnnounceOpts(opts)
opts.event='stopped'
debug('send `stop` %o',opts)
this._announce(opts)}
complete(opts){if(!opts)opts={}
opts=this._defaultAnnounceOpts(opts)
opts.event='completed'
debug('send `complete` %o',opts)
this._announce(opts)}
update(opts){opts=this._defaultAnnounceOpts(opts)
if(opts.event)delete opts.event
debug('send `update` %o',opts)
this._announce(opts)}
_announce(opts){this._trackers.forEach(tracker=>{tracker.announce(opts)})}
scrape(opts){debug('send `scrape`')
if(!opts)opts={}
this._trackers.forEach(tracker=>{tracker.scrape(opts)})}
setInterval(intervalMs){debug('setInterval %d',intervalMs)
this._trackers.forEach(tracker=>{tracker.setInterval(intervalMs)})}
destroy(cb){if(this.destroyed)return
this.destroyed=true
debug('destroy')
const tasks=this._trackers.map(tracker=>cb=>{tracker.destroy(cb)})
parallel(tasks,cb)
this._trackers=[]
this._getAnnounceOpts=null}
_defaultAnnounceOpts(opts={}){if(opts.numwant==null)opts.numwant=common.DEFAULT_ANNOUNCE_PEERS
if(opts.uploaded==null)opts.uploaded=0
if(opts.downloaded==null)opts.downloaded=0
if(this._getAnnounceOpts)opts=Object.assign({},opts,this._getAnnounceOpts())
return opts}}
Client.scrape=(opts,cb)=>{cb=once(cb)
if(!opts.infoHash)throw new Error('Option `infoHash` is required')
if(!opts.announce)throw new Error('Option `announce` is required')
const clientOpts=Object.assign({},opts,{infoHash:Array.isArray(opts.infoHash)?opts.infoHash[0]:opts.infoHash,peerId:Buffer.from('01234567890123456789'),port:6881})
const client=new Client(clientOpts)
client.once('error',cb)
client.once('warning',cb)
let len=Array.isArray(opts.infoHash)?opts.infoHash.length:1
const results={}
client.on('scrape',data=>{len-=1
results[data.infoHash]=data
if(len===0){client.destroy()
const keys=Object.keys(results)
if(keys.length===1){cb(null,results[keys[0]])}else{cb(null,results)}}})
opts.infoHash=Array.isArray(opts.infoHash)?opts.infoHash.map(infoHash=>{return Buffer.from(infoHash,'hex')}):Buffer.from(opts.infoHash,'hex')
client.scrape({infoHash:opts.infoHash})
return client}
module.exports=Client}).call(this)}).call(this,require('_process'),require("buffer").Buffer)},{"./lib/client/http-tracker":15,"./lib/client/udp-tracker":15,"./lib/client/websocket-tracker":13,"./lib/common":14,"_process":23,"buffer":"buffer","debug":"debug","events":"events","once":22,"queue-microtask":24,"run-parallel":41,"simple-peer":45}],12:[function(require,module,exports){const EventEmitter=require('events')
class Tracker extends EventEmitter{constructor(client,announceUrl){super()
this.client=client
this.announceUrl=announceUrl
this.interval=null
this.destroyed=false}
setInterval(intervalMs){if(intervalMs==null)intervalMs=this.DEFAULT_ANNOUNCE_INTERVAL
clearInterval(this.interval)
if(intervalMs){this.interval=setInterval(()=>{this.announce(this.client._defaultAnnounceOpts())},intervalMs)
if(this.interval.unref)this.interval.unref()}}}
module.exports=Tracker},{"events":"events"}],13:[function(require,module,exports){const debug=require('debug')('bittorrent-tracker:websocket-tracker')
const Peer=require('simple-peer')
const randombytes=require('randombytes')
const Socket=require('simple-websocket')
const common=require('../common')
const Tracker=require('./tracker')
const socketPool={}
const RECONNECT_MINIMUM=10*1000
const RECONNECT_MAXIMUM=60*60*1000
const RECONNECT_VARIANCE=5*60*1000
const OFFER_TIMEOUT=50*1000
class WebSocketTracker extends Tracker{constructor(client,announceUrl,opts){super(client,announceUrl)
debug('new websocket tracker %s',announceUrl)
this.peers={}
this.socket=null
this.reconnecting=false
this.retries=0
this.reconnectTimer=null
this.expectingResponse=false
this._openSocket()}
announce(opts){if(this.destroyed||this.reconnecting)return
if(!this.socket.connected){this.socket.once('connect',()=>{this.announce(opts)})
return}
const params=Object.assign({},opts,{action:'announce',info_hash:this.client._infoHashBinary,peer_id:this.client._peerIdBinary})
if(this._trackerId)params.trackerid=this._trackerId
if(opts.event==='stopped'||opts.event==='completed'){this._send(params)}else{const numwant=Math.min(opts.numwant,10)
this._generateOffers(numwant,offers=>{params.numwant=numwant
params.offers=offers
this._send(params)})}}
scrape(opts){if(this.destroyed||this.reconnecting)return
if(!this.socket.connected){this.socket.once('connect',()=>{this.scrape(opts)})
return}
const infoHashes=(Array.isArray(opts.infoHash)&&opts.infoHash.length>0)?opts.infoHash.map(infoHash=>{return infoHash.toString('binary')}):(opts.infoHash&&opts.infoHash.toString('binary'))||this.client._infoHashBinary
const params={action:'scrape',info_hash:infoHashes}
this._send(params)}
destroy(cb=noop){if(this.destroyed)return cb(null)
this.destroyed=true
clearInterval(this.interval)
clearTimeout(this.reconnectTimer)
for(const peerId in this.peers){const peer=this.peers[peerId]
clearTimeout(peer.trackerTimeout)
peer.destroy()}
this.peers=null
if(this.socket){this.socket.removeListener('connect',this._onSocketConnectBound)
this.socket.removeListener('data',this._onSocketDataBound)
this.socket.removeListener('close',this._onSocketCloseBound)
this.socket.removeListener('error',this._onSocketErrorBound)
this.socket=null}
this._onSocketConnectBound=null
this._onSocketErrorBound=null
this._onSocketDataBound=null
this._onSocketCloseBound=null
if(socketPool[this.announceUrl]){socketPool[this.announceUrl].consumers-=1}
if(socketPool[this.announceUrl].consumers>0)return cb()
let socket=socketPool[this.announceUrl]
delete socketPool[this.announceUrl]
socket.on('error',noop)
socket.once('close',cb)
let timeout
if(!this.expectingResponse)return destroyCleanup()
timeout=setTimeout(destroyCleanup,common.DESTROY_TIMEOUT)
socket.once('data',destroyCleanup)
function destroyCleanup(){if(timeout){clearTimeout(timeout)
timeout=null}
socket.removeListener('data',destroyCleanup)
socket.destroy()
socket=null}}
_openSocket(){this.destroyed=false
if(!this.peers)this.peers={}
this._onSocketConnectBound=()=>{this._onSocketConnect()}
this._onSocketErrorBound=err=>{this._onSocketError(err)}
this._onSocketDataBound=data=>{this._onSocketData(data)}
this._onSocketCloseBound=()=>{this._onSocketClose()}
this.socket=socketPool[this.announceUrl]
if(this.socket){socketPool[this.announceUrl].consumers+=1
if(this.socket.connected){this._onSocketConnectBound()}}else{this.socket=socketPool[this.announceUrl]=new Socket(this.announceUrl)
this.socket.consumers=1
this.socket.once('connect',this._onSocketConnectBound)}
this.socket.on('data',this._onSocketDataBound)
this.socket.once('close',this._onSocketCloseBound)
this.socket.once('error',this._onSocketErrorBound)}
_onSocketConnect(){if(this.destroyed)return
if(this.reconnecting){this.reconnecting=false
this.retries=0
this.announce(this.client._defaultAnnounceOpts())}}
_onSocketData(data){if(this.destroyed)return
this.expectingResponse=false
try{data=JSON.parse(data)}catch(err){this.client.emit('warning',new Error('Invalid tracker response'))
return}
if(data.action==='announce'){this._onAnnounceResponse(data)}else if(data.action==='scrape'){this._onScrapeResponse(data)}else{this._onSocketError(new Error(`invalid action in WS response: ${data.action}`))}}
_onAnnounceResponse(data){if(data.info_hash!==this.client._infoHashBinary){debug('ignoring websocket data from %s for %s (looking for %s: reused socket)',this.announceUrl,common.binaryToHex(data.info_hash),this.client.infoHash)
return}
if(data.peer_id&&data.peer_id===this.client._peerIdBinary){return}
debug('received %s from %s for %s',JSON.stringify(data),this.announceUrl,this.client.infoHash)
const failure=data['failure reason']
if(failure)return this.client.emit('warning',new Error(failure))
const warning=data['warning message']
if(warning)this.client.emit('warning',new Error(warning))
const interval=data.interval||data['min interval']
if(interval)this.setInterval(interval*1000)
const trackerId=data['tracker id']
if(trackerId){this._trackerId=trackerId}
if(data.complete!=null){const response=Object.assign({},data,{announce:this.announceUrl,infoHash:common.binaryToHex(data.info_hash)})
this.client.emit('update',response)}
let peer
if(data.offer&&data.peer_id){debug('creating peer (from remote offer)')
peer=this._createPeer()
peer.id=common.binaryToHex(data.peer_id)
peer.once('signal',answer=>{const params={action:'announce',info_hash:this.client._infoHashBinary,peer_id:this.client._peerIdBinary,to_peer_id:data.peer_id,answer,offer_id:data.offer_id}
if(this._trackerId)params.trackerid=this._trackerId
this._send(params)})
peer.signal(data.offer)
this.client.emit('peer',peer)}
if(data.answer&&data.peer_id){const offerId=common.binaryToHex(data.offer_id)
peer=this.peers[offerId]
if(peer){peer.id=common.binaryToHex(data.peer_id)
peer.signal(data.answer)
this.client.emit('peer',peer)
clearTimeout(peer.trackerTimeout)
peer.trackerTimeout=null
delete this.peers[offerId]}else{debug(`got unexpected answer: ${JSON.stringify(data.answer)}`)}}}
_onScrapeResponse(data){data=data.files||{}
const keys=Object.keys(data)
if(keys.length===0){this.client.emit('warning',new Error('invalid scrape response'))
return}
keys.forEach(infoHash=>{const response=Object.assign(data[infoHash],{announce:this.announceUrl,infoHash:common.binaryToHex(infoHash)})
this.client.emit('scrape',response)})}
_onSocketClose(){if(this.destroyed)return
this.destroy()
this._startReconnectTimer()}
_onSocketError(err){if(this.destroyed)return
this.destroy()
this.client.emit('warning',err)
this._startReconnectTimer()}
_startReconnectTimer(){const ms=Math.floor(Math.random()*RECONNECT_VARIANCE)+Math.min(Math.pow(2,this.retries)*RECONNECT_MINIMUM,RECONNECT_MAXIMUM)
this.reconnecting=true
clearTimeout(this.reconnectTimer)
this.reconnectTimer=setTimeout(()=>{this.retries++
this._openSocket()},ms)
if(this.reconnectTimer.unref)this.reconnectTimer.unref()
debug('reconnecting socket in %s ms',ms)}
_send(params){if(this.destroyed)return
this.expectingResponse=true
const message=JSON.stringify(params)
debug('send %s',message)
this.socket.send(message)}
_generateOffers(numwant,cb){const self=this
const offers=[]
debug('generating %s offers',numwant)
for(let i=0;i<numwant;++i){generateOffer()}
checkDone()
function generateOffer(){const offerId=randombytes(20).toString('hex')
debug('creating peer (from _generateOffers)')
const peer=self.peers[offerId]=self._createPeer({initiator:true})
peer.once('signal',offer=>{offers.push({offer,offer_id:common.hexToBinary(offerId)})
checkDone()})
peer.trackerTimeout=setTimeout(()=>{debug('tracker timeout: destroying peer')
peer.trackerTimeout=null
delete self.peers[offerId]
peer.destroy()},OFFER_TIMEOUT)
if(peer.trackerTimeout.unref)peer.trackerTimeout.unref()}
function checkDone(){if(offers.length===numwant){debug('generated %s offers',numwant)
cb(offers)}}}
_createPeer(opts){const self=this
opts=Object.assign({trickle:false,config:self.client._rtcConfig,wrtc:self.client._wrtc},opts)
const peer=new Peer(opts)
peer.once('error',onError)
peer.once('connect',onConnect)
return peer
function onError(err){self.client.emit('warning',new Error(`Connection error: ${err.message}`))
peer.destroy()}
function onConnect(){peer.removeListener('error',onError)
peer.removeListener('connect',onConnect)}}}
WebSocketTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL=30*1000
WebSocketTracker._socketPool=socketPool
function noop(){}
module.exports=WebSocketTracker},{"../common":14,"./tracker":12,"debug":"debug","randombytes":25,"simple-peer":45,"simple-websocket":46}],14:[function(require,module,exports){(function(Buffer){(function(){exports.DEFAULT_ANNOUNCE_PEERS=50
exports.MAX_ANNOUNCE_PEERS=82
exports.binaryToHex=function(str){if(typeof str!=='string'){str=String(str)}
return Buffer.from(str,'binary').toString('hex')}
exports.hexToBinary=function(str){if(typeof str!=='string'){str=String(str)}
return Buffer.from(str,'hex').toString('binary')}
const config=require('./common-node')
Object.assign(exports,config)}).call(this)}).call(this,require("buffer").Buffer)},{"./common-node":15,"buffer":"buffer"}],15:[function(require,module,exports){},{}],16:[function(require,module,exports){function setup(env){createDebug.debug=createDebug;createDebug.default=createDebug;createDebug.coerce=coerce;createDebug.disable=disable;createDebug.enable=enable;createDebug.enabled=enabled;createDebug.humanize=require('ms');createDebug.destroy=destroy;Object.keys(env).forEach(key=>{createDebug[key]=env[key];});createDebug.names=[];createDebug.skips=[];createDebug.formatters={};function selectColor(namespace){let hash=0;for(let i=0;i<namespace.length;i++){hash=((hash<<5)-hash)+namespace.charCodeAt(i);hash|=0;}
return createDebug.colors[Math.abs(hash)%createDebug.colors.length];}
createDebug.selectColor=selectColor;function createDebug(namespace){let prevTime;let enableOverride=null;function debug(...args){if(!debug.enabled){return;}
const self=debug;const curr=Number(new Date());const ms=curr-(prevTime||curr);self.diff=ms;self.prev=prevTime;self.curr=curr;prevTime=curr;args[0]=createDebug.coerce(args[0]);if(typeof args[0]!=='string'){args.unshift('%O');}
let index=0;args[0]=args[0].replace(/%([a-zA-Z%])/g,(match,format)=>{if(match==='%%'){return '%';}
index++;const formatter=createDebug.formatters[format];if(typeof formatter==='function'){const val=args[index];match=formatter.call(self,val);args.splice(index,1);index--;}
return match;});createDebug.formatArgs.call(self,args);const logFn=self.log||createDebug.log;logFn.apply(self,args);}
debug.namespace=namespace;debug.useColors=createDebug.useColors();debug.color=createDebug.selectColor(namespace);debug.extend=extend;debug.destroy=createDebug.destroy;Object.defineProperty(debug,'enabled',{enumerable:true,configurable:false,get:()=>enableOverride===null?createDebug.enabled(namespace):enableOverride,set:v=>{enableOverride=v;}});if(typeof createDebug.init==='function'){createDebug.init(debug);}
return debug;}
function extend(namespace,delimiter){const newDebug=createDebug(this.namespace+(typeof delimiter==='undefined'?':':delimiter)+namespace);newDebug.log=this.log;return newDebug;}
function enable(namespaces){createDebug.save(namespaces);createDebug.names=[];createDebug.skips=[];let i;const split=(typeof namespaces==='string'?namespaces:'').split(/[\s,]+/);const len=split.length;for(i=0;i<len;i++){if(!split[i]){continue;}
namespaces=split[i].replace(/\*/g,'.*?');if(namespaces[0]==='-'){createDebug.skips.push(new RegExp('^'+namespaces.substr(1)+'$'));}else{createDebug.names.push(new RegExp('^'+namespaces+'$'));}}}
function disable(){const namespaces=[...createDebug.names.map(toNamespace),...createDebug.skips.map(toNamespace).map(namespace=>'-'+namespace)].join(',');createDebug.enable('');return namespaces;}
function enabled(name){if(name[name.length-1]==='*'){return true;}
let i;let len;for(i=0,len=createDebug.skips.length;i<len;i++){if(createDebug.skips[i].test(name)){return false;}}
for(i=0,len=createDebug.names.length;i<len;i++){if(createDebug.names[i].test(name)){return true;}}
return false;}
function toNamespace(regexp){return regexp.toString().substring(2,regexp.toString().length-2).replace(/\.\*\?$/,'*');}
function coerce(val){if(val instanceof Error){return val.stack||val.message;}
return val;}
function destroy(){console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');}
createDebug.enable(createDebug.load());return createDebug;}
module.exports=setup;},{"ms":21}],17:[function(require,module,exports){'use strict';function assign(obj,props){for(const key in props){Object.defineProperty(obj,key,{value:props[key],enumerable:true,configurable:true,});}
return obj;}
function createError(err,code,props){if(!err||typeof err==='string'){throw new TypeError('Please pass an Error to err-code');}
if(!props){props={};}
if(typeof code==='object'){props=code;code=undefined;}
if(code!=null){props.code=code;}
try{return assign(err,props);}catch(_){props.message=err.message;props.stack=err.stack;const ErrClass=function(){};ErrClass.prototype=Object.create(Object.getPrototypeOf(err));return assign(new ErrClass(),props);}}
module.exports=createError;},{}],18:[function(require,module,exports){module.exports=function getBrowserRTC(){if(typeof globalThis==='undefined')return null
var wrtc={RTCPeerConnection:globalThis.RTCPeerConnection||globalThis.mozRTCPeerConnection||globalThis.webkitRTCPeerConnection,RTCSessionDescription:globalThis.RTCSessionDescription||globalThis.mozRTCSessionDescription||globalThis.webkitRTCSessionDescription,RTCIceCandidate:globalThis.RTCIceCandidate||globalThis.mozRTCIceCandidate||globalThis.webkitRTCIceCandidate}
if(!wrtc.RTCPeerConnection)return null
return wrtc}},{}],19:[function(require,module,exports){/*!ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource>*/exports.read=function(buffer,offset,isLE,mLen,nBytes){var e,m
var eLen=(nBytes*8)-mLen-1
var eMax=(1<<eLen)-1
var eBias=eMax>>1
var nBits=-7
var i=isLE?(nBytes-1):0
var d=isLE?-1:1
var s=buffer[offset+i]
i+=d
e=s&((1<<(-nBits))-1)
s>>=(-nBits)
nBits+=eLen
for(;nBits>0;e=(e*256)+buffer[offset+i],i+=d,nBits-=8){}
m=e&((1<<(-nBits))-1)
e>>=(-nBits)
nBits+=mLen
for(;nBits>0;m=(m*256)+buffer[offset+i],i+=d,nBits-=8){}
if(e===0){e=1-eBias}else if(e===eMax){return m?NaN:((s?-1:1)*Infinity)}else{m=m+Math.pow(2,mLen)
e=e-eBias}
return(s?-1:1)*m*Math.pow(2,e-mLen)}
exports.write=function(buffer,value,offset,isLE,mLen,nBytes){var e,m,c
var eLen=(nBytes*8)-mLen-1
var eMax=(1<<eLen)-1
var eBias=eMax>>1
var rt=(mLen===23?Math.pow(2,-24)-Math.pow(2,-77):0)
var i=isLE?0:(nBytes-1)
var d=isLE?1:-1
var s=value<0||(value===0&&1/value<0)?1:0
value=Math.abs(value)
if(isNaN(value)||value===Infinity){m=isNaN(value)?1:0
e=eMax}else{e=Math.floor(Math.log(value)/Math.LN2)
if(value*(c=Math.pow(2,-e))<1){e--
c*=2}
if(e+eBias>=1){value+=rt/c}else{value+=rt*Math.pow(2,1-eBias)}
if(value*c>=2){e++
c/=2}
if(e+eBias>=eMax){m=0
e=eMax}else if(e+eBias>=1){m=((value*c)-1)*Math.pow(2,mLen)
e=e+eBias}else{m=value*Math.pow(2,eBias-1)*Math.pow(2,mLen)
e=0}}
for(;mLen>=8;buffer[offset+i]=m&0xff,i+=d,m/=256,mLen-=8){}
e=(e<<mLen)|m
eLen+=mLen
for(;eLen>0;buffer[offset+i]=e&0xff,i+=d,e/=256,eLen-=8){}
buffer[offset+i-d]|=s*128}},{}],20:[function(require,module,exports){if(typeof Object.create==='function'){module.exports=function inherits(ctor,superCtor){if(superCtor){ctor.super_=superCtor
ctor.prototype=Object.create(superCtor.prototype,{constructor:{value:ctor,enumerable:false,writable:true,configurable:true}})}};}else{module.exports=function inherits(ctor,superCtor){if(superCtor){ctor.super_=superCtor
var TempCtor=function(){}
TempCtor.prototype=superCtor.prototype
ctor.prototype=new TempCtor()
ctor.prototype.constructor=ctor}}}},{}],21:[function(require,module,exports){var s=1000;var m=s*60;var h=m*60;var d=h*24;var w=d*7;var y=d*365.25;module.exports=function(val,options){options=options||{};var type=typeof val;if(type==='string'&&val.length>0){return parse(val);}else if(type==='number'&&isFinite(val)){return options.long?fmtLong(val):fmtShort(val);}
throw new Error('val is not a non-empty string or a valid number. val='+
JSON.stringify(val));};function parse(str){str=String(str);if(str.length>100){return;}
var match=/^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);if(!match){return;}
var n=parseFloat(match[1]);var type=(match[2]||'ms').toLowerCase();switch(type){case 'years':case 'year':case 'yrs':case 'yr':case 'y':return n*y;case 'weeks':case 'week':case 'w':return n*w;case 'days':case 'day':case 'd':return n*d;case 'hours':case 'hour':case 'hrs':case 'hr':case 'h':return n*h;case 'minutes':case 'minute':case 'mins':case 'min':case 'm':return n*m;case 'seconds':case 'second':case 'secs':case 'sec':case 's':return n*s;case 'milliseconds':case 'millisecond':case 'msecs':case 'msec':case 'ms':return n;default:return undefined;}}
function fmtShort(ms){var msAbs=Math.abs(ms);if(msAbs>=d){return Math.round(ms/d)+'d';}
if(msAbs>=h){return Math.round(ms/h)+'h';}
if(msAbs>=m){return Math.round(ms/m)+'m';}
if(msAbs>=s){return Math.round(ms/s)+'s';}
return ms+'ms';}
function fmtLong(ms){var msAbs=Math.abs(ms);if(msAbs>=d){return plural(ms,msAbs,d,'day');}
if(msAbs>=h){return plural(ms,msAbs,h,'hour');}
if(msAbs>=m){return plural(ms,msAbs,m,'minute');}
if(msAbs>=s){return plural(ms,msAbs,s,'second');}
return ms+' ms';}
function plural(ms,msAbs,n,name){var isPlural=msAbs>=n*1.5;return Math.round(ms/n)+' '+name+(isPlural?'s':'');}},{}],22:[function(require,module,exports){var wrappy=require('wrappy')
module.exports=wrappy(once)
module.exports.strict=wrappy(onceStrict)
once.proto=once(function(){Object.defineProperty(Function.prototype,'once',{value:function(){return once(this)},configurable:true})
Object.defineProperty(Function.prototype,'onceStrict',{value:function(){return onceStrict(this)},configurable:true})})
function once(fn){var f=function(){if(f.called)return f.value
f.called=true
return f.value=fn.apply(this,arguments)}
f.called=false
return f}
function onceStrict(fn){var f=function(){if(f.called)
throw new Error(f.onceError)
f.called=true
return f.value=fn.apply(this,arguments)}
var name=fn.name||'Function wrapped with `once`'
f.onceError=name+" shouldn't be called more than once"
f.called=false
return f}},{"wrappy":49}],23:[function(require,module,exports){var process=module.exports={};var cachedSetTimeout;var cachedClearTimeout;function defaultSetTimout(){throw new Error('setTimeout has not been defined');}
function defaultClearTimeout(){throw new Error('clearTimeout has not been defined');}
(function(){try{if(typeof setTimeout==='function'){cachedSetTimeout=setTimeout;}else{cachedSetTimeout=defaultSetTimout;}}catch(e){cachedSetTimeout=defaultSetTimout;}
try{if(typeof clearTimeout==='function'){cachedClearTimeout=clearTimeout;}else{cachedClearTimeout=defaultClearTimeout;}}catch(e){cachedClearTimeout=defaultClearTimeout;}}())
function runTimeout(fun){if(cachedSetTimeout===setTimeout){return setTimeout(fun,0);}
if((cachedSetTimeout===defaultSetTimout||!cachedSetTimeout)&&setTimeout){cachedSetTimeout=setTimeout;return setTimeout(fun,0);}
try{return cachedSetTimeout(fun,0);}catch(e){try{return cachedSetTimeout.call(null,fun,0);}catch(e){return cachedSetTimeout.call(this,fun,0);}}}
function runClearTimeout(marker){if(cachedClearTimeout===clearTimeout){return clearTimeout(marker);}
if((cachedClearTimeout===defaultClearTimeout||!cachedClearTimeout)&&clearTimeout){cachedClearTimeout=clearTimeout;return clearTimeout(marker);}
try{return cachedClearTimeout(marker);}catch(e){try{return cachedClearTimeout.call(null,marker);}catch(e){return cachedClearTimeout.call(this,marker);}}}
var queue=[];var draining=false;var currentQueue;var queueIndex=-1;function cleanUpNextTick(){if(!draining||!currentQueue){return;}
draining=false;if(currentQueue.length){queue=currentQueue.concat(queue);}else{queueIndex=-1;}
if(queue.length){drainQueue();}}
function drainQueue(){if(draining){return;}
var timeout=runTimeout(cleanUpNextTick);draining=true;var len=queue.length;while(len){currentQueue=queue;queue=[];while(++queueIndex<len){if(currentQueue){currentQueue[queueIndex].run();}}
queueIndex=-1;len=queue.length;}
currentQueue=null;draining=false;runClearTimeout(timeout);}
process.nextTick=function(fun){var args=new Array(arguments.length-1);if(arguments.length>1){for(var i=1;i<arguments.length;i++){args[i-1]=arguments[i];}}
queue.push(new Item(fun,args));if(queue.length===1&&!draining){runTimeout(drainQueue);}};function Item(fun,array){this.fun=fun;this.array=array;}
Item.prototype.run=function(){this.fun.apply(null,this.array);};process.title='browser';process.browser=true;process.env={};process.argv=[];process.version='';process.versions={};function noop(){}
process.on=noop;process.addListener=noop;process.once=noop;process.off=noop;process.removeListener=noop;process.removeAllListeners=noop;process.emit=noop;process.prependListener=noop;process.prependOnceListener=noop;process.listeners=function(name){return[]}
process.binding=function(name){throw new Error('process.binding is not supported');};process.cwd=function(){return '/'};process.chdir=function(dir){throw new Error('process.chdir is not supported');};process.umask=function(){return 0;};},{}],24:[function(require,module,exports){(function(global){(function(){/*!queue-microtask. MIT License. Feross Aboukhadijeh <https://feross.org/opensource>*/let promise
module.exports=typeof queueMicrotask==='function'?queueMicrotask.bind(typeof window!=='undefined'?window:global):cb=>(promise||(promise=Promise.resolve())).then(cb).catch(err=>setTimeout(()=>{throw err},0))}).call(this)}).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{}],25:[function(require,module,exports){(function(process,global){(function(){'use strict'
var MAX_BYTES=65536
var MAX_UINT32=4294967295
function oldBrowser(){throw new Error('Secure random number generation is not supported by this browser.\nUse Chrome, Firefox or Internet Explorer 11')}
var Buffer=require('safe-buffer').Buffer
var crypto=global.crypto||global.msCrypto
if(crypto&&crypto.getRandomValues){module.exports=randomBytes}else{module.exports=oldBrowser}
function randomBytes(size,cb){if(size>MAX_UINT32)throw new RangeError('requested too many random bytes')
var bytes=Buffer.allocUnsafe(size)
if(size>0){if(size>MAX_BYTES){for(var generated=0;generated<size;generated+=MAX_BYTES){crypto.getRandomValues(bytes.slice(generated,generated+MAX_BYTES))}}else{crypto.getRandomValues(bytes)}}
if(typeof cb==='function'){return process.nextTick(function(){cb(null,bytes)})}
return bytes}}).call(this)}).call(this,require('_process'),typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{"_process":23,"safe-buffer":42}],26:[function(require,module,exports){'use strict';function _inheritsLoose(subClass,superClass){subClass.prototype=Object.create(superClass.prototype);subClass.prototype.constructor=subClass;subClass.__proto__=superClass;}
var codes={};function createErrorType(code,message,Base){if(!Base){Base=Error;}
function getMessage(arg1,arg2,arg3){if(typeof message==='string'){return message;}else{return message(arg1,arg2,arg3);}}
var NodeError=function(_Base){_inheritsLoose(NodeError,_Base);function NodeError(arg1,arg2,arg3){return _Base.call(this,getMessage(arg1,arg2,arg3))||this;}
return NodeError;}(Base);NodeError.prototype.name=Base.name;NodeError.prototype.code=code;codes[code]=NodeError;}
function oneOf(expected,thing){if(Array.isArray(expected)){var len=expected.length;expected=expected.map(function(i){return String(i);});if(len>2){return "one of ".concat(thing," ").concat(expected.slice(0,len-1).join(', '),", or ")+expected[len-1];}else if(len===2){return "one of ".concat(thing," ").concat(expected[0]," or ").concat(expected[1]);}else{return "of ".concat(thing," ").concat(expected[0]);}}else{return "of ".concat(thing," ").concat(String(expected));}}
function startsWith(str,search,pos){return str.substr(!pos||pos<0?0:+pos,search.length)===search;}
function endsWith(str,search,this_len){if(this_len===undefined||this_len>str.length){this_len=str.length;}
return str.substring(this_len-search.length,this_len)===search;}
function includes(str,search,start){if(typeof start!=='number'){start=0;}
if(start+search.length>str.length){return false;}else{return str.indexOf(search,start)!==-1;}}
createErrorType('ERR_INVALID_OPT_VALUE',function(name,value){return 'The value "'+value+'" is invalid for option "'+name+'"';},TypeError);createErrorType('ERR_INVALID_ARG_TYPE',function(name,expected,actual){var determiner;if(typeof expected==='string'&&startsWith(expected,'not ')){determiner='must not be';expected=expected.replace(/^not /,'');}else{determiner='must be';}
var msg;if(endsWith(name,' argument')){msg="The ".concat(name," ").concat(determiner," ").concat(oneOf(expected,'type'));}else{var type=includes(name,'.')?'property':'argument';msg="The \"".concat(name,"\" ").concat(type," ").concat(determiner," ").concat(oneOf(expected,'type'));}
msg+=". Received type ".concat(typeof actual);return msg;},TypeError);createErrorType('ERR_STREAM_PUSH_AFTER_EOF','stream.push() after EOF');createErrorType('ERR_METHOD_NOT_IMPLEMENTED',function(name){return 'The '+name+' method is not implemented';});createErrorType('ERR_STREAM_PREMATURE_CLOSE','Premature close');createErrorType('ERR_STREAM_DESTROYED',function(name){return 'Cannot call '+name+' after a stream was destroyed';});createErrorType('ERR_MULTIPLE_CALLBACK','Callback called multiple times');createErrorType('ERR_STREAM_CANNOT_PIPE','Cannot pipe, not readable');createErrorType('ERR_STREAM_WRITE_AFTER_END','write after end');createErrorType('ERR_STREAM_NULL_VALUES','May not write null values to stream',TypeError);createErrorType('ERR_UNKNOWN_ENCODING',function(arg){return 'Unknown encoding: '+arg;},TypeError);createErrorType('ERR_STREAM_UNSHIFT_AFTER_END_EVENT','stream.unshift() after end event');module.exports.codes=codes;},{}],27:[function(require,module,exports){(function(process){(function(){'use strict';var objectKeys=Object.keys||function(obj){var keys=[];for(var key in obj){keys.push(key);}
return keys;};module.exports=Duplex;var Readable=require('./_stream_readable');var Writable=require('./_stream_writable');require('inherits')(Duplex,Readable);{var keys=objectKeys(Writable.prototype);for(var v=0;v<keys.length;v++){var method=keys[v];if(!Duplex.prototype[method])Duplex.prototype[method]=Writable.prototype[method];}}
function Duplex(options){if(!(this instanceof Duplex))return new Duplex(options);Readable.call(this,options);Writable.call(this,options);this.allowHalfOpen=true;if(options){if(options.readable===false)this.readable=false;if(options.writable===false)this.writable=false;if(options.allowHalfOpen===false){this.allowHalfOpen=false;this.once('end',onend);}}}
Object.defineProperty(Duplex.prototype,'writableHighWaterMark',{enumerable:false,get:function get(){return this._writableState.highWaterMark;}});Object.defineProperty(Duplex.prototype,'writableBuffer',{enumerable:false,get:function get(){return this._writableState&&this._writableState.getBuffer();}});Object.defineProperty(Duplex.prototype,'writableLength',{enumerable:false,get:function get(){return this._writableState.length;}});function onend(){if(this._writableState.ended)return;process.nextTick(onEndNT,this);}
function onEndNT(self){self.end();}
Object.defineProperty(Duplex.prototype,'destroyed',{enumerable:false,get:function get(){if(this._readableState===undefined||this._writableState===undefined){return false;}
return this._readableState.destroyed&&this._writableState.destroyed;},set:function set(value){if(this._readableState===undefined||this._writableState===undefined){return;}
this._readableState.destroyed=value;this._writableState.destroyed=value;}});}).call(this)}).call(this,require('_process'))},{"./_stream_readable":29,"./_stream_writable":31,"_process":23,"inherits":20}],28:[function(require,module,exports){'use strict';module.exports=PassThrough;var Transform=require('./_stream_transform');require('inherits')(PassThrough,Transform);function PassThrough(options){if(!(this instanceof PassThrough))return new PassThrough(options);Transform.call(this,options);}
PassThrough.prototype._transform=function(chunk,encoding,cb){cb(null,chunk);};},{"./_stream_transform":30,"inherits":20}],29:[function(require,module,exports){(function(process,global){(function(){'use strict';module.exports=Readable;var Duplex;Readable.ReadableState=ReadableState;var EE=require('events').EventEmitter;var EElistenerCount=function EElistenerCount(emitter,type){return emitter.listeners(type).length;};var Stream=require('./internal/streams/stream');var Buffer=require('buffer').Buffer;var OurUint8Array=global.Uint8Array||function(){};function _uint8ArrayToBuffer(chunk){return Buffer.from(chunk);}
function _isUint8Array(obj){return Buffer.isBuffer(obj)||obj instanceof OurUint8Array;}
var debugUtil=require('util');var debug;if(debugUtil&&debugUtil.debuglog){debug=debugUtil.debuglog('stream');}else{debug=function debug(){};}
var BufferList=require('./internal/streams/buffer_list');var destroyImpl=require('./internal/streams/destroy');var _require=require('./internal/streams/state'),getHighWaterMark=_require.getHighWaterMark;var _require$codes=require('../errors').codes,ERR_INVALID_ARG_TYPE=_require$codes.ERR_INVALID_ARG_TYPE,ERR_STREAM_PUSH_AFTER_EOF=_require$codes.ERR_STREAM_PUSH_AFTER_EOF,ERR_METHOD_NOT_IMPLEMENTED=_require$codes.ERR_METHOD_NOT_IMPLEMENTED,ERR_STREAM_UNSHIFT_AFTER_END_EVENT=_require$codes.ERR_STREAM_UNSHIFT_AFTER_END_EVENT;var StringDecoder;var createReadableStreamAsyncIterator;var from;require('inherits')(Readable,Stream);var errorOrDestroy=destroyImpl.errorOrDestroy;var kProxyEvents=['error','close','destroy','pause','resume'];function prependListener(emitter,event,fn){if(typeof emitter.prependListener==='function')return emitter.prependListener(event,fn);if(!emitter._events||!emitter._events[event])emitter.on(event,fn);else if(Array.isArray(emitter._events[event]))emitter._events[event].unshift(fn);else emitter._events[event]=[fn,emitter._events[event]];}
function ReadableState(options,stream,isDuplex){Duplex=Duplex||require('./_stream_duplex');options=options||{};if(typeof isDuplex!=='boolean')isDuplex=stream instanceof Duplex;this.objectMode=!!options.objectMode;if(isDuplex)this.objectMode=this.objectMode||!!options.readableObjectMode;this.highWaterMark=getHighWaterMark(this,options,'readableHighWaterMark',isDuplex);this.buffer=new BufferList();this.length=0;this.pipes=null;this.pipesCount=0;this.flowing=null;this.ended=false;this.endEmitted=false;this.reading=false;this.sync=true;this.needReadable=false;this.emittedReadable=false;this.readableListening=false;this.resumeScheduled=false;this.paused=true;this.emitClose=options.emitClose!==false;this.autoDestroy=!!options.autoDestroy;this.destroyed=false;this.defaultEncoding=options.defaultEncoding||'utf8';this.awaitDrain=0;this.readingMore=false;this.decoder=null;this.encoding=null;if(options.encoding){if(!StringDecoder)StringDecoder=require('string_decoder/').StringDecoder;this.decoder=new StringDecoder(options.encoding);this.encoding=options.encoding;}}
function Readable(options){Duplex=Duplex||require('./_stream_duplex');if(!(this instanceof Readable))return new Readable(options);var isDuplex=this instanceof Duplex;this._readableState=new ReadableState(options,this,isDuplex);this.readable=true;if(options){if(typeof options.read==='function')this._read=options.read;if(typeof options.destroy==='function')this._destroy=options.destroy;}
Stream.call(this);}
Object.defineProperty(Readable.prototype,'destroyed',{enumerable:false,get:function get(){if(this._readableState===undefined){return false;}
return this._readableState.destroyed;},set:function set(value){if(!this._readableState){return;}
this._readableState.destroyed=value;}});Readable.prototype.destroy=destroyImpl.destroy;Readable.prototype._undestroy=destroyImpl.undestroy;Readable.prototype._destroy=function(err,cb){cb(err);};Readable.prototype.push=function(chunk,encoding){var state=this._readableState;var skipChunkCheck;if(!state.objectMode){if(typeof chunk==='string'){encoding=encoding||state.defaultEncoding;if(encoding!==state.encoding){chunk=Buffer.from(chunk,encoding);encoding='';}
skipChunkCheck=true;}}else{skipChunkCheck=true;}
return readableAddChunk(this,chunk,encoding,false,skipChunkCheck);};Readable.prototype.unshift=function(chunk){return readableAddChunk(this,chunk,null,true,false);};function readableAddChunk(stream,chunk,encoding,addToFront,skipChunkCheck){debug('readableAddChunk',chunk);var state=stream._readableState;if(chunk===null){state.reading=false;onEofChunk(stream,state);}else{var er;if(!skipChunkCheck)er=chunkInvalid(state,chunk);if(er){errorOrDestroy(stream,er);}else if(state.objectMode||chunk&&chunk.length>0){if(typeof chunk!=='string'&&!state.objectMode&&Object.getPrototypeOf(chunk)!==Buffer.prototype){chunk=_uint8ArrayToBuffer(chunk);}
if(addToFront){if(state.endEmitted)errorOrDestroy(stream,new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());else addChunk(stream,state,chunk,true);}else if(state.ended){errorOrDestroy(stream,new ERR_STREAM_PUSH_AFTER_EOF());}else if(state.destroyed){return false;}else{state.reading=false;if(state.decoder&&!encoding){chunk=state.decoder.write(chunk);if(state.objectMode||chunk.length!==0)addChunk(stream,state,chunk,false);else maybeReadMore(stream,state);}else{addChunk(stream,state,chunk,false);}}}else if(!addToFront){state.reading=false;maybeReadMore(stream,state);}}
return!state.ended&&(state.length<state.highWaterMark||state.length===0);}
function addChunk(stream,state,chunk,addToFront){if(state.flowing&&state.length===0&&!state.sync){state.awaitDrain=0;stream.emit('data',chunk);}else{state.length+=state.objectMode?1:chunk.length;if(addToFront)state.buffer.unshift(chunk);else state.buffer.push(chunk);if(state.needReadable)emitReadable(stream);}
maybeReadMore(stream,state);}
function chunkInvalid(state,chunk){var er;if(!_isUint8Array(chunk)&&typeof chunk!=='string'&&chunk!==undefined&&!state.objectMode){er=new ERR_INVALID_ARG_TYPE('chunk',['string','Buffer','Uint8Array'],chunk);}
return er;}
Readable.prototype.isPaused=function(){return this._readableState.flowing===false;};Readable.prototype.setEncoding=function(enc){if(!StringDecoder)StringDecoder=require('string_decoder/').StringDecoder;var decoder=new StringDecoder(enc);this._readableState.decoder=decoder;this._readableState.encoding=this._readableState.decoder.encoding;var p=this._readableState.buffer.head;var content='';while(p!==null){content+=decoder.write(p.data);p=p.next;}
this._readableState.buffer.clear();if(content!=='')this._readableState.buffer.push(content);this._readableState.length=content.length;return this;};var MAX_HWM=0x40000000;function computeNewHighWaterMark(n){if(n>=MAX_HWM){n=MAX_HWM;}else{n--;n|=n>>>1;n|=n>>>2;n|=n>>>4;n|=n>>>8;n|=n>>>16;n++;}
return n;}
function howMuchToRead(n,state){if(n<=0||state.length===0&&state.ended)return 0;if(state.objectMode)return 1;if(n!==n){if(state.flowing&&state.length)return state.buffer.head.data.length;else return state.length;}
if(n>state.highWaterMark)state.highWaterMark=computeNewHighWaterMark(n);if(n<=state.length)return n;if(!state.ended){state.needReadable=true;return 0;}
return state.length;}
Readable.prototype.read=function(n){debug('read',n);n=parseInt(n,10);var state=this._readableState;var nOrig=n;if(n!==0)state.emittedReadable=false;if(n===0&&state.needReadable&&((state.highWaterMark!==0?state.length>=state.highWaterMark:state.length>0)||state.ended)){debug('read: emitReadable',state.length,state.ended);if(state.length===0&&state.ended)endReadable(this);else emitReadable(this);return null;}
n=howMuchToRead(n,state);if(n===0&&state.ended){if(state.length===0)endReadable(this);return null;}
var doRead=state.needReadable;debug('need readable',doRead);if(state.length===0||state.length-n<state.highWaterMark){doRead=true;debug('length less than watermark',doRead);}
if(state.ended||state.reading){doRead=false;debug('reading or ended',doRead);}else if(doRead){debug('do read');state.reading=true;state.sync=true;if(state.length===0)state.needReadable=true;this._read(state.highWaterMark);state.sync=false;if(!state.reading)n=howMuchToRead(nOrig,state);}
var ret;if(n>0)ret=fromList(n,state);else ret=null;if(ret===null){state.needReadable=state.length<=state.highWaterMark;n=0;}else{state.length-=n;state.awaitDrain=0;}
if(state.length===0){if(!state.ended)state.needReadable=true;if(nOrig!==n&&state.ended)endReadable(this);}
if(ret!==null)this.emit('data',ret);return ret;};function onEofChunk(stream,state){debug('onEofChunk');if(state.ended)return;if(state.decoder){var chunk=state.decoder.end();if(chunk&&chunk.length){state.buffer.push(chunk);state.length+=state.objectMode?1:chunk.length;}}
state.ended=true;if(state.sync){emitReadable(stream);}else{state.needReadable=false;if(!state.emittedReadable){state.emittedReadable=true;emitReadable_(stream);}}}
function emitReadable(stream){var state=stream._readableState;debug('emitReadable',state.needReadable,state.emittedReadable);state.needReadable=false;if(!state.emittedReadable){debug('emitReadable',state.flowing);state.emittedReadable=true;process.nextTick(emitReadable_,stream);}}
function emitReadable_(stream){var state=stream._readableState;debug('emitReadable_',state.destroyed,state.length,state.ended);if(!state.destroyed&&(state.length||state.ended)){stream.emit('readable');state.emittedReadable=false;}
state.needReadable=!state.flowing&&!state.ended&&state.length<=state.highWaterMark;flow(stream);}
function maybeReadMore(stream,state){if(!state.readingMore){state.readingMore=true;process.nextTick(maybeReadMore_,stream,state);}}
function maybeReadMore_(stream,state){while(!state.reading&&!state.ended&&(state.length<state.highWaterMark||state.flowing&&state.length===0)){var len=state.length;debug('maybeReadMore read 0');stream.read(0);if(len===state.length)
break;}
state.readingMore=false;}
Readable.prototype._read=function(n){errorOrDestroy(this,new ERR_METHOD_NOT_IMPLEMENTED('_read()'));};Readable.prototype.pipe=function(dest,pipeOpts){var src=this;var state=this._readableState;switch(state.pipesCount){case 0:state.pipes=dest;break;case 1:state.pipes=[state.pipes,dest];break;default:state.pipes.push(dest);break;}
state.pipesCount+=1;debug('pipe count=%d opts=%j',state.pipesCount,pipeOpts);var doEnd=(!pipeOpts||pipeOpts.end!==false)&&dest!==process.stdout&&dest!==process.stderr;var endFn=doEnd?onend:unpipe;if(state.endEmitted)process.nextTick(endFn);else src.once('end',endFn);dest.on('unpipe',onunpipe);function onunpipe(readable,unpipeInfo){debug('onunpipe');if(readable===src){if(unpipeInfo&&unpipeInfo.hasUnpiped===false){unpipeInfo.hasUnpiped=true;cleanup();}}}
function onend(){debug('onend');dest.end();}
var ondrain=pipeOnDrain(src);dest.on('drain',ondrain);var cleanedUp=false;function cleanup(){debug('cleanup');dest.removeListener('close',onclose);dest.removeListener('finish',onfinish);dest.removeListener('drain',ondrain);dest.removeListener('error',onerror);dest.removeListener('unpipe',onunpipe);src.removeListener('end',onend);src.removeListener('end',unpipe);src.removeListener('data',ondata);cleanedUp=true;if(state.awaitDrain&&(!dest._writableState||dest._writableState.needDrain))ondrain();}
src.on('data',ondata);function ondata(chunk){debug('ondata');var ret=dest.write(chunk);debug('dest.write',ret);if(ret===false){if((state.pipesCount===1&&state.pipes===dest||state.pipesCount>1&&indexOf(state.pipes,dest)!==-1)&&!cleanedUp){debug('false write response, pause',state.awaitDrain);state.awaitDrain++;}
src.pause();}}
function onerror(er){debug('onerror',er);unpipe();dest.removeListener('error',onerror);if(EElistenerCount(dest,'error')===0)errorOrDestroy(dest,er);}
prependListener(dest,'error',onerror);function onclose(){dest.removeListener('finish',onfinish);unpipe();}
dest.once('close',onclose);function onfinish(){debug('onfinish');dest.removeListener('close',onclose);unpipe();}
dest.once('finish',onfinish);function unpipe(){debug('unpipe');src.unpipe(dest);}
dest.emit('pipe',src);if(!state.flowing){debug('pipe resume');src.resume();}
return dest;};function pipeOnDrain(src){return function pipeOnDrainFunctionResult(){var state=src._readableState;debug('pipeOnDrain',state.awaitDrain);if(state.awaitDrain)state.awaitDrain--;if(state.awaitDrain===0&&EElistenerCount(src,'data')){state.flowing=true;flow(src);}};}
Readable.prototype.unpipe=function(dest){var state=this._readableState;var unpipeInfo={hasUnpiped:false};if(state.pipesCount===0)return this;if(state.pipesCount===1){if(dest&&dest!==state.pipes)return this;if(!dest)dest=state.pipes;state.pipes=null;state.pipesCount=0;state.flowing=false;if(dest)dest.emit('unpipe',this,unpipeInfo);return this;}
if(!dest){var dests=state.pipes;var len=state.pipesCount;state.pipes=null;state.pipesCount=0;state.flowing=false;for(var i=0;i<len;i++){dests[i].emit('unpipe',this,{hasUnpiped:false});}
return this;}
var index=indexOf(state.pipes,dest);if(index===-1)return this;state.pipes.splice(index,1);state.pipesCount-=1;if(state.pipesCount===1)state.pipes=state.pipes[0];dest.emit('unpipe',this,unpipeInfo);return this;};Readable.prototype.on=function(ev,fn){var res=Stream.prototype.on.call(this,ev,fn);var state=this._readableState;if(ev==='data'){state.readableListening=this.listenerCount('readable')>0;if(state.flowing!==false)this.resume();}else if(ev==='readable'){if(!state.endEmitted&&!state.readableListening){state.readableListening=state.needReadable=true;state.flowing=false;state.emittedReadable=false;debug('on readable',state.length,state.reading);if(state.length){emitReadable(this);}else if(!state.reading){process.nextTick(nReadingNextTick,this);}}}
return res;};Readable.prototype.addListener=Readable.prototype.on;Readable.prototype.removeListener=function(ev,fn){var res=Stream.prototype.removeListener.call(this,ev,fn);if(ev==='readable'){process.nextTick(updateReadableListening,this);}
return res;};Readable.prototype.removeAllListeners=function(ev){var res=Stream.prototype.removeAllListeners.apply(this,arguments);if(ev==='readable'||ev===undefined){process.nextTick(updateReadableListening,this);}
return res;};function updateReadableListening(self){var state=self._readableState;state.readableListening=self.listenerCount('readable')>0;if(state.resumeScheduled&&!state.paused){state.flowing=true;}else if(self.listenerCount('data')>0){self.resume();}}
function nReadingNextTick(self){debug('readable nexttick read 0');self.read(0);}
Readable.prototype.resume=function(){var state=this._readableState;if(!state.flowing){debug('resume');state.flowing=!state.readableListening;resume(this,state);}
state.paused=false;return this;};function resume(stream,state){if(!state.resumeScheduled){state.resumeScheduled=true;process.nextTick(resume_,stream,state);}}
function resume_(stream,state){debug('resume',state.reading);if(!state.reading){stream.read(0);}
state.resumeScheduled=false;stream.emit('resume');flow(stream);if(state.flowing&&!state.reading)stream.read(0);}
Readable.prototype.pause=function(){debug('call pause flowing=%j',this._readableState.flowing);if(this._readableState.flowing!==false){debug('pause');this._readableState.flowing=false;this.emit('pause');}
this._readableState.paused=true;return this;};function flow(stream){var state=stream._readableState;debug('flow',state.flowing);while(state.flowing&&stream.read()!==null){;}}
Readable.prototype.wrap=function(stream){var _this=this;var state=this._readableState;var paused=false;stream.on('end',function(){debug('wrapped end');if(state.decoder&&!state.ended){var chunk=state.decoder.end();if(chunk&&chunk.length)_this.push(chunk);}
_this.push(null);});stream.on('data',function(chunk){debug('wrapped data');if(state.decoder)chunk=state.decoder.write(chunk);if(state.objectMode&&(chunk===null||chunk===undefined))return;else if(!state.objectMode&&(!chunk||!chunk.length))return;var ret=_this.push(chunk);if(!ret){paused=true;stream.pause();}});for(var i in stream){if(this[i]===undefined&&typeof stream[i]==='function'){this[i]=function methodWrap(method){return function methodWrapReturnFunction(){return stream[method].apply(stream,arguments);};}(i);}}
for(var n=0;n<kProxyEvents.length;n++){stream.on(kProxyEvents[n],this.emit.bind(this,kProxyEvents[n]));}
this._read=function(n){debug('wrapped _read',n);if(paused){paused=false;stream.resume();}};return this;};if(typeof Symbol==='function'){Readable.prototype[Symbol.asyncIterator]=function(){if(createReadableStreamAsyncIterator===undefined){createReadableStreamAsyncIterator=require('./internal/streams/async_iterator');}
return createReadableStreamAsyncIterator(this);};}
Object.defineProperty(Readable.prototype,'readableHighWaterMark',{enumerable:false,get:function get(){return this._readableState.highWaterMark;}});Object.defineProperty(Readable.prototype,'readableBuffer',{enumerable:false,get:function get(){return this._readableState&&this._readableState.buffer;}});Object.defineProperty(Readable.prototype,'readableFlowing',{enumerable:false,get:function get(){return this._readableState.flowing;},set:function set(state){if(this._readableState){this._readableState.flowing=state;}}});Readable._fromList=fromList;Object.defineProperty(Readable.prototype,'readableLength',{enumerable:false,get:function get(){return this._readableState.length;}});function fromList(n,state){if(state.length===0)return null;var ret;if(state.objectMode)ret=state.buffer.shift();else if(!n||n>=state.length){if(state.decoder)ret=state.buffer.join('');else if(state.buffer.length===1)ret=state.buffer.first();else ret=state.buffer.concat(state.length);state.buffer.clear();}else{ret=state.buffer.consume(n,state.decoder);}
return ret;}
function endReadable(stream){var state=stream._readableState;debug('endReadable',state.endEmitted);if(!state.endEmitted){state.ended=true;process.nextTick(endReadableNT,state,stream);}}
function endReadableNT(state,stream){debug('endReadableNT',state.endEmitted,state.length);if(!state.endEmitted&&state.length===0){state.endEmitted=true;stream.readable=false;stream.emit('end');if(state.autoDestroy){var wState=stream._writableState;if(!wState||wState.autoDestroy&&wState.finished){stream.destroy();}}}}
if(typeof Symbol==='function'){Readable.from=function(iterable,opts){if(from===undefined){from=require('./internal/streams/from');}
return from(Readable,iterable,opts);};}
function indexOf(xs,x){for(var i=0,l=xs.length;i<l;i++){if(xs[i]===x)return i;}
return-1;}}).call(this)}).call(this,require('_process'),typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{"../errors":26,"./_stream_duplex":27,"./internal/streams/async_iterator":32,"./internal/streams/buffer_list":33,"./internal/streams/destroy":34,"./internal/streams/from":36,"./internal/streams/state":38,"./internal/streams/stream":39,"_process":23,"buffer":"buffer","events":"events","inherits":20,"string_decoder/":47,"util":15}],30:[function(require,module,exports){'use strict';module.exports=Transform;var _require$codes=require('../errors').codes,ERR_METHOD_NOT_IMPLEMENTED=_require$codes.ERR_METHOD_NOT_IMPLEMENTED,ERR_MULTIPLE_CALLBACK=_require$codes.ERR_MULTIPLE_CALLBACK,ERR_TRANSFORM_ALREADY_TRANSFORMING=_require$codes.ERR_TRANSFORM_ALREADY_TRANSFORMING,ERR_TRANSFORM_WITH_LENGTH_0=_require$codes.ERR_TRANSFORM_WITH_LENGTH_0;var Duplex=require('./_stream_duplex');require('inherits')(Transform,Duplex);function afterTransform(er,data){var ts=this._transformState;ts.transforming=false;var cb=ts.writecb;if(cb===null){return this.emit('error',new ERR_MULTIPLE_CALLBACK());}
ts.writechunk=null;ts.writecb=null;if(data!=null)
this.push(data);cb(er);var rs=this._readableState;rs.reading=false;if(rs.needReadable||rs.length<rs.highWaterMark){this._read(rs.highWaterMark);}}
function Transform(options){if(!(this instanceof Transform))return new Transform(options);Duplex.call(this,options);this._transformState={afterTransform:afterTransform.bind(this),needTransform:false,transforming:false,writecb:null,writechunk:null,writeencoding:null};this._readableState.needReadable=true;this._readableState.sync=false;if(options){if(typeof options.transform==='function')this._transform=options.transform;if(typeof options.flush==='function')this._flush=options.flush;}
this.on('prefinish',prefinish);}
function prefinish(){var _this=this;if(typeof this._flush==='function'&&!this._readableState.destroyed){this._flush(function(er,data){done(_this,er,data);});}else{done(this,null,null);}}
Transform.prototype.push=function(chunk,encoding){this._transformState.needTransform=false;return Duplex.prototype.push.call(this,chunk,encoding);};Transform.prototype._transform=function(chunk,encoding,cb){cb(new ERR_METHOD_NOT_IMPLEMENTED('_transform()'));};Transform.prototype._write=function(chunk,encoding,cb){var ts=this._transformState;ts.writecb=cb;ts.writechunk=chunk;ts.writeencoding=encoding;if(!ts.transforming){var rs=this._readableState;if(ts.needTransform||rs.needReadable||rs.length<rs.highWaterMark)this._read(rs.highWaterMark);}};Transform.prototype._read=function(n){var ts=this._transformState;if(ts.writechunk!==null&&!ts.transforming){ts.transforming=true;this._transform(ts.writechunk,ts.writeencoding,ts.afterTransform);}else{ts.needTransform=true;}};Transform.prototype._destroy=function(err,cb){Duplex.prototype._destroy.call(this,err,function(err2){cb(err2);});};function done(stream,er,data){if(er)return stream.emit('error',er);if(data!=null)
stream.push(data);if(stream._writableState.length)throw new ERR_TRANSFORM_WITH_LENGTH_0();if(stream._transformState.transforming)throw new ERR_TRANSFORM_ALREADY_TRANSFORMING();return stream.push(null);}},{"../errors":26,"./_stream_duplex":27,"inherits":20}],31:[function(require,module,exports){(function(process,global){(function(){'use strict';module.exports=Writable;function WriteReq(chunk,encoding,cb){this.chunk=chunk;this.encoding=encoding;this.callback=cb;this.next=null;}
function CorkedRequest(state){var _this=this;this.next=null;this.entry=null;this.finish=function(){onCorkedFinish(_this,state);};}
var Duplex;Writable.WritableState=WritableState;var internalUtil={deprecate:require('util-deprecate')};var Stream=require('./internal/streams/stream');var Buffer=require('buffer').Buffer;var OurUint8Array=global.Uint8Array||function(){};function _uint8ArrayToBuffer(chunk){return Buffer.from(chunk);}
function _isUint8Array(obj){return Buffer.isBuffer(obj)||obj instanceof OurUint8Array;}
var destroyImpl=require('./internal/streams/destroy');var _require=require('./internal/streams/state'),getHighWaterMark=_require.getHighWaterMark;var _require$codes=require('../errors').codes,ERR_INVALID_ARG_TYPE=_require$codes.ERR_INVALID_ARG_TYPE,ERR_METHOD_NOT_IMPLEMENTED=_require$codes.ERR_METHOD_NOT_IMPLEMENTED,ERR_MULTIPLE_CALLBACK=_require$codes.ERR_MULTIPLE_CALLBACK,ERR_STREAM_CANNOT_PIPE=_require$codes.ERR_STREAM_CANNOT_PIPE,ERR_STREAM_DESTROYED=_require$codes.ERR_STREAM_DESTROYED,ERR_STREAM_NULL_VALUES=_require$codes.ERR_STREAM_NULL_VALUES,ERR_STREAM_WRITE_AFTER_END=_require$codes.ERR_STREAM_WRITE_AFTER_END,ERR_UNKNOWN_ENCODING=_require$codes.ERR_UNKNOWN_ENCODING;var errorOrDestroy=destroyImpl.errorOrDestroy;require('inherits')(Writable,Stream);function nop(){}
function WritableState(options,stream,isDuplex){Duplex=Duplex||require('./_stream_duplex');options=options||{};if(typeof isDuplex!=='boolean')isDuplex=stream instanceof Duplex;this.objectMode=!!options.objectMode;if(isDuplex)this.objectMode=this.objectMode||!!options.writableObjectMode;this.highWaterMark=getHighWaterMark(this,options,'writableHighWaterMark',isDuplex);this.finalCalled=false;this.needDrain=false;this.ending=false;this.ended=false;this.finished=false;this.destroyed=false;var noDecode=options.decodeStrings===false;this.decodeStrings=!noDecode;this.defaultEncoding=options.defaultEncoding||'utf8';this.length=0;this.writing=false;this.corked=0;this.sync=true;this.bufferProcessing=false;this.onwrite=function(er){onwrite(stream,er);};this.writecb=null;this.writelen=0;this.bufferedRequest=null;this.lastBufferedRequest=null;this.pendingcb=0;this.prefinished=false;this.errorEmitted=false;this.emitClose=options.emitClose!==false;this.autoDestroy=!!options.autoDestroy;this.bufferedRequestCount=0;this.corkedRequestsFree=new CorkedRequest(this);}
WritableState.prototype.getBuffer=function getBuffer(){var current=this.bufferedRequest;var out=[];while(current){out.push(current);current=current.next;}
return out;};(function(){try{Object.defineProperty(WritableState.prototype,'buffer',{get:internalUtil.deprecate(function writableStateBufferGetter(){return this.getBuffer();},'_writableState.buffer is deprecated. Use _writableState.getBuffer '+'instead.','DEP0003')});}catch(_){}})();var realHasInstance;if(typeof Symbol==='function'&&Symbol.hasInstance&&typeof Function.prototype[Symbol.hasInstance]==='function'){realHasInstance=Function.prototype[Symbol.hasInstance];Object.defineProperty(Writable,Symbol.hasInstance,{value:function value(object){if(realHasInstance.call(this,object))return true;if(this!==Writable)return false;return object&&object._writableState instanceof WritableState;}});}else{realHasInstance=function realHasInstance(object){return object instanceof this;};}
function Writable(options){Duplex=Duplex||require('./_stream_duplex');var isDuplex=this instanceof Duplex;if(!isDuplex&&!realHasInstance.call(Writable,this))return new Writable(options);this._writableState=new WritableState(options,this,isDuplex);this.writable=true;if(options){if(typeof options.write==='function')this._write=options.write;if(typeof options.writev==='function')this._writev=options.writev;if(typeof options.destroy==='function')this._destroy=options.destroy;if(typeof options.final==='function')this._final=options.final;}
Stream.call(this);}
Writable.prototype.pipe=function(){errorOrDestroy(this,new ERR_STREAM_CANNOT_PIPE());};function writeAfterEnd(stream,cb){var er=new ERR_STREAM_WRITE_AFTER_END();errorOrDestroy(stream,er);process.nextTick(cb,er);}
function validChunk(stream,state,chunk,cb){var er;if(chunk===null){er=new ERR_STREAM_NULL_VALUES();}else if(typeof chunk!=='string'&&!state.objectMode){er=new ERR_INVALID_ARG_TYPE('chunk',['string','Buffer'],chunk);}
if(er){errorOrDestroy(stream,er);process.nextTick(cb,er);return false;}
return true;}
Writable.prototype.write=function(chunk,encoding,cb){var state=this._writableState;var ret=false;var isBuf=!state.objectMode&&_isUint8Array(chunk);if(isBuf&&!Buffer.isBuffer(chunk)){chunk=_uint8ArrayToBuffer(chunk);}
if(typeof encoding==='function'){cb=encoding;encoding=null;}
if(isBuf)encoding='buffer';else if(!encoding)encoding=state.defaultEncoding;if(typeof cb!=='function')cb=nop;if(state.ending)writeAfterEnd(this,cb);else if(isBuf||validChunk(this,state,chunk,cb)){state.pendingcb++;ret=writeOrBuffer(this,state,isBuf,chunk,encoding,cb);}
return ret;};Writable.prototype.cork=function(){this._writableState.corked++;};Writable.prototype.uncork=function(){var state=this._writableState;if(state.corked){state.corked--;if(!state.writing&&!state.corked&&!state.bufferProcessing&&state.bufferedRequest)clearBuffer(this,state);}};Writable.prototype.setDefaultEncoding=function setDefaultEncoding(encoding){if(typeof encoding==='string')encoding=encoding.toLowerCase();if(!(['hex','utf8','utf-8','ascii','binary','base64','ucs2','ucs-2','utf16le','utf-16le','raw'].indexOf((encoding+'').toLowerCase())>-1))throw new ERR_UNKNOWN_ENCODING(encoding);this._writableState.defaultEncoding=encoding;return this;};Object.defineProperty(Writable.prototype,'writableBuffer',{enumerable:false,get:function get(){return this._writableState&&this._writableState.getBuffer();}});function decodeChunk(state,chunk,encoding){if(!state.objectMode&&state.decodeStrings!==false&&typeof chunk==='string'){chunk=Buffer.from(chunk,encoding);}
return chunk;}
Object.defineProperty(Writable.prototype,'writableHighWaterMark',{enumerable:false,get:function get(){return this._writableState.highWaterMark;}});function writeOrBuffer(stream,state,isBuf,chunk,encoding,cb){if(!isBuf){var newChunk=decodeChunk(state,chunk,encoding);if(chunk!==newChunk){isBuf=true;encoding='buffer';chunk=newChunk;}}
var len=state.objectMode?1:chunk.length;state.length+=len;var ret=state.length<state.highWaterMark;if(!ret)state.needDrain=true;if(state.writing||state.corked){var last=state.lastBufferedRequest;state.lastBufferedRequest={chunk:chunk,encoding:encoding,isBuf:isBuf,callback:cb,next:null};if(last){last.next=state.lastBufferedRequest;}else{state.bufferedRequest=state.lastBufferedRequest;}
state.bufferedRequestCount+=1;}else{doWrite(stream,state,false,len,chunk,encoding,cb);}
return ret;}
function doWrite(stream,state,writev,len,chunk,encoding,cb){state.writelen=len;state.writecb=cb;state.writing=true;state.sync=true;if(state.destroyed)state.onwrite(new ERR_STREAM_DESTROYED('write'));else if(writev)stream._writev(chunk,state.onwrite);else stream._write(chunk,encoding,state.onwrite);state.sync=false;}
function onwriteError(stream,state,sync,er,cb){--state.pendingcb;if(sync){process.nextTick(cb,er);process.nextTick(finishMaybe,stream,state);stream._writableState.errorEmitted=true;errorOrDestroy(stream,er);}else{cb(er);stream._writableState.errorEmitted=true;errorOrDestroy(stream,er);finishMaybe(stream,state);}}
function onwriteStateUpdate(state){state.writing=false;state.writecb=null;state.length-=state.writelen;state.writelen=0;}
function onwrite(stream,er){var state=stream._writableState;var sync=state.sync;var cb=state.writecb;if(typeof cb!=='function')throw new ERR_MULTIPLE_CALLBACK();onwriteStateUpdate(state);if(er)onwriteError(stream,state,sync,er,cb);else{var finished=needFinish(state)||stream.destroyed;if(!finished&&!state.corked&&!state.bufferProcessing&&state.bufferedRequest){clearBuffer(stream,state);}
if(sync){process.nextTick(afterWrite,stream,state,finished,cb);}else{afterWrite(stream,state,finished,cb);}}}
function afterWrite(stream,state,finished,cb){if(!finished)onwriteDrain(stream,state);state.pendingcb--;cb();finishMaybe(stream,state);}
function onwriteDrain(stream,state){if(state.length===0&&state.needDrain){state.needDrain=false;stream.emit('drain');}}
function clearBuffer(stream,state){state.bufferProcessing=true;var entry=state.bufferedRequest;if(stream._writev&&entry&&entry.next){var l=state.bufferedRequestCount;var buffer=new Array(l);var holder=state.corkedRequestsFree;holder.entry=entry;var count=0;var allBuffers=true;while(entry){buffer[count]=entry;if(!entry.isBuf)allBuffers=false;entry=entry.next;count+=1;}
buffer.allBuffers=allBuffers;doWrite(stream,state,true,state.length,buffer,'',holder.finish);state.pendingcb++;state.lastBufferedRequest=null;if(holder.next){state.corkedRequestsFree=holder.next;holder.next=null;}else{state.corkedRequestsFree=new CorkedRequest(state);}
state.bufferedRequestCount=0;}else{while(entry){var chunk=entry.chunk;var encoding=entry.encoding;var cb=entry.callback;var len=state.objectMode?1:chunk.length;doWrite(stream,state,false,len,chunk,encoding,cb);entry=entry.next;state.bufferedRequestCount--;if(state.writing){break;}}
if(entry===null)state.lastBufferedRequest=null;}
state.bufferedRequest=entry;state.bufferProcessing=false;}
Writable.prototype._write=function(chunk,encoding,cb){cb(new ERR_METHOD_NOT_IMPLEMENTED('_write()'));};Writable.prototype._writev=null;Writable.prototype.end=function(chunk,encoding,cb){var state=this._writableState;if(typeof chunk==='function'){cb=chunk;chunk=null;encoding=null;}else if(typeof encoding==='function'){cb=encoding;encoding=null;}
if(chunk!==null&&chunk!==undefined)this.write(chunk,encoding);if(state.corked){state.corked=1;this.uncork();}
if(!state.ending)endWritable(this,state,cb);return this;};Object.defineProperty(Writable.prototype,'writableLength',{enumerable:false,get:function get(){return this._writableState.length;}});function needFinish(state){return state.ending&&state.length===0&&state.bufferedRequest===null&&!state.finished&&!state.writing;}
function callFinal(stream,state){stream._final(function(err){state.pendingcb--;if(err){errorOrDestroy(stream,err);}
state.prefinished=true;stream.emit('prefinish');finishMaybe(stream,state);});}
function prefinish(stream,state){if(!state.prefinished&&!state.finalCalled){if(typeof stream._final==='function'&&!state.destroyed){state.pendingcb++;state.finalCalled=true;process.nextTick(callFinal,stream,state);}else{state.prefinished=true;stream.emit('prefinish');}}}
function finishMaybe(stream,state){var need=needFinish(state);if(need){prefinish(stream,state);if(state.pendingcb===0){state.finished=true;stream.emit('finish');if(state.autoDestroy){var rState=stream._readableState;if(!rState||rState.autoDestroy&&rState.endEmitted){stream.destroy();}}}}
return need;}
function endWritable(stream,state,cb){state.ending=true;finishMaybe(stream,state);if(cb){if(state.finished)process.nextTick(cb);else stream.once('finish',cb);}
state.ended=true;stream.writable=false;}
function onCorkedFinish(corkReq,state,err){var entry=corkReq.entry;corkReq.entry=null;while(entry){var cb=entry.callback;state.pendingcb--;cb(err);entry=entry.next;}
state.corkedRequestsFree.next=corkReq;}
Object.defineProperty(Writable.prototype,'destroyed',{enumerable:false,get:function get(){if(this._writableState===undefined){return false;}
return this._writableState.destroyed;},set:function set(value){if(!this._writableState){return;}
this._writableState.destroyed=value;}});Writable.prototype.destroy=destroyImpl.destroy;Writable.prototype._undestroy=destroyImpl.undestroy;Writable.prototype._destroy=function(err,cb){cb(err);};}).call(this)}).call(this,require('_process'),typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{"../errors":26,"./_stream_duplex":27,"./internal/streams/destroy":34,"./internal/streams/state":38,"./internal/streams/stream":39,"_process":23,"buffer":"buffer","inherits":20,"util-deprecate":48}],32:[function(require,module,exports){(function(process){(function(){'use strict';var _Object$setPrototypeO;function _defineProperty(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else{obj[key]=value;}return obj;}
var finished=require('./end-of-stream');var kLastResolve=Symbol('lastResolve');var kLastReject=Symbol('lastReject');var kError=Symbol('error');var kEnded=Symbol('ended');var kLastPromise=Symbol('lastPromise');var kHandlePromise=Symbol('handlePromise');var kStream=Symbol('stream');function createIterResult(value,done){return{value:value,done:done};}
function readAndResolve(iter){var resolve=iter[kLastResolve];if(resolve!==null){var data=iter[kStream].read();if(data!==null){iter[kLastPromise]=null;iter[kLastResolve]=null;iter[kLastReject]=null;resolve(createIterResult(data,false));}}}
function onReadable(iter){process.nextTick(readAndResolve,iter);}
function wrapForNext(lastPromise,iter){return function(resolve,reject){lastPromise.then(function(){if(iter[kEnded]){resolve(createIterResult(undefined,true));return;}
iter[kHandlePromise](resolve,reject);},reject);};}
var AsyncIteratorPrototype=Object.getPrototypeOf(function(){});var ReadableStreamAsyncIteratorPrototype=Object.setPrototypeOf((_Object$setPrototypeO={get stream(){return this[kStream];},next:function next(){var _this=this;var error=this[kError];if(error!==null){return Promise.reject(error);}
if(this[kEnded]){return Promise.resolve(createIterResult(undefined,true));}
if(this[kStream].destroyed){return new Promise(function(resolve,reject){process.nextTick(function(){if(_this[kError]){reject(_this[kError]);}else{resolve(createIterResult(undefined,true));}});});}
var lastPromise=this[kLastPromise];var promise;if(lastPromise){promise=new Promise(wrapForNext(lastPromise,this));}else{var data=this[kStream].read();if(data!==null){return Promise.resolve(createIterResult(data,false));}
promise=new Promise(this[kHandlePromise]);}
this[kLastPromise]=promise;return promise;}},_defineProperty(_Object$setPrototypeO,Symbol.asyncIterator,function(){return this;}),_defineProperty(_Object$setPrototypeO,"return",function _return(){var _this2=this;return new Promise(function(resolve,reject){_this2[kStream].destroy(null,function(err){if(err){reject(err);return;}
resolve(createIterResult(undefined,true));});});}),_Object$setPrototypeO),AsyncIteratorPrototype);var createReadableStreamAsyncIterator=function createReadableStreamAsyncIterator(stream){var _Object$create;var iterator=Object.create(ReadableStreamAsyncIteratorPrototype,(_Object$create={},_defineProperty(_Object$create,kStream,{value:stream,writable:true}),_defineProperty(_Object$create,kLastResolve,{value:null,writable:true}),_defineProperty(_Object$create,kLastReject,{value:null,writable:true}),_defineProperty(_Object$create,kError,{value:null,writable:true}),_defineProperty(_Object$create,kEnded,{value:stream._readableState.endEmitted,writable:true}),_defineProperty(_Object$create,kHandlePromise,{value:function value(resolve,reject){var data=iterator[kStream].read();if(data){iterator[kLastPromise]=null;iterator[kLastResolve]=null;iterator[kLastReject]=null;resolve(createIterResult(data,false));}else{iterator[kLastResolve]=resolve;iterator[kLastReject]=reject;}},writable:true}),_Object$create));iterator[kLastPromise]=null;finished(stream,function(err){if(err&&err.code!=='ERR_STREAM_PREMATURE_CLOSE'){var reject=iterator[kLastReject];if(reject!==null){iterator[kLastPromise]=null;iterator[kLastResolve]=null;iterator[kLastReject]=null;reject(err);}
iterator[kError]=err;return;}
var resolve=iterator[kLastResolve];if(resolve!==null){iterator[kLastPromise]=null;iterator[kLastResolve]=null;iterator[kLastReject]=null;resolve(createIterResult(undefined,true));}
iterator[kEnded]=true;});stream.on('readable',onReadable.bind(null,iterator));return iterator;};module.exports=createReadableStreamAsyncIterator;}).call(this)}).call(this,require('_process'))},{"./end-of-stream":35,"_process":23}],33:[function(require,module,exports){'use strict';function ownKeys(object,enumerableOnly){var keys=Object.keys(object);if(Object.getOwnPropertySymbols){var symbols=Object.getOwnPropertySymbols(object);if(enumerableOnly)symbols=symbols.filter(function(sym){return Object.getOwnPropertyDescriptor(object,sym).enumerable;});keys.push.apply(keys,symbols);}return keys;}
function _objectSpread(target){for(var i=1;i<arguments.length;i++){var source=arguments[i]!=null?arguments[i]:{};if(i%2){ownKeys(Object(source),true).forEach(function(key){_defineProperty(target,key,source[key]);});}else if(Object.getOwnPropertyDescriptors){Object.defineProperties(target,Object.getOwnPropertyDescriptors(source));}else{ownKeys(Object(source)).forEach(function(key){Object.defineProperty(target,key,Object.getOwnPropertyDescriptor(source,key));});}}return target;}
function _defineProperty(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else{obj[key]=value;}return obj;}
function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError("Cannot call a class as a function");}}
function _defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if("value"in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor);}}
function _createClass(Constructor,protoProps,staticProps){if(protoProps)_defineProperties(Constructor.prototype,protoProps);if(staticProps)_defineProperties(Constructor,staticProps);return Constructor;}
var _require=require('buffer'),Buffer=_require.Buffer;var _require2=require('util'),inspect=_require2.inspect;var custom=inspect&&inspect.custom||'inspect';function copyBuffer(src,target,offset){Buffer.prototype.copy.call(src,target,offset);}
module.exports=function(){function BufferList(){_classCallCheck(this,BufferList);this.head=null;this.tail=null;this.length=0;}
_createClass(BufferList,[{key:"push",value:function push(v){var entry={data:v,next:null};if(this.length>0)this.tail.next=entry;else this.head=entry;this.tail=entry;++this.length;}},{key:"unshift",value:function unshift(v){var entry={data:v,next:this.head};if(this.length===0)this.tail=entry;this.head=entry;++this.length;}},{key:"shift",value:function shift(){if(this.length===0)return;var ret=this.head.data;if(this.length===1)this.head=this.tail=null;else this.head=this.head.next;--this.length;return ret;}},{key:"clear",value:function clear(){this.head=this.tail=null;this.length=0;}},{key:"join",value:function join(s){if(this.length===0)return '';var p=this.head;var ret=''+p.data;while(p=p.next){ret+=s+p.data;}
return ret;}},{key:"concat",value:function concat(n){if(this.length===0)return Buffer.alloc(0);var ret=Buffer.allocUnsafe(n>>>0);var p=this.head;var i=0;while(p){copyBuffer(p.data,ret,i);i+=p.data.length;p=p.next;}
return ret;}},{key:"consume",value:function consume(n,hasStrings){var ret;if(n<this.head.data.length){ret=this.head.data.slice(0,n);this.head.data=this.head.data.slice(n);}else if(n===this.head.data.length){ret=this.shift();}else{ret=hasStrings?this._getString(n):this._getBuffer(n);}
return ret;}},{key:"first",value:function first(){return this.head.data;}},{key:"_getString",value:function _getString(n){var p=this.head;var c=1;var ret=p.data;n-=ret.length;while(p=p.next){var str=p.data;var nb=n>str.length?str.length:n;if(nb===str.length)ret+=str;else ret+=str.slice(0,n);n-=nb;if(n===0){if(nb===str.length){++c;if(p.next)this.head=p.next;else this.head=this.tail=null;}else{this.head=p;p.data=str.slice(nb);}
break;}
++c;}
this.length-=c;return ret;}},{key:"_getBuffer",value:function _getBuffer(n){var ret=Buffer.allocUnsafe(n);var p=this.head;var c=1;p.data.copy(ret);n-=p.data.length;while(p=p.next){var buf=p.data;var nb=n>buf.length?buf.length:n;buf.copy(ret,ret.length-n,0,nb);n-=nb;if(n===0){if(nb===buf.length){++c;if(p.next)this.head=p.next;else this.head=this.tail=null;}else{this.head=p;p.data=buf.slice(nb);}
break;}
++c;}
this.length-=c;return ret;}},{key:custom,value:function value(_,options){return inspect(this,_objectSpread({},options,{depth:0,customInspect:false}));}}]);return BufferList;}();},{"buffer":"buffer","util":15}],34:[function(require,module,exports){(function(process){(function(){'use strict';function destroy(err,cb){var _this=this;var readableDestroyed=this._readableState&&this._readableState.destroyed;var writableDestroyed=this._writableState&&this._writableState.destroyed;if(readableDestroyed||writableDestroyed){if(cb){cb(err);}else if(err){if(!this._writableState){process.nextTick(emitErrorNT,this,err);}else if(!this._writableState.errorEmitted){this._writableState.errorEmitted=true;process.nextTick(emitErrorNT,this,err);}}
return this;}
if(this._readableState){this._readableState.destroyed=true;}
if(this._writableState){this._writableState.destroyed=true;}
this._destroy(err||null,function(err){if(!cb&&err){if(!_this._writableState){process.nextTick(emitErrorAndCloseNT,_this,err);}else if(!_this._writableState.errorEmitted){_this._writableState.errorEmitted=true;process.nextTick(emitErrorAndCloseNT,_this,err);}else{process.nextTick(emitCloseNT,_this);}}else if(cb){process.nextTick(emitCloseNT,_this);cb(err);}else{process.nextTick(emitCloseNT,_this);}});return this;}
function emitErrorAndCloseNT(self,err){emitErrorNT(self,err);emitCloseNT(self);}
function emitCloseNT(self){if(self._writableState&&!self._writableState.emitClose)return;if(self._readableState&&!self._readableState.emitClose)return;self.emit('close');}
function undestroy(){if(this._readableState){this._readableState.destroyed=false;this._readableState.reading=false;this._readableState.ended=false;this._readableState.endEmitted=false;}
if(this._writableState){this._writableState.destroyed=false;this._writableState.ended=false;this._writableState.ending=false;this._writableState.finalCalled=false;this._writableState.prefinished=false;this._writableState.finished=false;this._writableState.errorEmitted=false;}}
function emitErrorNT(self,err){self.emit('error',err);}
function errorOrDestroy(stream,err){var rState=stream._readableState;var wState=stream._writableState;if(rState&&rState.autoDestroy||wState&&wState.autoDestroy)stream.destroy(err);else stream.emit('error',err);}
module.exports={destroy:destroy,undestroy:undestroy,errorOrDestroy:errorOrDestroy};}).call(this)}).call(this,require('_process'))},{"_process":23}],35:[function(require,module,exports){'use strict';var ERR_STREAM_PREMATURE_CLOSE=require('../../../errors').codes.ERR_STREAM_PREMATURE_CLOSE;function once(callback){var called=false;return function(){if(called)return;called=true;for(var _len=arguments.length,args=new Array(_len),_key=0;_key<_len;_key++){args[_key]=arguments[_key];}
callback.apply(this,args);};}
function noop(){}
function isRequest(stream){return stream.setHeader&&typeof stream.abort==='function';}
function eos(stream,opts,callback){if(typeof opts==='function')return eos(stream,null,opts);if(!opts)opts={};callback=once(callback||noop);var readable=opts.readable||opts.readable!==false&&stream.readable;var writable=opts.writable||opts.writable!==false&&stream.writable;var onlegacyfinish=function onlegacyfinish(){if(!stream.writable)onfinish();};var writableEnded=stream._writableState&&stream._writableState.finished;var onfinish=function onfinish(){writable=false;writableEnded=true;if(!readable)callback.call(stream);};var readableEnded=stream._readableState&&stream._readableState.endEmitted;var onend=function onend(){readable=false;readableEnded=true;if(!writable)callback.call(stream);};var onerror=function onerror(err){callback.call(stream,err);};var onclose=function onclose(){var err;if(readable&&!readableEnded){if(!stream._readableState||!stream._readableState.ended)err=new ERR_STREAM_PREMATURE_CLOSE();return callback.call(stream,err);}
if(writable&&!writableEnded){if(!stream._writableState||!stream._writableState.ended)err=new ERR_STREAM_PREMATURE_CLOSE();return callback.call(stream,err);}};var onrequest=function onrequest(){stream.req.on('finish',onfinish);};if(isRequest(stream)){stream.on('complete',onfinish);stream.on('abort',onclose);if(stream.req)onrequest();else stream.on('request',onrequest);}else if(writable&&!stream._writableState){stream.on('end',onlegacyfinish);stream.on('close',onlegacyfinish);}
stream.on('end',onend);stream.on('finish',onfinish);if(opts.error!==false)stream.on('error',onerror);stream.on('close',onclose);return function(){stream.removeListener('complete',onfinish);stream.removeListener('abort',onclose);stream.removeListener('request',onrequest);if(stream.req)stream.req.removeListener('finish',onfinish);stream.removeListener('end',onlegacyfinish);stream.removeListener('close',onlegacyfinish);stream.removeListener('finish',onfinish);stream.removeListener('end',onend);stream.removeListener('error',onerror);stream.removeListener('close',onclose);};}
module.exports=eos;},{"../../../errors":26}],36:[function(require,module,exports){module.exports=function(){throw new Error('Readable.from is not available in the browser')};},{}],37:[function(require,module,exports){'use strict';var eos;function once(callback){var called=false;return function(){if(called)return;called=true;callback.apply(void 0,arguments);};}
var _require$codes=require('../../../errors').codes,ERR_MISSING_ARGS=_require$codes.ERR_MISSING_ARGS,ERR_STREAM_DESTROYED=_require$codes.ERR_STREAM_DESTROYED;function noop(err){if(err)throw err;}
function isRequest(stream){return stream.setHeader&&typeof stream.abort==='function';}
function destroyer(stream,reading,writing,callback){callback=once(callback);var closed=false;stream.on('close',function(){closed=true;});if(eos===undefined)eos=require('./end-of-stream');eos(stream,{readable:reading,writable:writing},function(err){if(err)return callback(err);closed=true;callback();});var destroyed=false;return function(err){if(closed)return;if(destroyed)return;destroyed=true;if(isRequest(stream))return stream.abort();if(typeof stream.destroy==='function')return stream.destroy();callback(err||new ERR_STREAM_DESTROYED('pipe'));};}
function call(fn){fn();}
function pipe(from,to){return from.pipe(to);}
function popCallback(streams){if(!streams.length)return noop;if(typeof streams[streams.length-1]!=='function')return noop;return streams.pop();}
function pipeline(){for(var _len=arguments.length,streams=new Array(_len),_key=0;_key<_len;_key++){streams[_key]=arguments[_key];}
var callback=popCallback(streams);if(Array.isArray(streams[0]))streams=streams[0];if(streams.length<2){throw new ERR_MISSING_ARGS('streams');}
var error;var destroys=streams.map(function(stream,i){var reading=i<streams.length-1;var writing=i>0;return destroyer(stream,reading,writing,function(err){if(!error)error=err;if(err)destroys.forEach(call);if(reading)return;destroys.forEach(call);callback(error);});});return streams.reduce(pipe);}
module.exports=pipeline;},{"../../../errors":26,"./end-of-stream":35}],38:[function(require,module,exports){'use strict';var ERR_INVALID_OPT_VALUE=require('../../../errors').codes.ERR_INVALID_OPT_VALUE;function highWaterMarkFrom(options,isDuplex,duplexKey){return options.highWaterMark!=null?options.highWaterMark:isDuplex?options[duplexKey]:null;}
function getHighWaterMark(state,options,duplexKey,isDuplex){var hwm=highWaterMarkFrom(options,isDuplex,duplexKey);if(hwm!=null){if(!(isFinite(hwm)&&Math.floor(hwm)===hwm)||hwm<0){var name=isDuplex?duplexKey:'highWaterMark';throw new ERR_INVALID_OPT_VALUE(name,hwm);}
return Math.floor(hwm);}
return state.objectMode?16:16*1024;}
module.exports={getHighWaterMark:getHighWaterMark};},{"../../../errors":26}],39:[function(require,module,exports){module.exports=require('events').EventEmitter;},{"events":"events"}],40:[function(require,module,exports){exports=module.exports=require('./lib/_stream_readable.js');exports.Stream=exports;exports.Readable=exports;exports.Writable=require('./lib/_stream_writable.js');exports.Duplex=require('./lib/_stream_duplex.js');exports.Transform=require('./lib/_stream_transform.js');exports.PassThrough=require('./lib/_stream_passthrough.js');exports.finished=require('./lib/internal/streams/end-of-stream.js');exports.pipeline=require('./lib/internal/streams/pipeline.js');},{"./lib/_stream_duplex.js":27,"./lib/_stream_passthrough.js":28,"./lib/_stream_readable.js":29,"./lib/_stream_transform.js":30,"./lib/_stream_writable.js":31,"./lib/internal/streams/end-of-stream.js":35,"./lib/internal/streams/pipeline.js":37}],41:[function(require,module,exports){/*!run-parallel. MIT License. Feross Aboukhadijeh <https://feross.org/opensource>*/module.exports=runParallel
const queueMicrotask=require('queue-microtask')
function runParallel(tasks,cb){let results,pending,keys
let isSync=true
if(Array.isArray(tasks)){results=[]
pending=tasks.length}else{keys=Object.keys(tasks)
results={}
pending=keys.length}
function done(err){function end(){if(cb)cb(err,results)
cb=null}
if(isSync)queueMicrotask(end)
else end()}
function each(i,err,result){results[i]=result
if(--pending===0||err){done(err)}}
if(!pending){done(null)}else if(keys){keys.forEach(function(key){tasks[key](function(err,result){each(key,err,result)})})}else{tasks.forEach(function(task,i){task(function(err,result){each(i,err,result)})})}
isSync=false}},{"queue-microtask":24}],42:[function(require,module,exports){/*!safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource>*/var buffer=require('buffer')
var Buffer=buffer.Buffer
function copyProps(src,dst){for(var key in src){dst[key]=src[key]}}
if(Buffer.from&&Buffer.alloc&&Buffer.allocUnsafe&&Buffer.allocUnsafeSlow){module.exports=buffer}else{copyProps(buffer,exports)
exports.Buffer=SafeBuffer}
function SafeBuffer(arg,encodingOrOffset,length){return Buffer(arg,encodingOrOffset,length)}
SafeBuffer.prototype=Object.create(Buffer.prototype)
copyProps(Buffer,SafeBuffer)
SafeBuffer.from=function(arg,encodingOrOffset,length){if(typeof arg==='number'){throw new TypeError('Argument must not be a number')}
return Buffer(arg,encodingOrOffset,length)}
SafeBuffer.alloc=function(size,fill,encoding){if(typeof size!=='number'){throw new TypeError('Argument must be a number')}
var buf=Buffer(size)
if(fill!==undefined){if(typeof encoding==='string'){buf.fill(fill,encoding)}else{buf.fill(fill)}}else{buf.fill(0)}
return buf}
SafeBuffer.allocUnsafe=function(size){if(typeof size!=='number'){throw new TypeError('Argument must be a number')}
return Buffer(size)}
SafeBuffer.allocUnsafeSlow=function(size){if(typeof size!=='number'){throw new TypeError('Argument must be a number')}
return buffer.SlowBuffer(size)}},{"buffer":"buffer"}],43:[function(require,module,exports){var Buffer=require('safe-buffer').Buffer
function Hash(blockSize,finalSize){this._block=Buffer.alloc(blockSize)
this._finalSize=finalSize
this._blockSize=blockSize
this._len=0}
Hash.prototype.update=function(data,enc){if(typeof data==='string'){enc=enc||'utf8'
data=Buffer.from(data,enc)}
var block=this._block
var blockSize=this._blockSize
var length=data.length
var accum=this._len
for(var offset=0;offset<length;){var assigned=accum%blockSize
var remainder=Math.min(length-offset,blockSize-assigned)
for(var i=0;i<remainder;i++){block[assigned+i]=data[offset+i]}
accum+=remainder
offset+=remainder
if((accum%blockSize)===0){this._update(block)}}
this._len+=length
return this}
Hash.prototype.digest=function(enc){var rem=this._len%this._blockSize
this._block[rem]=0x80
this._block.fill(0,rem+1)
if(rem>=this._finalSize){this._update(this._block)
this._block.fill(0)}
var bits=this._len*8
if(bits<=0xffffffff){this._block.writeUInt32BE(bits,this._blockSize-4)}else{var lowBits=(bits&0xffffffff)>>>0
var highBits=(bits-lowBits)/0x100000000
this._block.writeUInt32BE(highBits,this._blockSize-8)
this._block.writeUInt32BE(lowBits,this._blockSize-4)}
this._update(this._block)
var hash=this._hash()
return enc?hash.toString(enc):hash}
Hash.prototype._update=function(){throw new Error('_update must be implemented by subclass')}
module.exports=Hash},{"safe-buffer":42}],44:[function(require,module,exports){var inherits=require('inherits')
var Hash=require('./hash')
var Buffer=require('safe-buffer').Buffer
var K=[0x5a827999,0x6ed9eba1,0x8f1bbcdc|0,0xca62c1d6|0]
var W=new Array(80)
function Sha1(){this.init()
this._w=W
Hash.call(this,64,56)}
inherits(Sha1,Hash)
Sha1.prototype.init=function(){this._a=0x67452301
this._b=0xefcdab89
this._c=0x98badcfe
this._d=0x10325476
this._e=0xc3d2e1f0
return this}
function rotl1(num){return(num<<1)|(num>>>31)}
function rotl5(num){return(num<<5)|(num>>>27)}
function rotl30(num){return(num<<30)|(num>>>2)}
function ft(s,b,c,d){if(s===0)return(b&c)|((~b)&d)
if(s===2)return(b&c)|(b&d)|(c&d)
return b^c^d}
Sha1.prototype._update=function(M){var W=this._w
var a=this._a|0
var b=this._b|0
var c=this._c|0
var d=this._d|0
var e=this._e|0
for(var i=0;i<16;++i)W[i]=M.readInt32BE(i*4)
for(;i<80;++i)W[i]=rotl1(W[i-3]^W[i-8]^W[i-14]^W[i-16])
for(var j=0;j<80;++j){var s=~~(j/20)
var t=(rotl5(a)+ft(s,b,c,d)+e+W[j]+K[s])|0
e=d
d=c
c=rotl30(b)
b=a
a=t}
this._a=(a+this._a)|0
this._b=(b+this._b)|0
this._c=(c+this._c)|0
this._d=(d+this._d)|0
this._e=(e+this._e)|0}
Sha1.prototype._hash=function(){var H=Buffer.allocUnsafe(20)
H.writeInt32BE(this._a|0,0)
H.writeInt32BE(this._b|0,4)
H.writeInt32BE(this._c|0,8)
H.writeInt32BE(this._d|0,12)
H.writeInt32BE(this._e|0,16)
return H}
module.exports=Sha1},{"./hash":43,"inherits":20,"safe-buffer":42}],45:[function(require,module,exports){/*!simple-peer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource>*/const debug=require('debug')('simple-peer')
const getBrowserRTC=require('get-browser-rtc')
const randombytes=require('randombytes')
const stream=require('readable-stream')
const queueMicrotask=require('queue-microtask')
const errCode=require('err-code')
const{Buffer}=require('buffer')
const MAX_BUFFERED_AMOUNT=64*1024
const ICECOMPLETE_TIMEOUT=5*1000
const CHANNEL_CLOSING_TIMEOUT=5*1000
function filterTrickle(sdp){return sdp.replace(/a=ice-options:trickle\s\n/g,'')}
function warn(message){console.warn(message)}
class Peer extends stream.Duplex{constructor(opts){opts=Object.assign({allowHalfOpen:false},opts)
super(opts)
this._id=randombytes(4).toString('hex').slice(0,7)
this._debug('new peer %o',opts)
this.channelName=opts.initiator?opts.channelName||randombytes(20).toString('hex'):null
this.initiator=opts.initiator||false
this.channelConfig=opts.channelConfig||Peer.channelConfig
this.channelNegotiated=this.channelConfig.negotiated
this.config=Object.assign({},Peer.config,opts.config)
this.offerOptions=opts.offerOptions||{}
this.answerOptions=opts.answerOptions||{}
this.sdpTransform=opts.sdpTransform||(sdp=>sdp)
this.streams=opts.streams||(opts.stream?[opts.stream]:[])
this.trickle=opts.trickle!==undefined?opts.trickle:true
this.allowHalfTrickle=opts.allowHalfTrickle!==undefined?opts.allowHalfTrickle:false
this.iceCompleteTimeout=opts.iceCompleteTimeout||ICECOMPLETE_TIMEOUT
this.destroyed=false
this.destroying=false
this._connected=false
this.remoteAddress=undefined
this.remoteFamily=undefined
this.remotePort=undefined
this.localAddress=undefined
this.localFamily=undefined
this.localPort=undefined
this._wrtc=(opts.wrtc&&typeof opts.wrtc==='object')?opts.wrtc:getBrowserRTC()
if(!this._wrtc){if(typeof window==='undefined'){throw errCode(new Error('No WebRTC support: Specify `opts.wrtc` option in this environment'),'ERR_WEBRTC_SUPPORT')}else{throw errCode(new Error('No WebRTC support: Not a supported browser'),'ERR_WEBRTC_SUPPORT')}}
this._pcReady=false
this._channelReady=false
this._iceComplete=false
this._iceCompleteTimer=null
this._channel=null
this._pendingCandidates=[]
this._isNegotiating=false
this._firstNegotiation=true
this._batchedNegotiation=false
this._queuedNegotiation=false
this._sendersAwaitingStable=[]
this._senderMap=new Map()
this._closingInterval=null
this._remoteTracks=[]
this._remoteStreams=[]
this._chunk=null
this._cb=null
this._interval=null
try{this._pc=new(this._wrtc.RTCPeerConnection)(this.config)}catch(err){this.destroy(errCode(err,'ERR_PC_CONSTRUCTOR'))
return}
this._isReactNativeWebrtc=typeof this._pc._peerConnectionId==='number'
this._pc.oniceconnectionstatechange=()=>{this._onIceStateChange()}
this._pc.onicegatheringstatechange=()=>{this._onIceStateChange()}
this._pc.onconnectionstatechange=()=>{this._onConnectionStateChange()}
this._pc.onsignalingstatechange=()=>{this._onSignalingStateChange()}
this._pc.onicecandidate=event=>{this._onIceCandidate(event)}
if(typeof this._pc.peerIdentity==='object'){this._pc.peerIdentity.catch(err=>{this.destroy(errCode(err,'ERR_PC_PEER_IDENTITY'))})}
if(this.initiator||this.channelNegotiated){this._setupData({channel:this._pc.createDataChannel(this.channelName,this.channelConfig)})}else{this._pc.ondatachannel=event=>{this._setupData(event)}}
if(this.streams){this.streams.forEach(stream=>{this.addStream(stream)})}
this._pc.ontrack=event=>{this._onTrack(event)}
this._debug('initial negotiation')
this._needsNegotiation()
this._onFinishBound=()=>{this._onFinish()}
this.once('finish',this._onFinishBound)}
get bufferSize(){return(this._channel&&this._channel.bufferedAmount)||0}
get connected(){return(this._connected&&this._channel.readyState==='open')}
address(){return{port:this.localPort,family:this.localFamily,address:this.localAddress}}
signal(data){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot signal after peer is destroyed'),'ERR_DESTROYED')
if(typeof data==='string'){try{data=JSON.parse(data)}catch(err){data={}}}
this._debug('signal()')
if(data.renegotiate&&this.initiator){this._debug('got request to renegotiate')
this._needsNegotiation()}
if(data.transceiverRequest&&this.initiator){this._debug('got request for transceiver')
this.addTransceiver(data.transceiverRequest.kind,data.transceiverRequest.init)}
if(data.candidate){if(this._pc.remoteDescription&&this._pc.remoteDescription.type){this._addIceCandidate(data.candidate)}else{this._pendingCandidates.push(data.candidate)}}
if(data.sdp){this._pc.setRemoteDescription(new(this._wrtc.RTCSessionDescription)(data)).then(()=>{if(this.destroyed)return
this._pendingCandidates.forEach(candidate=>{this._addIceCandidate(candidate)})
this._pendingCandidates=[]
if(this._pc.remoteDescription.type==='offer')this._createAnswer()}).catch(err=>{this.destroy(errCode(err,'ERR_SET_REMOTE_DESCRIPTION'))})}
if(!data.sdp&&!data.candidate&&!data.renegotiate&&!data.transceiverRequest){this.destroy(errCode(new Error('signal() called with invalid signal data'),'ERR_SIGNALING'))}}
_addIceCandidate(candidate){const iceCandidateObj=new this._wrtc.RTCIceCandidate(candidate)
this._pc.addIceCandidate(iceCandidateObj).catch(err=>{if(!iceCandidateObj.address||iceCandidateObj.address.endsWith('.local')){warn('Ignoring unsupported ICE candidate.')}else{this.destroy(errCode(err,'ERR_ADD_ICE_CANDIDATE'))}})}
send(chunk){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot send after peer is destroyed'),'ERR_DESTROYED')
this._channel.send(chunk)}
addTransceiver(kind,init){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot addTransceiver after peer is destroyed'),'ERR_DESTROYED')
this._debug('addTransceiver()')
if(this.initiator){try{this._pc.addTransceiver(kind,init)
this._needsNegotiation()}catch(err){this.destroy(errCode(err,'ERR_ADD_TRANSCEIVER'))}}else{this.emit('signal',{type:'transceiverRequest',transceiverRequest:{kind,init}})}}
addStream(stream){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot addStream after peer is destroyed'),'ERR_DESTROYED')
this._debug('addStream()')
stream.getTracks().forEach(track=>{this.addTrack(track,stream)})}
addTrack(track,stream){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot addTrack after peer is destroyed'),'ERR_DESTROYED')
this._debug('addTrack()')
const submap=this._senderMap.get(track)||new Map()
let sender=submap.get(stream)
if(!sender){sender=this._pc.addTrack(track,stream)
submap.set(stream,sender)
this._senderMap.set(track,submap)
this._needsNegotiation()}else if(sender.removed){throw errCode(new Error('Track has been removed. You should enable/disable tracks that you want to re-add.'),'ERR_SENDER_REMOVED')}else{throw errCode(new Error('Track has already been added to that stream.'),'ERR_SENDER_ALREADY_ADDED')}}
replaceTrack(oldTrack,newTrack,stream){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot replaceTrack after peer is destroyed'),'ERR_DESTROYED')
this._debug('replaceTrack()')
const submap=this._senderMap.get(oldTrack)
const sender=submap?submap.get(stream):null
if(!sender){throw errCode(new Error('Cannot replace track that was never added.'),'ERR_TRACK_NOT_ADDED')}
if(newTrack)this._senderMap.set(newTrack,submap)
if(sender.replaceTrack!=null){sender.replaceTrack(newTrack)}else{this.destroy(errCode(new Error('replaceTrack is not supported in this browser'),'ERR_UNSUPPORTED_REPLACETRACK'))}}
removeTrack(track,stream){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot removeTrack after peer is destroyed'),'ERR_DESTROYED')
this._debug('removeSender()')
const submap=this._senderMap.get(track)
const sender=submap?submap.get(stream):null
if(!sender){throw errCode(new Error('Cannot remove track that was never added.'),'ERR_TRACK_NOT_ADDED')}
try{sender.removed=true
this._pc.removeTrack(sender)}catch(err){if(err.name==='NS_ERROR_UNEXPECTED'){this._sendersAwaitingStable.push(sender)}else{this.destroy(errCode(err,'ERR_REMOVE_TRACK'))}}
this._needsNegotiation()}
removeStream(stream){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot removeStream after peer is destroyed'),'ERR_DESTROYED')
this._debug('removeSenders()')
stream.getTracks().forEach(track=>{this.removeTrack(track,stream)})}
_needsNegotiation(){this._debug('_needsNegotiation')
if(this._batchedNegotiation)return
this._batchedNegotiation=true
queueMicrotask(()=>{this._batchedNegotiation=false
if(this.initiator||!this._firstNegotiation){this._debug('starting batched negotiation')
this.negotiate()}else{this._debug('non-initiator initial negotiation request discarded')}
this._firstNegotiation=false})}
negotiate(){if(this.destroying)return
if(this.destroyed)throw errCode(new Error('cannot negotiate after peer is destroyed'),'ERR_DESTROYED')
if(this.initiator){if(this._isNegotiating){this._queuedNegotiation=true
this._debug('already negotiating, queueing')}else{this._debug('start negotiation')
setTimeout(()=>{this._createOffer()},0)}}else{if(this._isNegotiating){this._queuedNegotiation=true
this._debug('already negotiating, queueing')}else{this._debug('requesting negotiation from initiator')
this.emit('signal',{type:'renegotiate',renegotiate:true})}}
this._isNegotiating=true}
destroy(err){this._destroy(err,()=>{})}
_destroy(err,cb){if(this.destroyed||this.destroying)return
this.destroying=true
this._debug('destroying (error: %s)',err&&(err.message||err))
queueMicrotask(()=>{this.destroyed=true
this.destroying=false
this._debug('destroy (error: %s)',err&&(err.message||err))
this.readable=this.writable=false
if(!this._readableState.ended)this.push(null)
if(!this._writableState.finished)this.end()
this._connected=false
this._pcReady=false
this._channelReady=false
this._remoteTracks=null
this._remoteStreams=null
this._senderMap=null
clearInterval(this._closingInterval)
this._closingInterval=null
clearInterval(this._interval)
this._interval=null
this._chunk=null
this._cb=null
if(this._onFinishBound)this.removeListener('finish',this._onFinishBound)
this._onFinishBound=null
if(this._channel){try{this._channel.close()}catch(err){}
this._channel.onmessage=null
this._channel.onopen=null
this._channel.onclose=null
this._channel.onerror=null}
if(this._pc){try{this._pc.close()}catch(err){}
this._pc.oniceconnectionstatechange=null
this._pc.onicegatheringstatechange=null
this._pc.onsignalingstatechange=null
this._pc.onicecandidate=null
this._pc.ontrack=null
this._pc.ondatachannel=null}
this._pc=null
this._channel=null
if(err)this.emit('error',err)
this.emit('close')
cb()})}
_setupData(event){if(!event.channel){return this.destroy(errCode(new Error('Data channel event is missing `channel` property'),'ERR_DATA_CHANNEL'))}
this._channel=event.channel
this._channel.binaryType='arraybuffer'
if(typeof this._channel.bufferedAmountLowThreshold==='number'){this._channel.bufferedAmountLowThreshold=MAX_BUFFERED_AMOUNT}
this.channelName=this._channel.label
this._channel.onmessage=event=>{this._onChannelMessage(event)}
this._channel.onbufferedamountlow=()=>{this._onChannelBufferedAmountLow()}
this._channel.onopen=()=>{this._onChannelOpen()}
this._channel.onclose=()=>{this._onChannelClose()}
this._channel.onerror=err=>{this.destroy(errCode(err,'ERR_DATA_CHANNEL'))}
let isClosing=false
this._closingInterval=setInterval(()=>{if(this._channel&&this._channel.readyState==='closing'){if(isClosing)this._onChannelClose()
isClosing=true}else{isClosing=false}},CHANNEL_CLOSING_TIMEOUT)}
_read(){}
_write(chunk,encoding,cb){if(this.destroyed)return cb(errCode(new Error('cannot write after peer is destroyed'),'ERR_DATA_CHANNEL'))
if(this._connected){try{this.send(chunk)}catch(err){return this.destroy(errCode(err,'ERR_DATA_CHANNEL'))}
if(this._channel.bufferedAmount>MAX_BUFFERED_AMOUNT){this._debug('start backpressure: bufferedAmount %d',this._channel.bufferedAmount)
this._cb=cb}else{cb(null)}}else{this._debug('write before connect')
this._chunk=chunk
this._cb=cb}}
_onFinish(){if(this.destroyed)return
const destroySoon=()=>{setTimeout(()=>this.destroy(),1000)}
if(this._connected){destroySoon()}else{this.once('connect',destroySoon)}}
_startIceCompleteTimeout(){if(this.destroyed)return
if(this._iceCompleteTimer)return
this._debug('started iceComplete timeout')
this._iceCompleteTimer=setTimeout(()=>{if(!this._iceComplete){this._iceComplete=true
this._debug('iceComplete timeout completed')
this.emit('iceTimeout')
this.emit('_iceComplete')}},this.iceCompleteTimeout)}
_createOffer(){if(this.destroyed)return
this._pc.createOffer(this.offerOptions).then(offer=>{if(this.destroyed)return
if(!this.trickle&&!this.allowHalfTrickle)offer.sdp=filterTrickle(offer.sdp)
offer.sdp=this.sdpTransform(offer.sdp)
const sendOffer=()=>{if(this.destroyed)return
const signal=this._pc.localDescription||offer
this._debug('signal')
this.emit('signal',{type:signal.type,sdp:signal.sdp})}
const onSuccess=()=>{this._debug('createOffer success')
if(this.destroyed)return
if(this.trickle||this._iceComplete)sendOffer()
else this.once('_iceComplete',sendOffer)}
const onError=err=>{this.destroy(errCode(err,'ERR_SET_LOCAL_DESCRIPTION'))}
this._pc.setLocalDescription(offer).then(onSuccess).catch(onError)}).catch(err=>{this.destroy(errCode(err,'ERR_CREATE_OFFER'))})}
_requestMissingTransceivers(){if(this._pc.getTransceivers){this._pc.getTransceivers().forEach(transceiver=>{if(!transceiver.mid&&transceiver.sender.track&&!transceiver.requested){transceiver.requested=true
this.addTransceiver(transceiver.sender.track.kind)}})}}
_createAnswer(){if(this.destroyed)return
this._pc.createAnswer(this.answerOptions).then(answer=>{if(this.destroyed)return
if(!this.trickle&&!this.allowHalfTrickle)answer.sdp=filterTrickle(answer.sdp)
answer.sdp=this.sdpTransform(answer.sdp)
const sendAnswer=()=>{if(this.destroyed)return
const signal=this._pc.localDescription||answer
this._debug('signal')
this.emit('signal',{type:signal.type,sdp:signal.sdp})
if(!this.initiator)this._requestMissingTransceivers()}
const onSuccess=()=>{if(this.destroyed)return
if(this.trickle||this._iceComplete)sendAnswer()
else this.once('_iceComplete',sendAnswer)}
const onError=err=>{this.destroy(errCode(err,'ERR_SET_LOCAL_DESCRIPTION'))}
this._pc.setLocalDescription(answer).then(onSuccess).catch(onError)}).catch(err=>{this.destroy(errCode(err,'ERR_CREATE_ANSWER'))})}
_onConnectionStateChange(){if(this.destroyed)return
if(this._pc.connectionState==='failed'){this.destroy(errCode(new Error('Connection failed.'),'ERR_CONNECTION_FAILURE'))}}
_onIceStateChange(){if(this.destroyed)return
const iceConnectionState=this._pc.iceConnectionState
const iceGatheringState=this._pc.iceGatheringState
this._debug('iceStateChange (connection: %s) (gathering: %s)',iceConnectionState,iceGatheringState)
this.emit('iceStateChange',iceConnectionState,iceGatheringState)
if(iceConnectionState==='connected'||iceConnectionState==='completed'){this._pcReady=true
this._maybeReady()}
if(iceConnectionState==='failed'){this.destroy(errCode(new Error('Ice connection failed.'),'ERR_ICE_CONNECTION_FAILURE'))}
if(iceConnectionState==='closed'){this.destroy(errCode(new Error('Ice connection closed.'),'ERR_ICE_CONNECTION_CLOSED'))}}
getStats(cb){const flattenValues=report=>{if(Object.prototype.toString.call(report.values)==='[object Array]'){report.values.forEach(value=>{Object.assign(report,value)})}
return report}
if(this._pc.getStats.length===0||this._isReactNativeWebrtc){this._pc.getStats().then(res=>{const reports=[]
res.forEach(report=>{reports.push(flattenValues(report))})
cb(null,reports)},err=>cb(err))}else if(this._pc.getStats.length>0){this._pc.getStats(res=>{if(this.destroyed)return
const reports=[]
res.result().forEach(result=>{const report={}
result.names().forEach(name=>{report[name]=result.stat(name)})
report.id=result.id
report.type=result.type
report.timestamp=result.timestamp
reports.push(flattenValues(report))})
cb(null,reports)},err=>cb(err))}else{cb(null,[])}}
_maybeReady(){this._debug('maybeReady pc %s channel %s',this._pcReady,this._channelReady)
if(this._connected||this._connecting||!this._pcReady||!this._channelReady)return
this._connecting=true
const findCandidatePair=()=>{if(this.destroyed)return
this.getStats((err,items)=>{if(this.destroyed)return
if(err)items=[]
const remoteCandidates={}
const localCandidates={}
const candidatePairs={}
let foundSelectedCandidatePair=false
items.forEach(item=>{if(item.type==='remotecandidate'||item.type==='remote-candidate'){remoteCandidates[item.id]=item}
if(item.type==='localcandidate'||item.type==='local-candidate'){localCandidates[item.id]=item}
if(item.type==='candidatepair'||item.type==='candidate-pair'){candidatePairs[item.id]=item}})
const setSelectedCandidatePair=selectedCandidatePair=>{foundSelectedCandidatePair=true
let local=localCandidates[selectedCandidatePair.localCandidateId]
if(local&&(local.ip||local.address)){this.localAddress=local.ip||local.address
this.localPort=Number(local.port)}else if(local&&local.ipAddress){this.localAddress=local.ipAddress
this.localPort=Number(local.portNumber)}else if(typeof selectedCandidatePair.googLocalAddress==='string'){local=selectedCandidatePair.googLocalAddress.split(':')
this.localAddress=local[0]
this.localPort=Number(local[1])}
if(this.localAddress){this.localFamily=this.localAddress.includes(':')?'IPv6':'IPv4'}
let remote=remoteCandidates[selectedCandidatePair.remoteCandidateId]
if(remote&&(remote.ip||remote.address)){this.remoteAddress=remote.ip||remote.address
this.remotePort=Number(remote.port)}else if(remote&&remote.ipAddress){this.remoteAddress=remote.ipAddress
this.remotePort=Number(remote.portNumber)}else if(typeof selectedCandidatePair.googRemoteAddress==='string'){remote=selectedCandidatePair.googRemoteAddress.split(':')
this.remoteAddress=remote[0]
this.remotePort=Number(remote[1])}
if(this.remoteAddress){this.remoteFamily=this.remoteAddress.includes(':')?'IPv6':'IPv4'}
this._debug('connect local: %s:%s remote: %s:%s',this.localAddress,this.localPort,this.remoteAddress,this.remotePort)}
items.forEach(item=>{if(item.type==='transport'&&item.selectedCandidatePairId){setSelectedCandidatePair(candidatePairs[item.selectedCandidatePairId])}
if((item.type==='googCandidatePair'&&item.googActiveConnection==='true')||((item.type==='candidatepair'||item.type==='candidate-pair')&&item.selected)){setSelectedCandidatePair(item)}})
if(!foundSelectedCandidatePair&&(!Object.keys(candidatePairs).length||Object.keys(localCandidates).length)){setTimeout(findCandidatePair,100)
return}else{this._connecting=false
this._connected=true}
if(this._chunk){try{this.send(this._chunk)}catch(err){return this.destroy(errCode(err,'ERR_DATA_CHANNEL'))}
this._chunk=null
this._debug('sent chunk from "write before connect"')
const cb=this._cb
this._cb=null
cb(null)}
if(typeof this._channel.bufferedAmountLowThreshold!=='number'){this._interval=setInterval(()=>this._onInterval(),150)
if(this._interval.unref)this._interval.unref()}
this._debug('connect')
this.emit('connect')})}
findCandidatePair()}
_onInterval(){if(!this._cb||!this._channel||this._channel.bufferedAmount>MAX_BUFFERED_AMOUNT){return}
this._onChannelBufferedAmountLow()}
_onSignalingStateChange(){if(this.destroyed)return
if(this._pc.signalingState==='stable'){this._isNegotiating=false
this._debug('flushing sender queue',this._sendersAwaitingStable)
this._sendersAwaitingStable.forEach(sender=>{this._pc.removeTrack(sender)
this._queuedNegotiation=true})
this._sendersAwaitingStable=[]
if(this._queuedNegotiation){this._debug('flushing negotiation queue')
this._queuedNegotiation=false
this._needsNegotiation()}else{this._debug('negotiated')
this.emit('negotiated')}}
this._debug('signalingStateChange %s',this._pc.signalingState)
this.emit('signalingStateChange',this._pc.signalingState)}
_onIceCandidate(event){if(this.destroyed)return
if(event.candidate&&this.trickle){this.emit('signal',{type:'candidate',candidate:{candidate:event.candidate.candidate,sdpMLineIndex:event.candidate.sdpMLineIndex,sdpMid:event.candidate.sdpMid}})}else if(!event.candidate&&!this._iceComplete){this._iceComplete=true
this.emit('_iceComplete')}
if(event.candidate){this._startIceCompleteTimeout()}}
_onChannelMessage(event){if(this.destroyed)return
let data=event.data
if(data instanceof ArrayBuffer)data=Buffer.from(data)
this.push(data)}
_onChannelBufferedAmountLow(){if(this.destroyed||!this._cb)return
this._debug('ending backpressure: bufferedAmount %d',this._channel.bufferedAmount)
const cb=this._cb
this._cb=null
cb(null)}
_onChannelOpen(){if(this._connected||this.destroyed)return
this._debug('on channel open')
this._channelReady=true
this._maybeReady()}
_onChannelClose(){if(this.destroyed)return
this._debug('on channel close')
this.destroy()}
_onTrack(event){if(this.destroyed)return
event.streams.forEach(eventStream=>{this._debug('on track')
this.emit('track',event.track,eventStream)
this._remoteTracks.push({track:event.track,stream:eventStream})
if(this._remoteStreams.some(remoteStream=>{return remoteStream.id===eventStream.id}))return
this._remoteStreams.push(eventStream)
queueMicrotask(()=>{this._debug('on stream')
this.emit('stream',eventStream)})})}
_debug(){const args=[].slice.call(arguments)
args[0]='['+this._id+'] '+args[0]
debug.apply(null,args)}}
Peer.WEBRTC_SUPPORT=!!getBrowserRTC()
Peer.config={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:global.stun.twilio.com:3478']}],sdpSemantics:'unified-plan'}
Peer.channelConfig={}
module.exports=Peer},{"buffer":"buffer","debug":"debug","err-code":17,"get-browser-rtc":18,"queue-microtask":24,"randombytes":25,"readable-stream":40}],46:[function(require,module,exports){(function(Buffer){(function(){/*!simple-websocket. MIT License. Feross Aboukhadijeh <https://feross.org/opensource>*/const debug=require('debug')('simple-websocket')
const randombytes=require('randombytes')
const stream=require('readable-stream')
const queueMicrotask=require('queue-microtask')
const ws=require('ws')
const _WebSocket=typeof ws!=='function'?WebSocket:ws
const MAX_BUFFERED_AMOUNT=64*1024
class Socket extends stream.Duplex{constructor(opts={}){if(typeof opts==='string'){opts={url:opts}}
opts=Object.assign({allowHalfOpen:false},opts)
super(opts)
if(opts.url==null&&opts.socket==null){throw new Error('Missing required `url` or `socket` option')}
if(opts.url!=null&&opts.socket!=null){throw new Error('Must specify either `url` or `socket` option, not both')}
this._id=randombytes(4).toString('hex').slice(0,7)
this._debug('new websocket: %o',opts)
this.connected=false
this.destroyed=false
this._chunk=null
this._cb=null
this._interval=null
if(opts.socket){this.url=opts.socket.url
this._ws=opts.socket
this.connected=opts.socket.readyState===_WebSocket.OPEN}else{this.url=opts.url
try{if(typeof ws==='function'){this._ws=new _WebSocket(opts.url,null,{...opts,encoding:undefined})}else{this._ws=new _WebSocket(opts.url)}}catch(err){queueMicrotask(()=>this.destroy(err))
return}}
this._ws.binaryType='arraybuffer'
if(opts.socket&&this.connected){queueMicrotask(()=>this._handleOpen())}else{this._ws.onopen=()=>this._handleOpen()}
this._ws.onmessage=event=>this._handleMessage(event)
this._ws.onclose=()=>this._handleClose()
this._ws.onerror=err=>this._handleError(err)
this._handleFinishBound=()=>this._handleFinish()
this.once('finish',this._handleFinishBound)}
send(chunk){this._ws.send(chunk)}
destroy(err){this._destroy(err,()=>{})}
_destroy(err,cb){if(this.destroyed)return
this._debug('destroy (error: %s)',err&&(err.message||err))
this.readable=this.writable=false
if(!this._readableState.ended)this.push(null)
if(!this._writableState.finished)this.end()
this.connected=false
this.destroyed=true
clearInterval(this._interval)
this._interval=null
this._chunk=null
this._cb=null
if(this._handleFinishBound){this.removeListener('finish',this._handleFinishBound)}
this._handleFinishBound=null
if(this._ws){const ws=this._ws
const onClose=()=>{ws.onclose=null}
if(ws.readyState===_WebSocket.CLOSED){onClose()}else{try{ws.onclose=onClose
ws.close()}catch(err){onClose()}}
ws.onopen=null
ws.onmessage=null
ws.onerror=()=>{}}
this._ws=null
if(err)this.emit('error',err)
this.emit('close')
cb()}
_read(){}
_write(chunk,encoding,cb){if(this.destroyed)return cb(new Error('cannot write after socket is destroyed'))
if(this.connected){try{this.send(chunk)}catch(err){return this.destroy(err)}
if(typeof ws!=='function'&&this._ws.bufferedAmount>MAX_BUFFERED_AMOUNT){this._debug('start backpressure: bufferedAmount %d',this._ws.bufferedAmount)
this._cb=cb}else{cb(null)}}else{this._debug('write before connect')
this._chunk=chunk
this._cb=cb}}
_handleOpen(){if(this.connected||this.destroyed)return
this.connected=true
if(this._chunk){try{this.send(this._chunk)}catch(err){return this.destroy(err)}
this._chunk=null
this._debug('sent chunk from "write before connect"')
const cb=this._cb
this._cb=null
cb(null)}
if(typeof ws!=='function'){this._interval=setInterval(()=>this._onInterval(),150)
if(this._interval.unref)this._interval.unref()}
this._debug('connect')
this.emit('connect')}
_handleMessage(event){if(this.destroyed)return
let data=event.data
if(data instanceof ArrayBuffer)data=Buffer.from(data)
this.push(data)}
_handleClose(){if(this.destroyed)return
this._debug('on close')
this.destroy()}
_handleError(_){this.destroy(new Error(`Error connecting to ${this.url}`))}
_handleFinish(){if(this.destroyed)return
const destroySoon=()=>{setTimeout(()=>this.destroy(),1000)}
if(this.connected){destroySoon()}else{this.once('connect',destroySoon)}}
_onInterval(){if(!this._cb||!this._ws||this._ws.bufferedAmount>MAX_BUFFERED_AMOUNT){return}
this._debug('ending backpressure: bufferedAmount %d',this._ws.bufferedAmount)
const cb=this._cb
this._cb=null
cb(null)}
_debug(){const args=[].slice.call(arguments)
args[0]='['+this._id+'] '+args[0]
debug.apply(null,args)}}
Socket.WEBSOCKET_SUPPORT=!!_WebSocket
module.exports=Socket}).call(this)}).call(this,require("buffer").Buffer)},{"buffer":"buffer","debug":"debug","queue-microtask":24,"randombytes":25,"readable-stream":40,"ws":15}],47:[function(require,module,exports){'use strict';var Buffer=require('safe-buffer').Buffer;var isEncoding=Buffer.isEncoding||function(encoding){encoding=''+encoding;switch(encoding&&encoding.toLowerCase()){case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':return true;default:return false;}};function _normalizeEncoding(enc){if(!enc)return 'utf8';var retried;while(true){switch(enc){case 'utf8':case 'utf-8':return 'utf8';case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':return 'utf16le';case 'latin1':case 'binary':return 'latin1';case 'base64':case 'ascii':case 'hex':return enc;default:if(retried)return;enc=(''+enc).toLowerCase();retried=true;}}};function normalizeEncoding(enc){var nenc=_normalizeEncoding(enc);if(typeof nenc!=='string'&&(Buffer.isEncoding===isEncoding||!isEncoding(enc)))throw new Error('Unknown encoding: '+enc);return nenc||enc;}
exports.StringDecoder=StringDecoder;function StringDecoder(encoding){this.encoding=normalizeEncoding(encoding);var nb;switch(this.encoding){case 'utf16le':this.text=utf16Text;this.end=utf16End;nb=4;break;case 'utf8':this.fillLast=utf8FillLast;nb=4;break;case 'base64':this.text=base64Text;this.end=base64End;nb=3;break;default:this.write=simpleWrite;this.end=simpleEnd;return;}
this.lastNeed=0;this.lastTotal=0;this.lastChar=Buffer.allocUnsafe(nb);}
StringDecoder.prototype.write=function(buf){if(buf.length===0)return '';var r;var i;if(this.lastNeed){r=this.fillLast(buf);if(r===undefined)return '';i=this.lastNeed;this.lastNeed=0;}else{i=0;}
if(i<buf.length)return r?r+this.text(buf,i):this.text(buf,i);return r||'';};StringDecoder.prototype.end=utf8End;StringDecoder.prototype.text=utf8Text;StringDecoder.prototype.fillLast=function(buf){if(this.lastNeed<=buf.length){buf.copy(this.lastChar,this.lastTotal-this.lastNeed,0,this.lastNeed);return this.lastChar.toString(this.encoding,0,this.lastTotal);}
buf.copy(this.lastChar,this.lastTotal-this.lastNeed,0,buf.length);this.lastNeed-=buf.length;};function utf8CheckByte(byte){if(byte<=0x7F)return 0;else if(byte>>5===0x06)return 2;else if(byte>>4===0x0E)return 3;else if(byte>>3===0x1E)return 4;return byte>>6===0x02?-1:-2;}
function utf8CheckIncomplete(self,buf,i){var j=buf.length-1;if(j<i)return 0;var nb=utf8CheckByte(buf[j]);if(nb>=0){if(nb>0)self.lastNeed=nb-1;return nb;}
if(--j<i||nb===-2)return 0;nb=utf8CheckByte(buf[j]);if(nb>=0){if(nb>0)self.lastNeed=nb-2;return nb;}
if(--j<i||nb===-2)return 0;nb=utf8CheckByte(buf[j]);if(nb>=0){if(nb>0){if(nb===2)nb=0;else self.lastNeed=nb-3;}
return nb;}
return 0;}
function utf8CheckExtraBytes(self,buf,p){if((buf[0]&0xC0)!==0x80){self.lastNeed=0;return '\ufffd';}
if(self.lastNeed>1&&buf.length>1){if((buf[1]&0xC0)!==0x80){self.lastNeed=1;return '\ufffd';}
if(self.lastNeed>2&&buf.length>2){if((buf[2]&0xC0)!==0x80){self.lastNeed=2;return '\ufffd';}}}}
function utf8FillLast(buf){var p=this.lastTotal-this.lastNeed;var r=utf8CheckExtraBytes(this,buf,p);if(r!==undefined)return r;if(this.lastNeed<=buf.length){buf.copy(this.lastChar,p,0,this.lastNeed);return this.lastChar.toString(this.encoding,0,this.lastTotal);}
buf.copy(this.lastChar,p,0,buf.length);this.lastNeed-=buf.length;}
function utf8Text(buf,i){var total=utf8CheckIncomplete(this,buf,i);if(!this.lastNeed)return buf.toString('utf8',i);this.lastTotal=total;var end=buf.length-(total-this.lastNeed);buf.copy(this.lastChar,0,end);return buf.toString('utf8',i,end);}
function utf8End(buf){var r=buf&&buf.length?this.write(buf):'';if(this.lastNeed)return r+'\ufffd';return r;}
function utf16Text(buf,i){if((buf.length-i)%2===0){var r=buf.toString('utf16le',i);if(r){var c=r.charCodeAt(r.length-1);if(c>=0xD800&&c<=0xDBFF){this.lastNeed=2;this.lastTotal=4;this.lastChar[0]=buf[buf.length-2];this.lastChar[1]=buf[buf.length-1];return r.slice(0,-1);}}
return r;}
this.lastNeed=1;this.lastTotal=2;this.lastChar[0]=buf[buf.length-1];return buf.toString('utf16le',i,buf.length-1);}
function utf16End(buf){var r=buf&&buf.length?this.write(buf):'';if(this.lastNeed){var end=this.lastTotal-this.lastNeed;return r+this.lastChar.toString('utf16le',0,end);}
return r;}
function base64Text(buf,i){var n=(buf.length-i)%3;if(n===0)return buf.toString('base64',i);this.lastNeed=3-n;this.lastTotal=3;if(n===1){this.lastChar[0]=buf[buf.length-1];}else{this.lastChar[0]=buf[buf.length-2];this.lastChar[1]=buf[buf.length-1];}
return buf.toString('base64',i,buf.length-n);}
function base64End(buf){var r=buf&&buf.length?this.write(buf):'';if(this.lastNeed)return r+this.lastChar.toString('base64',0,3-this.lastNeed);return r;}
function simpleWrite(buf){return buf.toString(this.encoding);}
function simpleEnd(buf){return buf&&buf.length?this.write(buf):'';}},{"safe-buffer":42}],48:[function(require,module,exports){(function(global){(function(){module.exports=deprecate;function deprecate(fn,msg){if(config('noDeprecation')){return fn;}
var warned=false;function deprecated(){if(!warned){if(config('throwDeprecation')){throw new Error(msg);}else if(config('traceDeprecation')){console.trace(msg);}else{console.warn(msg);}
warned=true;}
return fn.apply(this,arguments);}
return deprecated;}
function config(name){try{if(!global.localStorage)return false;}catch(_){return false;}
var val=global.localStorage[name];if(null==val)return false;return String(val).toLowerCase()==='true';}}).call(this)}).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{}],49:[function(require,module,exports){module.exports=wrappy
function wrappy(fn,cb){if(fn&&cb)return wrappy(fn)(cb)
if(typeof fn!=='function')
throw new TypeError('need wrapper function')
Object.keys(fn).forEach(function(k){wrapper[k]=fn[k]})
return wrapper
function wrapper(){var args=new Array(arguments.length)
for(var i=0;i<args.length;i++){args[i]=arguments[i]}
var ret=fn.apply(this,args)
var cb=args[args.length-1]
if(typeof ret==='function'&&ret!==cb){Object.keys(cb).forEach(function(k){ret[k]=cb[k]})}
return ret}}},{}],"buffer":[function(require,module,exports){(function(Buffer){(function(){/*!
* The buffer module from node.js, for the browser.
*
* @author Feross Aboukhadijeh <https://feross.org>
* @license MIT
*/'use strict'
var base64=require('base64-js')
var ieee754=require('ieee754')
exports.Buffer=Buffer
exports.SlowBuffer=SlowBuffer
exports.INSPECT_MAX_BYTES=50
var K_MAX_LENGTH=0x7fffffff
exports.kMaxLength=K_MAX_LENGTH
Buffer.TYPED_ARRAY_SUPPORT=typedArraySupport()
if(!Buffer.TYPED_ARRAY_SUPPORT&&typeof console!=='undefined'&&typeof console.error==='function'){console.error('This browser lacks typed array (Uint8Array) support which is required by '+
'`buffer` v5.x. Use `buffer` v4.x if you require old browser support.')}
function typedArraySupport(){try{var arr=new Uint8Array(1)
arr.__proto__={__proto__:Uint8Array.prototype,foo:function(){return 42}}
return arr.foo()===42}catch(e){return false}}
Object.defineProperty(Buffer.prototype,'parent',{enumerable:true,get:function(){if(!Buffer.isBuffer(this))return undefined
return this.buffer}})
Object.defineProperty(Buffer.prototype,'offset',{enumerable:true,get:function(){if(!Buffer.isBuffer(this))return undefined
return this.byteOffset}})
function createBuffer(length){if(length>K_MAX_LENGTH){throw new RangeError('The value "'+length+'" is invalid for option "size"')}
var buf=new Uint8Array(length)
buf.__proto__=Buffer.prototype
return buf}
function Buffer(arg,encodingOrOffset,length){if(typeof arg==='number'){if(typeof encodingOrOffset==='string'){throw new TypeError('The "string" argument must be of type string. Received type number')}
return allocUnsafe(arg)}
return from(arg,encodingOrOffset,length)}
if(typeof Symbol!=='undefined'&&Symbol.species!=null&&Buffer[Symbol.species]===Buffer){Object.defineProperty(Buffer,Symbol.species,{value:null,configurable:true,enumerable:false,writable:false})}
Buffer.poolSize=8192
function from(value,encodingOrOffset,length){if(typeof value==='string'){return fromString(value,encodingOrOffset)}
if(ArrayBuffer.isView(value)){return fromArrayLike(value)}
if(value==null){throw TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, '+
'or Array-like Object. Received type '+(typeof value))}
if(isInstance(value,ArrayBuffer)||(value&&isInstance(value.buffer,ArrayBuffer))){return fromArrayBuffer(value,encodingOrOffset,length)}
if(typeof value==='number'){throw new TypeError('The "value" argument must not be of type number. Received type number')}
var valueOf=value.valueOf&&value.valueOf()
if(valueOf!=null&&valueOf!==value){return Buffer.from(valueOf,encodingOrOffset,length)}
var b=fromObject(value)
if(b)return b
if(typeof Symbol!=='undefined'&&Symbol.toPrimitive!=null&&typeof value[Symbol.toPrimitive]==='function'){return Buffer.from(value[Symbol.toPrimitive]('string'),encodingOrOffset,length)}
throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, '+
'or Array-like Object. Received type '+(typeof value))}
Buffer.from=function(value,encodingOrOffset,length){return from(value,encodingOrOffset,length)}
Buffer.prototype.__proto__=Uint8Array.prototype
Buffer.__proto__=Uint8Array
function assertSize(size){if(typeof size!=='number'){throw new TypeError('"size" argument must be of type number')}else if(size<0){throw new RangeError('The value "'+size+'" is invalid for option "size"')}}
function alloc(size,fill,encoding){assertSize(size)
if(size<=0){return createBuffer(size)}
if(fill!==undefined){return typeof encoding==='string'?createBuffer(size).fill(fill,encoding):createBuffer(size).fill(fill)}
return createBuffer(size)}
Buffer.alloc=function(size,fill,encoding){return alloc(size,fill,encoding)}
function allocUnsafe(size){assertSize(size)
return createBuffer(size<0?0:checked(size)|0)}
Buffer.allocUnsafe=function(size){return allocUnsafe(size)}
Buffer.allocUnsafeSlow=function(size){return allocUnsafe(size)}
function fromString(string,encoding){if(typeof encoding!=='string'||encoding===''){encoding='utf8'}
if(!Buffer.isEncoding(encoding)){throw new TypeError('Unknown encoding: '+encoding)}
var length=byteLength(string,encoding)|0
var buf=createBuffer(length)
var actual=buf.write(string,encoding)
if(actual!==length){buf=buf.slice(0,actual)}
return buf}
function fromArrayLike(array){var length=array.length<0?0:checked(array.length)|0
var buf=createBuffer(length)
for(var i=0;i<length;i+=1){buf[i]=array[i]&255}
return buf}
function fromArrayBuffer(array,byteOffset,length){if(byteOffset<0||array.byteLength<byteOffset){throw new RangeError('"offset" is outside of buffer bounds')}
if(array.byteLength<byteOffset+(length||0)){throw new RangeError('"length" is outside of buffer bounds')}
var buf
if(byteOffset===undefined&&length===undefined){buf=new Uint8Array(array)}else if(length===undefined){buf=new Uint8Array(array,byteOffset)}else{buf=new Uint8Array(array,byteOffset,length)}
buf.__proto__=Buffer.prototype
return buf}
function fromObject(obj){if(Buffer.isBuffer(obj)){var len=checked(obj.length)|0
var buf=createBuffer(len)
if(buf.length===0){return buf}
obj.copy(buf,0,0,len)
return buf}
if(obj.length!==undefined){if(typeof obj.length!=='number'||numberIsNaN(obj.length)){return createBuffer(0)}
return fromArrayLike(obj)}
if(obj.type==='Buffer'&&Array.isArray(obj.data)){return fromArrayLike(obj.data)}}
function checked(length){if(length>=K_MAX_LENGTH){throw new RangeError('Attempt to allocate Buffer larger than maximum '+
'size: 0x'+K_MAX_LENGTH.toString(16)+' bytes')}
return length|0}
function SlowBuffer(length){if(+length!=length){length=0}
return Buffer.alloc(+length)}
Buffer.isBuffer=function isBuffer(b){return b!=null&&b._isBuffer===true&&b!==Buffer.prototype}
Buffer.compare=function compare(a,b){if(isInstance(a,Uint8Array))a=Buffer.from(a,a.offset,a.byteLength)
if(isInstance(b,Uint8Array))b=Buffer.from(b,b.offset,b.byteLength)
if(!Buffer.isBuffer(a)||!Buffer.isBuffer(b)){throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array')}
if(a===b)return 0
var x=a.length
var y=b.length
for(var i=0,len=Math.min(x,y);i<len;++i){if(a[i]!==b[i]){x=a[i]
y=b[i]
break}}
if(x<y)return-1
if(y<x)return 1
return 0}
Buffer.isEncoding=function isEncoding(encoding){switch(String(encoding).toLowerCase()){case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'latin1':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':return true
default:return false}}
Buffer.concat=function concat(list,length){if(!Array.isArray(list)){throw new TypeError('"list" argument must be an Array of Buffers')}
if(list.length===0){return Buffer.alloc(0)}
var i
if(length===undefined){length=0
for(i=0;i<list.length;++i){length+=list[i].length}}
var buffer=Buffer.allocUnsafe(length)
var pos=0
for(i=0;i<list.length;++i){var buf=list[i]
if(isInstance(buf,Uint8Array)){buf=Buffer.from(buf)}
if(!Buffer.isBuffer(buf)){throw new TypeError('"list" argument must be an Array of Buffers')}
buf.copy(buffer,pos)
pos+=buf.length}
return buffer}
function byteLength(string,encoding){if(Buffer.isBuffer(string)){return string.length}
if(ArrayBuffer.isView(string)||isInstance(string,ArrayBuffer)){return string.byteLength}
if(typeof string!=='string'){throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. '+
'Received type '+typeof string)}
var len=string.length
var mustMatch=(arguments.length>2&&arguments[2]===true)
if(!mustMatch&&len===0)return 0
var loweredCase=false
for(;;){switch(encoding){case 'ascii':case 'latin1':case 'binary':return len
case 'utf8':case 'utf-8':return utf8ToBytes(string).length
case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':return len*2
case 'hex':return len>>>1
case 'base64':return base64ToBytes(string).length
default:if(loweredCase){return mustMatch?-1:utf8ToBytes(string).length}
encoding=(''+encoding).toLowerCase()
loweredCase=true}}}
Buffer.byteLength=byteLength
function slowToString(encoding,start,end){var loweredCase=false
if(start===undefined||start<0){start=0}
if(start>this.length){return ''}
if(end===undefined||end>this.length){end=this.length}
if(end<=0){return ''}
end>>>=0
start>>>=0
if(end<=start){return ''}
if(!encoding)encoding='utf8'
while(true){switch(encoding){case 'hex':return hexSlice(this,start,end)
case 'utf8':case 'utf-8':return utf8Slice(this,start,end)
case 'ascii':return asciiSlice(this,start,end)
case 'latin1':case 'binary':return latin1Slice(this,start,end)
case 'base64':return base64Slice(this,start,end)
case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':return utf16leSlice(this,start,end)
default:if(loweredCase)throw new TypeError('Unknown encoding: '+encoding)
encoding=(encoding+'').toLowerCase()
loweredCase=true}}}
Buffer.prototype._isBuffer=true
function swap(b,n,m){var i=b[n]
b[n]=b[m]
b[m]=i}
Buffer.prototype.swap16=function swap16(){var len=this.length
if(len%2!==0){throw new RangeError('Buffer size must be a multiple of 16-bits')}
for(var i=0;i<len;i+=2){swap(this,i,i+1)}
return this}
Buffer.prototype.swap32=function swap32(){var len=this.length
if(len%4!==0){throw new RangeError('Buffer size must be a multiple of 32-bits')}
for(var i=0;i<len;i+=4){swap(this,i,i+3)
swap(this,i+1,i+2)}
return this}
Buffer.prototype.swap64=function swap64(){var len=this.length
if(len%8!==0){throw new RangeError('Buffer size must be a multiple of 64-bits')}
for(var i=0;i<len;i+=8){swap(this,i,i+7)
swap(this,i+1,i+6)
swap(this,i+2,i+5)
swap(this,i+3,i+4)}
return this}
Buffer.prototype.toString=function toString(){var length=this.length
if(length===0)return ''
if(arguments.length===0)return utf8Slice(this,0,length)
return slowToString.apply(this,arguments)}
Buffer.prototype.toLocaleString=Buffer.prototype.toString
Buffer.prototype.equals=function equals(b){if(!Buffer.isBuffer(b))throw new TypeError('Argument must be a Buffer')
if(this===b)return true
return Buffer.compare(this,b)===0}
Buffer.prototype.inspect=function inspect(){var str=''
var max=exports.INSPECT_MAX_BYTES
str=this.toString('hex',0,max).replace(/(.{2})/g,'$1 ').trim()
if(this.length>max)str+=' ... '
return '<Buffer '+str+'>'}
Buffer.prototype.compare=function compare(target,start,end,thisStart,thisEnd){if(isInstance(target,Uint8Array)){target=Buffer.from(target,target.offset,target.byteLength)}
if(!Buffer.isBuffer(target)){throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. '+
'Received type '+(typeof target))}
if(start===undefined){start=0}
if(end===undefined){end=target?target.length:0}
if(thisStart===undefined){thisStart=0}
if(thisEnd===undefined){thisEnd=this.length}
if(start<0||end>target.length||thisStart<0||thisEnd>this.length){throw new RangeError('out of range index')}
if(thisStart>=thisEnd&&start>=end){return 0}
if(thisStart>=thisEnd){return-1}
if(start>=end){return 1}
start>>>=0
end>>>=0
thisStart>>>=0
thisEnd>>>=0
if(this===target)return 0
var x=thisEnd-thisStart
var y=end-start
var len=Math.min(x,y)
var thisCopy=this.slice(thisStart,thisEnd)
var targetCopy=target.slice(start,end)
for(var i=0;i<len;++i){if(thisCopy[i]!==targetCopy[i]){x=thisCopy[i]
y=targetCopy[i]
break}}
if(x<y)return-1
if(y<x)return 1
return 0}
function bidirectionalIndexOf(buffer,val,byteOffset,encoding,dir){if(buffer.length===0)return-1
if(typeof byteOffset==='string'){encoding=byteOffset
byteOffset=0}else if(byteOffset>0x7fffffff){byteOffset=0x7fffffff}else if(byteOffset<-0x80000000){byteOffset=-0x80000000}
byteOffset=+byteOffset
if(numberIsNaN(byteOffset)){byteOffset=dir?0:(buffer.length-1)}
if(byteOffset<0)byteOffset=buffer.length+byteOffset
if(byteOffset>=buffer.length){if(dir)return-1
else byteOffset=buffer.length-1}else if(byteOffset<0){if(dir)byteOffset=0
else return-1}
if(typeof val==='string'){val=Buffer.from(val,encoding)}
if(Buffer.isBuffer(val)){if(val.length===0){return-1}
return arrayIndexOf(buffer,val,byteOffset,encoding,dir)}else if(typeof val==='number'){val=val&0xFF
if(typeof Uint8Array.prototype.indexOf==='function'){if(dir){return Uint8Array.prototype.indexOf.call(buffer,val,byteOffset)}else{return Uint8Array.prototype.lastIndexOf.call(buffer,val,byteOffset)}}
return arrayIndexOf(buffer,[val],byteOffset,encoding,dir)}
throw new TypeError('val must be string, number or Buffer')}
function arrayIndexOf(arr,val,byteOffset,encoding,dir){var indexSize=1
var arrLength=arr.length
var valLength=val.length
if(encoding!==undefined){encoding=String(encoding).toLowerCase()
if(encoding==='ucs2'||encoding==='ucs-2'||encoding==='utf16le'||encoding==='utf-16le'){if(arr.length<2||val.length<2){return-1}
indexSize=2
arrLength/=2
valLength/=2
byteOffset/=2}}
function read(buf,i){if(indexSize===1){return buf[i]}else{return buf.readUInt16BE(i*indexSize)}}
var i
if(dir){var foundIndex=-1
for(i=byteOffset;i<arrLength;i++){if(read(arr,i)===read(val,foundIndex===-1?0:i-foundIndex)){if(foundIndex===-1)foundIndex=i
if(i-foundIndex+1===valLength)return foundIndex*indexSize}else{if(foundIndex!==-1)i-=i-foundIndex
foundIndex=-1}}}else{if(byteOffset+valLength>arrLength)byteOffset=arrLength-valLength
for(i=byteOffset;i>=0;i--){var found=true
for(var j=0;j<valLength;j++){if(read(arr,i+j)!==read(val,j)){found=false
break}}
if(found)return i}}
return-1}
Buffer.prototype.includes=function includes(val,byteOffset,encoding){return this.indexOf(val,byteOffset,encoding)!==-1}
Buffer.prototype.indexOf=function indexOf(val,byteOffset,encoding){return bidirectionalIndexOf(this,val,byteOffset,encoding,true)}
Buffer.prototype.lastIndexOf=function lastIndexOf(val,byteOffset,encoding){return bidirectionalIndexOf(this,val,byteOffset,encoding,false)}
function hexWrite(buf,string,offset,length){offset=Number(offset)||0
var remaining=buf.length-offset
if(!length){length=remaining}else{length=Number(length)
if(length>remaining){length=remaining}}
var strLen=string.length
if(length>strLen/2){length=strLen/2}
for(var i=0;i<length;++i){var parsed=parseInt(string.substr(i*2,2),16)
if(numberIsNaN(parsed))return i
buf[offset+i]=parsed}
return i}
function utf8Write(buf,string,offset,length){return blitBuffer(utf8ToBytes(string,buf.length-offset),buf,offset,length)}
function asciiWrite(buf,string,offset,length){return blitBuffer(asciiToBytes(string),buf,offset,length)}
function latin1Write(buf,string,offset,length){return asciiWrite(buf,string,offset,length)}
function base64Write(buf,string,offset,length){return blitBuffer(base64ToBytes(string),buf,offset,length)}
function ucs2Write(buf,string,offset,length){return blitBuffer(utf16leToBytes(string,buf.length-offset),buf,offset,length)}
Buffer.prototype.write=function write(string,offset,length,encoding){if(offset===undefined){encoding='utf8'
length=this.length
offset=0}else if(length===undefined&&typeof offset==='string'){encoding=offset
length=this.length
offset=0}else if(isFinite(offset)){offset=offset>>>0
if(isFinite(length)){length=length>>>0
if(encoding===undefined)encoding='utf8'}else{encoding=length
length=undefined}}else{throw new Error('Buffer.write(string, encoding, offset[, length]) is no longer supported')}
var remaining=this.length-offset
if(length===undefined||length>remaining)length=remaining
if((string.length>0&&(length<0||offset<0))||offset>this.length){throw new RangeError('Attempt to write outside buffer bounds')}
if(!encoding)encoding='utf8'
var loweredCase=false
for(;;){switch(encoding){case 'hex':return hexWrite(this,string,offset,length)
case 'utf8':case 'utf-8':return utf8Write(this,string,offset,length)
case 'ascii':return asciiWrite(this,string,offset,length)
case 'latin1':case 'binary':return latin1Write(this,string,offset,length)
case 'base64':return base64Write(this,string,offset,length)
case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':return ucs2Write(this,string,offset,length)
default:if(loweredCase)throw new TypeError('Unknown encoding: '+encoding)
encoding=(''+encoding).toLowerCase()
loweredCase=true}}}
Buffer.prototype.toJSON=function toJSON(){return{type:'Buffer',data:Array.prototype.slice.call(this._arr||this,0)}}
function base64Slice(buf,start,end){if(start===0&&end===buf.length){return base64.fromByteArray(buf)}else{return base64.fromByteArray(buf.slice(start,end))}}
function utf8Slice(buf,start,end){end=Math.min(buf.length,end)
var res=[]
var i=start
while(i<end){var firstByte=buf[i]
var codePoint=null
var bytesPerSequence=(firstByte>0xEF)?4:(firstByte>0xDF)?3:(firstByte>0xBF)?2:1
if(i+bytesPerSequence<=end){var secondByte,thirdByte,fourthByte,tempCodePoint
switch(bytesPerSequence){case 1:if(firstByte<0x80){codePoint=firstByte}
break
case 2:secondByte=buf[i+1]
if((secondByte&0xC0)===0x80){tempCodePoint=(firstByte&0x1F)<<0x6|(secondByte&0x3F)
if(tempCodePoint>0x7F){codePoint=tempCodePoint}}
break
case 3:secondByte=buf[i+1]
thirdByte=buf[i+2]
if((secondByte&0xC0)===0x80&&(thirdByte&0xC0)===0x80){tempCodePoint=(firstByte&0xF)<<0xC|(secondByte&0x3F)<<0x6|(thirdByte&0x3F)
if(tempCodePoint>0x7FF&&(tempCodePoint<0xD800||tempCodePoint>0xDFFF)){codePoint=tempCodePoint}}
break
case 4:secondByte=buf[i+1]
thirdByte=buf[i+2]
fourthByte=buf[i+3]
if((secondByte&0xC0)===0x80&&(thirdByte&0xC0)===0x80&&(fourthByte&0xC0)===0x80){tempCodePoint=(firstByte&0xF)<<0x12|(secondByte&0x3F)<<0xC|(thirdByte&0x3F)<<0x6|(fourthByte&0x3F)
if(tempCodePoint>0xFFFF&&tempCodePoint<0x110000){codePoint=tempCodePoint}}}}
if(codePoint===null){codePoint=0xFFFD
bytesPerSequence=1}else if(codePoint>0xFFFF){codePoint-=0x10000
res.push(codePoint>>>10&0x3FF|0xD800)
codePoint=0xDC00|codePoint&0x3FF}
res.push(codePoint)
i+=bytesPerSequence}
return decodeCodePointsArray(res)}
var MAX_ARGUMENTS_LENGTH=0x1000
function decodeCodePointsArray(codePoints){var len=codePoints.length
if(len<=MAX_ARGUMENTS_LENGTH){return String.fromCharCode.apply(String,codePoints)}
var res=''
var i=0
while(i<len){res+=String.fromCharCode.apply(String,codePoints.slice(i,i+=MAX_ARGUMENTS_LENGTH))}
return res}
function asciiSlice(buf,start,end){var ret=''
end=Math.min(buf.length,end)
for(var i=start;i<end;++i){ret+=String.fromCharCode(buf[i]&0x7F)}
return ret}
function latin1Slice(buf,start,end){var ret=''
end=Math.min(buf.length,end)
for(var i=start;i<end;++i){ret+=String.fromCharCode(buf[i])}
return ret}
function hexSlice(buf,start,end){var len=buf.length
if(!start||start<0)start=0
if(!end||end<0||end>len)end=len
var out=''
for(var i=start;i<end;++i){out+=toHex(buf[i])}
return out}
function utf16leSlice(buf,start,end){var bytes=buf.slice(start,end)
var res=''
for(var i=0;i<bytes.length;i+=2){res+=String.fromCharCode(bytes[i]+(bytes[i+1]*256))}
return res}
Buffer.prototype.slice=function slice(start,end){var len=this.length
start=~~start
end=end===undefined?len:~~end
if(start<0){start+=len
if(start<0)start=0}else if(start>len){start=len}
if(end<0){end+=len
if(end<0)end=0}else if(end>len){end=len}
if(end<start)end=start
var newBuf=this.subarray(start,end)
newBuf.__proto__=Buffer.prototype
return newBuf}
function checkOffset(offset,ext,length){if((offset%1)!==0||offset<0)throw new RangeError('offset is not uint')
if(offset+ext>length)throw new RangeError('Trying to access beyond buffer length')}
Buffer.prototype.readUIntLE=function readUIntLE(offset,byteLength,noAssert){offset=offset>>>0
byteLength=byteLength>>>0
if(!noAssert)checkOffset(offset,byteLength,this.length)
var val=this[offset]
var mul=1
var i=0
while(++i<byteLength&&(mul*=0x100)){val+=this[offset+i]*mul}
return val}
Buffer.prototype.readUIntBE=function readUIntBE(offset,byteLength,noAssert){offset=offset>>>0
byteLength=byteLength>>>0
if(!noAssert){checkOffset(offset,byteLength,this.length)}
var val=this[offset+--byteLength]
var mul=1
while(byteLength>0&&(mul*=0x100)){val+=this[offset+--byteLength]*mul}
return val}
Buffer.prototype.readUInt8=function readUInt8(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,1,this.length)
return this[offset]}
Buffer.prototype.readUInt16LE=function readUInt16LE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,2,this.length)
return this[offset]|(this[offset+1]<<8)}
Buffer.prototype.readUInt16BE=function readUInt16BE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,2,this.length)
return(this[offset]<<8)|this[offset+1]}
Buffer.prototype.readUInt32LE=function readUInt32LE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,4,this.length)
return((this[offset])|(this[offset+1]<<8)|(this[offset+2]<<16))+
(this[offset+3]*0x1000000)}
Buffer.prototype.readUInt32BE=function readUInt32BE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,4,this.length)
return(this[offset]*0x1000000)+
((this[offset+1]<<16)|(this[offset+2]<<8)|this[offset+3])}
Buffer.prototype.readIntLE=function readIntLE(offset,byteLength,noAssert){offset=offset>>>0
byteLength=byteLength>>>0
if(!noAssert)checkOffset(offset,byteLength,this.length)
var val=this[offset]
var mul=1
var i=0
while(++i<byteLength&&(mul*=0x100)){val+=this[offset+i]*mul}
mul*=0x80
if(val>=mul)val-=Math.pow(2,8*byteLength)
return val}
Buffer.prototype.readIntBE=function readIntBE(offset,byteLength,noAssert){offset=offset>>>0
byteLength=byteLength>>>0
if(!noAssert)checkOffset(offset,byteLength,this.length)
var i=byteLength
var mul=1
var val=this[offset+--i]
while(i>0&&(mul*=0x100)){val+=this[offset+--i]*mul}
mul*=0x80
if(val>=mul)val-=Math.pow(2,8*byteLength)
return val}
Buffer.prototype.readInt8=function readInt8(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,1,this.length)
if(!(this[offset]&0x80))return(this[offset])
return((0xff-this[offset]+1)*-1)}
Buffer.prototype.readInt16LE=function readInt16LE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,2,this.length)
var val=this[offset]|(this[offset+1]<<8)
return(val&0x8000)?val|0xFFFF0000:val}
Buffer.prototype.readInt16BE=function readInt16BE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,2,this.length)
var val=this[offset+1]|(this[offset]<<8)
return(val&0x8000)?val|0xFFFF0000:val}
Buffer.prototype.readInt32LE=function readInt32LE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,4,this.length)
return(this[offset])|(this[offset+1]<<8)|(this[offset+2]<<16)|(this[offset+3]<<24)}
Buffer.prototype.readInt32BE=function readInt32BE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,4,this.length)
return(this[offset]<<24)|(this[offset+1]<<16)|(this[offset+2]<<8)|(this[offset+3])}
Buffer.prototype.readFloatLE=function readFloatLE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,4,this.length)
return ieee754.read(this,offset,true,23,4)}
Buffer.prototype.readFloatBE=function readFloatBE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,4,this.length)
return ieee754.read(this,offset,false,23,4)}
Buffer.prototype.readDoubleLE=function readDoubleLE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,8,this.length)
return ieee754.read(this,offset,true,52,8)}
Buffer.prototype.readDoubleBE=function readDoubleBE(offset,noAssert){offset=offset>>>0
if(!noAssert)checkOffset(offset,8,this.length)
return ieee754.read(this,offset,false,52,8)}
function checkInt(buf,value,offset,ext,max,min){if(!Buffer.isBuffer(buf))throw new TypeError('"buffer" argument must be a Buffer instance')
if(value>max||value<min)throw new RangeError('"value" argument is out of bounds')
if(offset+ext>buf.length)throw new RangeError('Index out of range')}
Buffer.prototype.writeUIntLE=function writeUIntLE(value,offset,byteLength,noAssert){value=+value
offset=offset>>>0
byteLength=byteLength>>>0
if(!noAssert){var maxBytes=Math.pow(2,8*byteLength)-1
checkInt(this,value,offset,byteLength,maxBytes,0)}
var mul=1
var i=0
this[offset]=value&0xFF
while(++i<byteLength&&(mul*=0x100)){this[offset+i]=(value/mul)&0xFF}
return offset+byteLength}
Buffer.prototype.writeUIntBE=function writeUIntBE(value,offset,byteLength,noAssert){value=+value
offset=offset>>>0
byteLength=byteLength>>>0
if(!noAssert){var maxBytes=Math.pow(2,8*byteLength)-1
checkInt(this,value,offset,byteLength,maxBytes,0)}
var i=byteLength-1
var mul=1
this[offset+i]=value&0xFF
while(--i>=0&&(mul*=0x100)){this[offset+i]=(value/mul)&0xFF}
return offset+byteLength}
Buffer.prototype.writeUInt8=function writeUInt8(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,1,0xff,0)
this[offset]=(value&0xff)
return offset+1}
Buffer.prototype.writeUInt16LE=function writeUInt16LE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,2,0xffff,0)
this[offset]=(value&0xff)
this[offset+1]=(value>>>8)
return offset+2}
Buffer.prototype.writeUInt16BE=function writeUInt16BE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,2,0xffff,0)
this[offset]=(value>>>8)
this[offset+1]=(value&0xff)
return offset+2}
Buffer.prototype.writeUInt32LE=function writeUInt32LE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,4,0xffffffff,0)
this[offset+3]=(value>>>24)
this[offset+2]=(value>>>16)
this[offset+1]=(value>>>8)
this[offset]=(value&0xff)
return offset+4}
Buffer.prototype.writeUInt32BE=function writeUInt32BE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,4,0xffffffff,0)
this[offset]=(value>>>24)
this[offset+1]=(value>>>16)
this[offset+2]=(value>>>8)
this[offset+3]=(value&0xff)
return offset+4}
Buffer.prototype.writeIntLE=function writeIntLE(value,offset,byteLength,noAssert){value=+value
offset=offset>>>0
if(!noAssert){var limit=Math.pow(2,(8*byteLength)-1)
checkInt(this,value,offset,byteLength,limit-1,-limit)}
var i=0
var mul=1
var sub=0
this[offset]=value&0xFF
while(++i<byteLength&&(mul*=0x100)){if(value<0&&sub===0&&this[offset+i-1]!==0){sub=1}
this[offset+i]=((value/mul)>>0)-sub&0xFF}
return offset+byteLength}
Buffer.prototype.writeIntBE=function writeIntBE(value,offset,byteLength,noAssert){value=+value
offset=offset>>>0
if(!noAssert){var limit=Math.pow(2,(8*byteLength)-1)
checkInt(this,value,offset,byteLength,limit-1,-limit)}
var i=byteLength-1
var mul=1
var sub=0
this[offset+i]=value&0xFF
while(--i>=0&&(mul*=0x100)){if(value<0&&sub===0&&this[offset+i+1]!==0){sub=1}
this[offset+i]=((value/mul)>>0)-sub&0xFF}
return offset+byteLength}
Buffer.prototype.writeInt8=function writeInt8(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,1,0x7f,-0x80)
if(value<0)value=0xff+value+1
this[offset]=(value&0xff)
return offset+1}
Buffer.prototype.writeInt16LE=function writeInt16LE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,2,0x7fff,-0x8000)
this[offset]=(value&0xff)
this[offset+1]=(value>>>8)
return offset+2}
Buffer.prototype.writeInt16BE=function writeInt16BE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,2,0x7fff,-0x8000)
this[offset]=(value>>>8)
this[offset+1]=(value&0xff)
return offset+2}
Buffer.prototype.writeInt32LE=function writeInt32LE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,4,0x7fffffff,-0x80000000)
this[offset]=(value&0xff)
this[offset+1]=(value>>>8)
this[offset+2]=(value>>>16)
this[offset+3]=(value>>>24)
return offset+4}
Buffer.prototype.writeInt32BE=function writeInt32BE(value,offset,noAssert){value=+value
offset=offset>>>0
if(!noAssert)checkInt(this,value,offset,4,0x7fffffff,-0x80000000)
if(value<0)value=0xffffffff+value+1
this[offset]=(value>>>24)
this[offset+1]=(value>>>16)
this[offset+2]=(value>>>8)
this[offset+3]=(value&0xff)
return offset+4}
function checkIEEE754(buf,value,offset,ext,max,min){if(offset+ext>buf.length)throw new RangeError('Index out of range')
if(offset<0)throw new RangeError('Index out of range')}
function writeFloat(buf,value,offset,littleEndian,noAssert){value=+value
offset=offset>>>0
if(!noAssert){checkIEEE754(buf,value,offset,4,3.4028234663852886e+38,-3.4028234663852886e+38)}
ieee754.write(buf,value,offset,littleEndian,23,4)
return offset+4}
Buffer.prototype.writeFloatLE=function writeFloatLE(value,offset,noAssert){return writeFloat(this,value,offset,true,noAssert)}
Buffer.prototype.writeFloatBE=function writeFloatBE(value,offset,noAssert){return writeFloat(this,value,offset,false,noAssert)}
function writeDouble(buf,value,offset,littleEndian,noAssert){value=+value
offset=offset>>>0
if(!noAssert){checkIEEE754(buf,value,offset,8,1.7976931348623157E+308,-1.7976931348623157E+308)}
ieee754.write(buf,value,offset,littleEndian,52,8)
return offset+8}
Buffer.prototype.writeDoubleLE=function writeDoubleLE(value,offset,noAssert){return writeDouble(this,value,offset,true,noAssert)}
Buffer.prototype.writeDoubleBE=function writeDoubleBE(value,offset,noAssert){return writeDouble(this,value,offset,false,noAssert)}
Buffer.prototype.copy=function copy(target,targetStart,start,end){if(!Buffer.isBuffer(target))throw new TypeError('argument should be a Buffer')
if(!start)start=0
if(!end&&end!==0)end=this.length
if(targetStart>=target.length)targetStart=target.length
if(!targetStart)targetStart=0
if(end>0&&end<start)end=start
if(end===start)return 0
if(target.length===0||this.length===0)return 0
if(targetStart<0){throw new RangeError('targetStart out of bounds')}
if(start<0||start>=this.length)throw new RangeError('Index out of range')
if(end<0)throw new RangeError('sourceEnd out of bounds')
if(end>this.length)end=this.length
if(target.length-targetStart<end-start){end=target.length-targetStart+start}
var len=end-start
if(this===target&&typeof Uint8Array.prototype.copyWithin==='function'){this.copyWithin(targetStart,start,end)}else if(this===target&&start<targetStart&&targetStart<end){for(var i=len-1;i>=0;--i){target[i+targetStart]=this[i+start]}}else{Uint8Array.prototype.set.call(target,this.subarray(start,end),targetStart)}
return len}
Buffer.prototype.fill=function fill(val,start,end,encoding){if(typeof val==='string'){if(typeof start==='string'){encoding=start
start=0
end=this.length}else if(typeof end==='string'){encoding=end
end=this.length}
if(encoding!==undefined&&typeof encoding!=='string'){throw new TypeError('encoding must be a string')}
if(typeof encoding==='string'&&!Buffer.isEncoding(encoding)){throw new TypeError('Unknown encoding: '+encoding)}
if(val.length===1){var code=val.charCodeAt(0)
if((encoding==='utf8'&&code<128)||encoding==='latin1'){val=code}}}else if(typeof val==='number'){val=val&255}
if(start<0||this.length<start||this.length<end){throw new RangeError('Out of range index')}
if(end<=start){return this}
start=start>>>0
end=end===undefined?this.length:end>>>0
if(!val)val=0
var i
if(typeof val==='number'){for(i=start;i<end;++i){this[i]=val}}else{var bytes=Buffer.isBuffer(val)?val:Buffer.from(val,encoding)
var len=bytes.length
if(len===0){throw new TypeError('The value "'+val+
'" is invalid for argument "value"')}
for(i=0;i<end-start;++i){this[i+start]=bytes[i%len]}}
return this}
var INVALID_BASE64_RE=/[^+/0-9A-Za-z-_]/g
function base64clean(str){str=str.split('=')[0]
str=str.trim().replace(INVALID_BASE64_RE,'')
if(str.length<2)return ''
while(str.length%4!==0){str=str+'='}
return str}
function toHex(n){if(n<16)return '0'+n.toString(16)
return n.toString(16)}
function utf8ToBytes(string,units){units=units||Infinity
var codePoint
var length=string.length
var leadSurrogate=null
var bytes=[]
for(var i=0;i<length;++i){codePoint=string.charCodeAt(i)
if(codePoint>0xD7FF&&codePoint<0xE000){if(!leadSurrogate){if(codePoint>0xDBFF){if((units-=3)>-1)bytes.push(0xEF,0xBF,0xBD)
continue}else if(i+1===length){if((units-=3)>-1)bytes.push(0xEF,0xBF,0xBD)
continue}
leadSurrogate=codePoint
continue}
if(codePoint<0xDC00){if((units-=3)>-1)bytes.push(0xEF,0xBF,0xBD)
leadSurrogate=codePoint
continue}
codePoint=(leadSurrogate-0xD800<<10|codePoint-0xDC00)+0x10000}else if(leadSurrogate){if((units-=3)>-1)bytes.push(0xEF,0xBF,0xBD)}
leadSurrogate=null
if(codePoint<0x80){if((units-=1)<0)break
bytes.push(codePoint)}else if(codePoint<0x800){if((units-=2)<0)break
bytes.push(codePoint>>0x6|0xC0,codePoint&0x3F|0x80)}else if(codePoint<0x10000){if((units-=3)<0)break
bytes.push(codePoint>>0xC|0xE0,codePoint>>0x6&0x3F|0x80,codePoint&0x3F|0x80)}else if(codePoint<0x110000){if((units-=4)<0)break
bytes.push(codePoint>>0x12|0xF0,codePoint>>0xC&0x3F|0x80,codePoint>>0x6&0x3F|0x80,codePoint&0x3F|0x80)}else{throw new Error('Invalid code point')}}
return bytes}
function asciiToBytes(str){var byteArray=[]
for(var i=0;i<str.length;++i){byteArray.push(str.charCodeAt(i)&0xFF)}
return byteArray}
function utf16leToBytes(str,units){var c,hi,lo
var byteArray=[]
for(var i=0;i<str.length;++i){if((units-=2)<0)break
c=str.charCodeAt(i)
hi=c>>8
lo=c%256
byteArray.push(lo)
byteArray.push(hi)}
return byteArray}
function base64ToBytes(str){return base64.toByteArray(base64clean(str))}
function blitBuffer(src,dst,offset,length){for(var i=0;i<length;++i){if((i+offset>=dst.length)||(i>=src.length))break
dst[i+offset]=src[i]}
return i}
function isInstance(obj,type){return obj instanceof type||(obj!=null&&obj.constructor!=null&&obj.constructor.name!=null&&obj.constructor.name===type.name)}
function numberIsNaN(obj){return obj!==obj}}).call(this)}).call(this,require("buffer").Buffer)},{"base64-js":10,"buffer":"buffer","ieee754":19}],"debug":[function(require,module,exports){(function(process){(function(){exports.formatArgs=formatArgs;exports.save=save;exports.load=load;exports.useColors=useColors;exports.storage=localstorage();exports.destroy=(()=>{let warned=false;return()=>{if(!warned){warned=true;console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');}};})();exports.colors=['#0000CC','#0000FF','#0033CC','#0033FF','#0066CC','#0066FF','#0099CC','#0099FF','#00CC00','#00CC33','#00CC66','#00CC99','#00CCCC','#00CCFF','#3300CC','#3300FF','#3333CC','#3333FF','#3366CC','#3366FF','#3399CC','#3399FF','#33CC00','#33CC33','#33CC66','#33CC99','#33CCCC','#33CCFF','#6600CC','#6600FF','#6633CC','#6633FF','#66CC00','#66CC33','#9900CC','#9900FF','#9933CC','#9933FF','#99CC00','#99CC33','#CC0000','#CC0033','#CC0066','#CC0099','#CC00CC','#CC00FF','#CC3300','#CC3333','#CC3366','#CC3399','#CC33CC','#CC33FF','#CC6600','#CC6633','#CC9900','#CC9933','#CCCC00','#CCCC33','#FF0000','#FF0033','#FF0066','#FF0099','#FF00CC','#FF00FF','#FF3300','#FF3333','#FF3366','#FF3399','#FF33CC','#FF33FF','#FF6600','#FF6633','#FF9900','#FF9933','#FFCC00','#FFCC33'];function useColors(){if(typeof window!=='undefined'&&window.process&&(window.process.type==='renderer'||window.process.__nwjs)){return true;}
if(typeof navigator!=='undefined'&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)){return false;}
return(typeof document!=='undefined'&&document.documentElement&&document.documentElement.style&&document.documentElement.style.WebkitAppearance)||(typeof window!=='undefined'&&window.console&&(window.console.firebug||(window.console.exception&&window.console.table)))||(typeof navigator!=='undefined'&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)&&parseInt(RegExp.$1,10)>=31)||(typeof navigator!=='undefined'&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));}
function formatArgs(args){args[0]=(this.useColors?'%c':'')+
this.namespace+
(this.useColors?' %c':' ')+
args[0]+
(this.useColors?'%c ':' ')+
'+'+module.exports.humanize(this.diff);if(!this.useColors){return;}
const c='color: '+this.color;args.splice(1,0,c,'color: inherit');let index=0;let lastC=0;args[0].replace(/%[a-zA-Z%]/g,match=>{if(match==='%%'){return;}
index++;if(match==='%c'){lastC=index;}});args.splice(lastC,0,c);}
exports.log=console.debug||console.log||(()=>{});function save(namespaces){try{if(namespaces){exports.storage.setItem('debug',namespaces);}else{exports.storage.removeItem('debug');}}catch(error){}}
function load(){let r;try{r=exports.storage.getItem('debug');}catch(error){}
if(!r&&typeof process!=='undefined'&&'env'in process){r=process.env.DEBUG;}
return r;}
function localstorage(){try{return localStorage;}catch(error){}}
module.exports=require('./common')(exports);const{formatters}=module.exports;formatters.j=function(v){try{return JSON.stringify(v);}catch(error){return '[UnexpectedJSONParseError]: '+error.message;}};}).call(this)}).call(this,require('_process'))},{"./common":16,"_process":23}],"events":[function(require,module,exports){'use strict';var R=typeof Reflect==='object'?Reflect:null
var ReflectApply=R&&typeof R.apply==='function'?R.apply:function ReflectApply(target,receiver,args){return Function.prototype.apply.call(target,receiver,args);}
var ReflectOwnKeys
if(R&&typeof R.ownKeys==='function'){ReflectOwnKeys=R.ownKeys}else if(Object.getOwnPropertySymbols){ReflectOwnKeys=function ReflectOwnKeys(target){return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target));};}else{ReflectOwnKeys=function ReflectOwnKeys(target){return Object.getOwnPropertyNames(target);};}
function ProcessEmitWarning(warning){if(console&&console.warn)console.warn(warning);}
var NumberIsNaN=Number.isNaN||function NumberIsNaN(value){return value!==value;}
function EventEmitter(){EventEmitter.init.call(this);}
module.exports=EventEmitter;module.exports.once=once;EventEmitter.EventEmitter=EventEmitter;EventEmitter.prototype._events=undefined;EventEmitter.prototype._eventsCount=0;EventEmitter.prototype._maxListeners=undefined;var defaultMaxListeners=10;function checkListener(listener){if(typeof listener!=='function'){throw new TypeError('The "listener" argument must be of type Function. Received type '+typeof listener);}}
Object.defineProperty(EventEmitter,'defaultMaxListeners',{enumerable:true,get:function(){return defaultMaxListeners;},set:function(arg){if(typeof arg!=='number'||arg<0||NumberIsNaN(arg)){throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received '+arg+'.');}
defaultMaxListeners=arg;}});EventEmitter.init=function(){if(this._events===undefined||this._events===Object.getPrototypeOf(this)._events){this._events=Object.create(null);this._eventsCount=0;}
this._maxListeners=this._maxListeners||undefined;};EventEmitter.prototype.setMaxListeners=function setMaxListeners(n){if(typeof n!=='number'||n<0||NumberIsNaN(n)){throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received '+n+'.');}
this._maxListeners=n;return this;};function _getMaxListeners(that){if(that._maxListeners===undefined)
return EventEmitter.defaultMaxListeners;return that._maxListeners;}
EventEmitter.prototype.getMaxListeners=function getMaxListeners(){return _getMaxListeners(this);};EventEmitter.prototype.emit=function emit(type){var args=[];for(var i=1;i<arguments.length;i++)args.push(arguments[i]);var doError=(type==='error');var events=this._events;if(events!==undefined)
doError=(doError&&events.error===undefined);else if(!doError)
return false;if(doError){var er;if(args.length>0)
er=args[0];if(er instanceof Error){throw er;}
var err=new Error('Unhandled error.'+(er?' ('+er.message+')':''));err.context=er;throw err;}
var handler=events[type];if(handler===undefined)
return false;if(typeof handler==='function'){ReflectApply(handler,this,args);}else{var len=handler.length;var listeners=arrayClone(handler,len);for(var i=0;i<len;++i)
ReflectApply(listeners[i],this,args);}
return true;};function _addListener(target,type,listener,prepend){var m;var events;var existing;checkListener(listener);events=target._events;if(events===undefined){events=target._events=Object.create(null);target._eventsCount=0;}else{if(events.newListener!==undefined){target.emit('newListener',type,listener.listener?listener.listener:listener);events=target._events;}
existing=events[type];}
if(existing===undefined){existing=events[type]=listener;++target._eventsCount;}else{if(typeof existing==='function'){existing=events[type]=prepend?[listener,existing]:[existing,listener];}else if(prepend){existing.unshift(listener);}else{existing.push(listener);}
m=_getMaxListeners(target);if(m>0&&existing.length>m&&!existing.warned){existing.warned=true;var w=new Error('Possible EventEmitter memory leak detected. '+
existing.length+' '+String(type)+' listeners '+
'added. Use emitter.setMaxListeners() to '+
'increase limit');w.name='MaxListenersExceededWarning';w.emitter=target;w.type=type;w.count=existing.length;ProcessEmitWarning(w);}}
return target;}
EventEmitter.prototype.addListener=function addListener(type,listener){return _addListener(this,type,listener,false);};EventEmitter.prototype.on=EventEmitter.prototype.addListener;EventEmitter.prototype.prependListener=function prependListener(type,listener){return _addListener(this,type,listener,true);};function onceWrapper(){if(!this.fired){this.target.removeListener(this.type,this.wrapFn);this.fired=true;if(arguments.length===0)
return this.listener.call(this.target);return this.listener.apply(this.target,arguments);}}
function _onceWrap(target,type,listener){var state={fired:false,wrapFn:undefined,target:target,type:type,listener:listener};var wrapped=onceWrapper.bind(state);wrapped.listener=listener;state.wrapFn=wrapped;return wrapped;}
EventEmitter.prototype.once=function once(type,listener){checkListener(listener);this.on(type,_onceWrap(this,type,listener));return this;};EventEmitter.prototype.prependOnceListener=function prependOnceListener(type,listener){checkListener(listener);this.prependListener(type,_onceWrap(this,type,listener));return this;};EventEmitter.prototype.removeListener=function removeListener(type,listener){var list,events,position,i,originalListener;checkListener(listener);events=this._events;if(events===undefined)
return this;list=events[type];if(list===undefined)
return this;if(list===listener||list.listener===listener){if(--this._eventsCount===0)
this._events=Object.create(null);else{delete events[type];if(events.removeListener)
this.emit('removeListener',type,list.listener||listener);}}else if(typeof list!=='function'){position=-1;for(i=list.length-1;i>=0;i--){if(list[i]===listener||list[i].listener===listener){originalListener=list[i].listener;position=i;break;}}
if(position<0)
return this;if(position===0)
list.shift();else{spliceOne(list,position);}
if(list.length===1)
events[type]=list[0];if(events.removeListener!==undefined)
this.emit('removeListener',type,originalListener||listener);}
return this;};EventEmitter.prototype.off=EventEmitter.prototype.removeListener;EventEmitter.prototype.removeAllListeners=function removeAllListeners(type){var listeners,events,i;events=this._events;if(events===undefined)
return this;if(events.removeListener===undefined){if(arguments.length===0){this._events=Object.create(null);this._eventsCount=0;}else if(events[type]!==undefined){if(--this._eventsCount===0)
this._events=Object.create(null);else
delete events[type];}
return this;}
if(arguments.length===0){var keys=Object.keys(events);var key;for(i=0;i<keys.length;++i){key=keys[i];if(key==='removeListener')continue;this.removeAllListeners(key);}
this.removeAllListeners('removeListener');this._events=Object.create(null);this._eventsCount=0;return this;}
listeners=events[type];if(typeof listeners==='function'){this.removeListener(type,listeners);}else if(listeners!==undefined){for(i=listeners.length-1;i>=0;i--){this.removeListener(type,listeners[i]);}}
return this;};function _listeners(target,type,unwrap){var events=target._events;if(events===undefined)
return[];var evlistener=events[type];if(evlistener===undefined)
return[];if(typeof evlistener==='function')
return unwrap?[evlistener.listener||evlistener]:[evlistener];return unwrap?unwrapListeners(evlistener):arrayClone(evlistener,evlistener.length);}
EventEmitter.prototype.listeners=function listeners(type){return _listeners(this,type,true);};EventEmitter.prototype.rawListeners=function rawListeners(type){return _listeners(this,type,false);};EventEmitter.listenerCount=function(emitter,type){if(typeof emitter.listenerCount==='function'){return emitter.listenerCount(type);}else{return listenerCount.call(emitter,type);}};EventEmitter.prototype.listenerCount=listenerCount;function listenerCount(type){var events=this._events;if(events!==undefined){var evlistener=events[type];if(typeof evlistener==='function'){return 1;}else if(evlistener!==undefined){return evlistener.length;}}
return 0;}
EventEmitter.prototype.eventNames=function eventNames(){return this._eventsCount>0?ReflectOwnKeys(this._events):[];};function arrayClone(arr,n){var copy=new Array(n);for(var i=0;i<n;++i)
copy[i]=arr[i];return copy;}
function spliceOne(list,index){for(;index+1<list.length;index++)
list[index]=list[index+1];list.pop();}
function unwrapListeners(arr){var ret=new Array(arr.length);for(var i=0;i<ret.length;++i){ret[i]=arr[i].listener||arr[i];}
return ret;}
function once(emitter,name){return new Promise(function(resolve,reject){function errorListener(err){emitter.removeListener(name,resolver);reject(err);}
function resolver(){if(typeof emitter.removeListener==='function'){emitter.removeListener('error',errorListener);}
resolve([].slice.call(arguments));};eventTargetAgnosticAddListener(emitter,name,resolver,{once:true});if(name!=='error'){addErrorHandlerIfEventEmitter(emitter,errorListener,{once:true});}});}
function addErrorHandlerIfEventEmitter(emitter,handler,flags){if(typeof emitter.on==='function'){eventTargetAgnosticAddListener(emitter,'error',handler,flags);}}
function eventTargetAgnosticAddListener(emitter,name,listener,flags){if(typeof emitter.on==='function'){if(flags.once){emitter.once(name,listener);}else{emitter.on(name,listener);}}else if(typeof emitter.addEventListener==='function'){emitter.addEventListener(name,function wrapListener(arg){if(flags.once){emitter.removeEventListener(name,wrapListener);}
listener(arg);});}else{throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type '+typeof emitter);}}},{}],"p2p-media-loader-core":[function(require,module,exports){"use strict";var __createBinding=(this&&this.__createBinding)||(Object.create?(function(o,m,k,k2){if(k2===undefined)k2=k;Object.defineProperty(o,k2,{enumerable:true,get:function(){return m[k];}});}):(function(o,m,k,k2){if(k2===undefined)k2=k;o[k2]=m[k];}));var __exportStar=(this&&this.__exportStar)||function(m,exports){for(var p in m)if(p!=="default"&&!Object.prototype.hasOwnProperty.call(exports,p))__createBinding(exports,m,p);};Object.defineProperty(exports,"__esModule",{value:true});exports.version=void 0;exports.version="0.6.2";__exportStar(require("./loader-interface"),exports);__exportStar(require("./hybrid-loader"),exports);},{"./hybrid-loader":4,"./loader-interface":5}]},{},[2]);