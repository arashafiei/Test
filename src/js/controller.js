(function() {
    const prefix = ['','moz', 'webkit', 'ms'].find((p) => !p ? ('fullscreenElement' in document) : (p + 'FullScreenElement' in document));

    const fullScreen = {
        state: (elem)  => document[prefix?(prefix+'FullScreenElement'):'fullscreenElement'] === elem,
        request: (elem) => elem[prefix?(prefix+'RequestFullscreen'):'requestFullscreen'](),
        toggle: (elem) => fullScreen.state(elem) ? fullScreen.exit(elem) : fullScreen.request(elem),
        exit: (elem) => document[prefix?(prefix+'ExitFullscreen'):'exitFullscreen']()
    };

    const timeCalc = function(time) {
        let seconds = Math.floor(time);
        return (seconds < 10) ? ("0:0" + seconds) :
            (seconds < 60) ? ('0:' + seconds) :
                (seconds === 60) ? "1:00" :
                    (( Math.floor(seconds/60) + ":" + (seconds%60 < 10 ? "0" : "") +  + seconds%60));
    };

    class Playa {
        constructor(elem) {
            return new defaultPlayer(elem);
        }
    }

    class defaultPlayer {
        constructor(video) {

            let video_old = video;
            this.video = video_old.cloneNode(true);

            if (this.video.preload === "none" || this.video.getAttribute("preload") === null) {
                this.video.preload = "metadata";
            }
            // create wrappers and controls
            this.controls = {};
            this.timer = {};
            this.timer.flag = this._createElement("div", {className: "timer-flag"});
            this.timer.counter = this._createElement("span", {className: "counter"});
            this.track = {};
            this.track.loadedbar = this._createElement("canvas", {className: "track-loader-bar"});
            this.track.picker = this._createElement("span", {});
            this.track.circle = this._createElement("span", {className: "track-circle"});
            this.track.bar = this._createElement("div", {className: "track-bar"}, [this.track.picker, this.track.circle]);
            this.track.inner = this._createElement("div", {className: "track-inner"}, [this.track.loadedbar, this.track.bar, this.timer.flag]);
            this.track.track = this._createElement("div", {className: "track"}, [this.track.inner]);
            this.volume = {};
            this.volume.muteButton = this._createElement("i", {className: "mute-button icon"});
            this.volume.button = this._createElement("input", {className: "volume-button", type: "range"});
            this.volume.container = this._createElement("span", {className: "volume-container"}, [this.volume.button, this.volume.muteButton]);
            this.fullscreenButton = this._createElement("i", {className: "fullscreen-button icon"});
            this.skipToTime = (video.getAttribute('time') || video.getAttribute('date-time'));
            this.HD = {};
            this.HD.button = this._createElement("i", {className: "hd-button icon"});
            this.HD.menu = this._createElement("ul", {className: "hd-menu"});
            this.HD.selectedQuality = this._createElement("span", {className: "selected-quality"});
            this.HD.wrapper = this._createElement("div", {className: "hd-wrapper"}, [this.HD.button, this.HD.menu, this.HD.selectedQuality]);

            this.playPauseButton = this._createElement("i", {className: "play-button icon"});

            this.ct = this._createElement("div", {className: "button-bar"}, [this.timer.counter,
                this.HD.wrapper,
                this.playPauseButton,
                this.volume.container,
                this.fullscreenButton]);

            this.controls.bottomtray = this._createElement("div", {className: "controls-bottom-tray"}, [
                this.track.track,
                this.ct
            ]);
            this.controls.wrapper = this._createElement("div", {className: "controls-wrapper invisible"}, [
                this.controls.bottomtray
            ]);
            this.wrapper = this._createElement("div", {className: "responsive-video"}, [this.video, this.controls.wrapper]);
            const addDisableClass = this._debounce(() => {
                this.controls.wrapper.classList.add("disable")
            });

            this.lastWatchTime = null;

            video_old.parentNode.replaceChild(this.wrapper, video_old);

            if (this.video.autoplay) {
                this.playToggle();
            }

            document.addEventListener("keydown", (evt) => {
                if (document.activeElement === this.video && evt.which === 32) {
                    evt.preventDefault();
                    this.playToggle();
                }
            })

            this.controls.wrapper.addEventListener("mousemove", (evt) => {
                this.controls.wrapper.classList.remove("disable")
                if (fullScreen.state(this.wrapper))
                    addDisableClass()
            });

            this.video.setAttribute("tabindex", 0);

            this.video.addEventListener("loadeddata", (evt) => {

                const ratio = (this.video.videoHeight / this.video.videoWidth);
                this.wrapper.classList.add("loaded");
                this.wrapper.style.paddingTop = (ratio * 100) + "%";

                this.controls.wrapper.classList.remove("invisible")
                this.timer.counter.innerHTML = timeCalc(0) + "/" + timeCalc(this.video.duration);

                if ( this.skipToTime ) {
                    this.video.currentTime = this.skipToTime;
                    this.track.bar.style.width = (this.skipToTime/this.video.duration)*100 + "%";
                    this.track.circle.style.left = this.track.bar.style.width;

                }

                if (this.lastWatchTime) {
                    this.video.currentTime = this.lastWatchTime;
                    this.track.bar.style.width = (this.lastWatchTime/this.video.duration)*100 + "%";
                    this.track.circle.style.left = this.track.bar.style.width
                    this.lastWatchTime = null;
                    this.video.play();
                }

                // todo check video sources
                // let videoSources = this.video.querySelectorAll('source[src$="'+this.video.currentSrc.split(".").pop()+'"]');
                // if (videoSources.length) {
                //     let currentVideoSource = this.video.querySelector('source[src="'+this.video.currentSrc+'"]');
                //     this.wrapper.style.setProperty('--quality', currentVideoSource.getAttribute("size"));
                //
                //     this.HD.menu.innerHTML = "";
                //     videoSources.forEach((source) => {
                //         let li = document.createElement('li');
                //         li.innerText = source.getAttribute("size");
                //         li.addEventListener("click", () => {
                //             this.lastWatchTime = this.video.currentTime;
                //             this.video.setAttribute("src", source.getAttribute("src"));
                //             //this.wrapper.style.setProperty('--quality', source.getAttribute("size"));
                //         });
                //         this.HD.menu.appendChild(li);
                //     });
                // }

                // todo check textTrack
                // const textTrack = Array.from(this.video.textTracks).find((track) => track.mode === "showing");
                // if (textTrack) {
                //     console.log(textTrack, textTrack.cues)
                //     //textTrack.mode = 'hidden';
                //     textTrack.oncuechange = function(e) { console.log("pp")
                //         var cue = this.activeCues[0];
                //         if (cue) {
                //             //span.innerHTML = '';
                //             //span.appendChild(cue.getCueAsHTML());
                //             console.log(cue.getCueAsHTML());
                //         }
                //     }
                // }

            });

            this.track.inner.addEventListener("mousemove", (evt) => {
                let seek = (evt.offsetX / this.track.inner.clientWidth) * this.video.duration;
                this.timer.flag.innerHTML = timeCalc(seek);
                this.timer.flag.style.left = evt.offsetX + "px";
                this.track.picker.style.left = evt.offsetX + "px";
            });

            this.track.picker.addEventListener("mousemove", (evt) => {
                evt.stopPropagation();
            });

            this.track.picker.addEventListener("click", (evt) => {
                evt.stopPropagation();
                let percentage = (parseInt(this.track.picker.style.left.replace("px", ""))
                    / this.track.inner.clientWidth);
                let seek = percentage * this.video.duration;
                this.track.bar.style.width = 100 * percentage + "%";
                this.track.circle.style.left = this.track.bar.style.width;
                this.timer.counter.innerHTML = timeCalc(seek) + "/" + timeCalc(this.video.duration);
                this.video.currentTime = seek;
            });

            this.playPauseButton.addEventListener("click", () => {
                this.playToggle();
            });

            this.video.addEventListener("progress", () => {
                if (this.video.duration) {
                    this._drawProgress(this.track.loadedbar, this.video.buffered, this.video.duration);
                }
            });

            this.video.addEventListener("timeupdate", () => this._timerWatch());

            this.video.addEventListener("play", () => {
                this.video.classList.add("playing");
            });

            this.video.addEventListener("pause", () => {
                this.video.classList.remove("playing");
            });

            this.video.addEventListener("ended", () => {
                this.track.bar.style.width = "100%";
                this.track.circle.style.left = this.track.bar.style.width;
                this.timer.counter.innerHTML = parseFloat(this.video.duration);
            });

            this.track.inner.addEventListener("click", (evt) => {
                let percentage = (evt.offsetX / this.track.inner.clientWidth);
                let seek = percentage * this.video.duration;

                this.track.bar.style.width = 100 * percentage + "%";
                this.track.circle.style.left = this.track.bar.style.width;
                this.timer.counter.innerHTML = timeCalc(seek) + "/" + timeCalc(this.video.duration);
                this.video.currentTime = seek;
            });

            this.fullscreenButton.addEventListener("click", (evt) => {
                evt.stopPropagation();
                if (fullScreen.state(this.wrapper)) {
                    this.fullscreenButton.classList.remove("active")
                } else {
                    this.fullscreenButton.classList.add("active")
                }
                fullScreen.toggle(this.wrapper);
            });

            this.volume.muteButton.addEventListener("click", () => {
                this.video.muted = !this.video.muted;
                if (this.video.muted) {
                    this.volume.muteButton.setAttribute("active", "");
                } else {
                    this.volume.muteButton.removeAttribute("active");
                }
            });

            this.volume.button.addEventListener("input", () => {
                this.video.volume = this.volume.button.value / 100;
                this.wrapper.style.setProperty('--volume', this.value + "%");
            });

            this.HD.button.addEventListener("click", () => {
                this.HD.wrapper.classList.toggle("active");
            });

            this.HD.button.addEventListener("mousemove", () => {
                this.HD.wrapper.classList.add("active");
            });

            this.HD.menu.addEventListener("mouseleave", () => {
                this.HD.wrapper.classList.remove("active");
            });

            this.HD.wrapper.addEventListener("mouseleave", () => {
                this.HD.wrapper.classList.remove("active");
            });

            this.HD.wrapper.addEventListener("mouseenter", () => {
                this.HD.wrapper.classList.add("active");
            });

            this.controls.wrapper.addEventListener("click", (evt) => {
                this.playToggle();
            });

            this.controls.bottomtray.addEventListener("click", function (evt) {
                evt.stopPropagation();
            });

            this.video.volume = .5;
            this.volume.button.value = 50;
            this.wrapper.style.setProperty('--volume', "50%");
        }

        _timerWatch() {
            if (!this.video.paused) {
                let percentage = (this.video.currentTime / this.video.duration) * 100;
                this.video.parentNode.querySelector(".track-bar").style.width = percentage + "%";
                this.video.parentNode.querySelector(".track-circle").style.left = this.video.parentNode.querySelector(".track-bar").style.width;
                this.video.parentNode.querySelector(".counter").innerHTML = 	timeCalc(this.video.currentTime) + "/" + timeCalc(this.video.duration);
            }
        }

        _createElement(tag, attrs, content) {
            let el = document.createElement(tag);
            if (attrs) { Object.keys(attrs).forEach((attr) => el.setAttribute(attr==="className"?"class":attr, attrs[attr])); }
            if (content) {
                if (Array.isArray(content)) {
                    content.forEach((item) => el.appendChild(item));
                } else {
                    el.innerHTML = content;
                }
            }

            return el;
        }

        _debounce(func, timeout = 2000) {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    func.apply(this, args);
                }, timeout);
            };
        }

        _drawProgress(canvas, buffered, duration) {
            const context = canvas.getContext('2d', {antialias: false});
            context.fillStyle = '#F464534C';

            const width = canvas.width;
            const height = canvas.height;
            if (!width || !height) throw "Canvas's width or height weren't set!";
            context.clearRect(0, 0, width, height); // clear canvas

            for (let i = 0; i < buffered.length; i++) {
                const leadingEdge = buffered.start(i) / duration * width;
                const trailingEdge = buffered.end(i) / duration * width;
                context.fillRect(leadingEdge, 0, trailingEdge - leadingEdge, height);
            }
        }

        playToggle() {
            if (this.video.paused) {
                this.video.classList.add("playing");
                this.video.play();

                if (this.video.preload !== "auto") {
                    this.video.preload = "auto";
                }

                this.video.focus();
            } else {
                this.video.classList.remove("playing");
                this.video.pause();
            }
        }

    }
    if(typeof module !== 'undefined') {
        module.exports = Playa;
    }
    window.Playa = Playa;
})();
