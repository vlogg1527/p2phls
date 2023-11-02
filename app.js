	
var md = new MobileDetect(window.navigator.userAgent);
// Opera 8.0+
var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
// Firefox 1.0+
var isFirefox = typeof InstallTrigger !== 'undefined';
// Safari 3.0+ "[object HTMLElementConstructor]" 
var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && window['safari'].pushNotification));
// Internet Explorer 6-11
var isIE = /*@cc_on!@*/false || !!document.documentMode;
// Edge 20+
var isEdge = !isIE && !!window.StyleMedia;
// Chrome 1 - 79
var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

var p2pactive = true;
var debugenable = false;
var consumeOnly = false;
var maxsend = 100;

if (/*md.os() == 'AndroidOS' || */ md.is('iPad') || isOpera || isFirefox || isIE || isEdge || isChrome || isSafari)
	p2pactive = true;	


var p2pdisable = false;	

	
if (md.tablet())	
	p2pactive = true;	
	


if (/*md.os() == 'webOS' || */ navigator.userAgent.search(/(lg|LG|sony|samsung|SONY|TV|SmartTV|SMART-TV|Tizen(.*TV))/i) >= 0) {
	p2pactive = false;
	p2pdisable = true;
}
	
    function waitForGlobalObject(objectName, objectNextName) {
        return new Promise((resolve) => {
            function check() {
                if ((window[objectName] !== undefined)
                        && ((objectNextName === undefined) || window[objectName][objectNextName] !== undefined)) {
                    resolve();
                } else {
                    setTimeout(check, 200);
                }
            }

            check();
        });
    }

    function waitForModule(moduleName) {
        return new Promise((resolve) => {
            function check() {
                try {
                    resolve(require(moduleName));
                } catch (e) {
                    setTimeout(check, 200);
                }
            }

            check();
        });
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script= document.createElement('script');
            script.type= 'text/javascript';
            script.onload = () => {
                resolve();
            };
            script.onerror = () => {
                console.log("Failed to load script", src);
                reject();
            };
            script.src = src;
            document.head.appendChild(script);
        });
    }
	


    function loadStyle(src) {
        return new Promise((resolve, reject) => {
            const link= document.createElement('link');
            link.rel = 'stylesheet';
            link.type= 'text/css';
            link.onload = () => {
                resolve();
            };
            link.onerror = () => {
                console.log("Failed to load CSS", src);
                reject();
            };
            link.href = src;
            document.head.appendChild(link);
        });
    }

    class player123 {
        async init() {
            await waitForGlobalObject("p2pml", "core");

            this.isP2PSupported = p2pml.core.HybridLoader.isSupported();
            if (!this.isP2PSupported) {
                document.querySelector("#error-webrtc-data-channels").classList.remove("hide");
            }



            this.liveSyncDurationCount = 7;

            this.initForm();

            this.videoContainer = document.getElementById("video_container");

            this.loadSpeedTimespan = 10; // seconds

			if (p2pactive && debugenable) {
				const P2PGraphClass = await waitForModule("p2p-graph");
				this.graph = new P2PGraphClass("#graph");
				this.graph.add({ id: "me", name: "You", me: true });
				await waitForGlobalObject("Rickshaw");
				this.initChart();
			}
            this.Restart_Player();
			
        }

        initForm() {
			if (!p2pactive && debugenable)
				return;
            var form = document.getElementById("videoUrlForm");
            var params = new URLSearchParams(document.location.search);

          
        }

        async Restart_Player() { 
        

       
            const config = {
                segments: {
                    forwardSegmentCount: 50
                },
                loader: {
            cachedSegmentExpiration: 864e5,
            cachedSegmentsCount: 1e3,
            requiredSegmentsPriority: window.segmentPerRequest || 10,
            httpDownloadMaxPriority: 9,
            httpDownloadProbability: .06,
            httpDownloadProbabilityInterval: 1e3,
            httpDownloadProbabilitySkipIfNoPeers: !0,
            p2pDownloadMaxPriority: 50,
            httpFailedSegmentTimeout: 1e3,
            simultaneousP2PDownloads: 20,
            simultaneousHttpDownloads: 3,
            requestTimeOut: 5e3,
            rtcConfig: {
            iceServers: [{
                urls: "stun:stun2.l.google.com:19302"
            }, {
                urls: "stun:stun3.l.google.com:19302"
            }, {
                urls: "stun:stun4.l.google.com:19302"
            }]
        }
                }
            };
			
			config.loader.trackerAnnounce = trackerAnnounce;
   
				await loadScript("https://cdn.jsdelivr.net/gh/vlogg1527/p2phls@main/hlsv1.js"); 
								
				await loadScript(URL_P2P_MEDIA_LOADER_HLSJS);
				this.engine = this.isP2PSupported ? new p2pml.hlsjs.Engine(config) : undefined;

				this.initJwPlayer();
        }
		


        async initJwPlayer() {
            var video = document.createElement("div");
            video.id = "video";
            video.volume = 0;
            video.setAttribute("playsinline", "");
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            this.videoContainer.appendChild(video);

			if(!md.is('iPad') && md.mobile() ) {
				await loadScript("https://content.jwplatform.com/libraries/foHt6P0J.js")
				await loadScript("https://cdn.jsdelivr.net/npm/@hola.org/jwplayer-hlsjs@latest/dist/jwplayer.hlsjs.min.js")
			} else if(!md.is('iPad') ) {
				await loadScript("https://content.jwplatform.com/libraries/foHt6P0J.js")
                await loadScript("https://cdn.jsdelivr.net/npm/@hola.org/jwplayer-hlsjs@latest/dist/jwplayer.hlsjs.min.js")
			} else {
                await loadScript("https://content.jwplatform.com/libraries/foHt6P0J.js")
			}

            var player = jwplayer("video");
			var json = {
				"sources": [
					{
						"type": "hls",
						"file": m3u8
					}
				],
				"playbackRateControls": true,
				"mute": false,
				"autostart": "false",
				"preload": "none",
				"cast": {"appid": "00000000"},
				"base": ".",
				"volume": 100,
				"key": "ITWMv7t88JGzI0xPwW8I0+LveiXX9SWbfdmt0ArUSyc=",
				"image": image,
				androidhls: true,


			}			
            player.setup(json);
			if (p2pdisable != true ) {
				jwplayer_hls_provider.attach();	
			}

	
            if (this.isP2PSupported && p2pactive == true) {
                p2pml.hlsjs.initJwPlayer(player, {
                    liveSyncDurationCount: this.liveSyncDurationCount,
                    loader: this.engine.createLoaderClass()
                });
            }
        }
		
	
    }	

    const P2PPlayer = new player123();
    P2PPlayer.init();
	
	
   function sleep(milliseconds) {  
      return new Promise(resolve => setTimeout(resolve, milliseconds));  
   }
