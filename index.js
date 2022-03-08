(function () {
// Check that browser has support for media codec
    const afterBufferSecond = 20;
    const beforeBufferSecond = 10;
    let requestsList = [];
    const parser = new DOMParser();
    const loadingOverlay = document.getElementById("loading");
    let mimeCodec = 'video/mp4; codecs="avc1.64001f"';
    let token = "ed24e37c7ee84313acf2805a80122f94";
    let hashfile = "AW3S5UBDAOMZMN2C";
    let baseUrl = "http://offline-stream.pod.ir";
    let mediaSource;
    let video;
    let totalSegmentCount = 0;
    let segmentDuration = 0;
    let consumeLink = '';
    let produceLink = '';
    let currentSegment = -1;
    let pause = false;
    let sourceBuffer;
    let requiredQuality = 720;
    let fetchingIntervalStart = null;
    let currentRequestNumber = 0;
    const maxRequestNumber = 10;
    let seekingSetTimeout = null;
    const controller = new Playa(document.querySelector('video'));

    $(document).ajaxSend(function (event, jqXHR, ajaxOptions) {
        jqXHR.setRequestHeader("_token_", token);
    });

    function setLoading(showLoading) {
        if (showLoading) {
            loadingOverlay.classList.remove("hidden");
        } else {
            loadingOverlay.classList.add("hidden");
        }
    }

    function setHashFileAndPlayFile(hashfile) {
        document.getElementById("main-server").checked = true;
        document.querySelector("input[id=hashfile]").value = hashfile;
        resetParameters();
        startPlayingVideo(true);
    }

    function resetParameters() {
        currentRequestNumber = 0;
        totalSegmentCount = 0;
        segmentDuration = 0;
        consumeLink = "";
        produceLink = "";
        currentSegment = -1;
        pause = false;
        if (fetchingIntervalStart != null) {
            clearInterval(fetchingIntervalStart);
            fetchingIntervalStart = null;
        }
        if (seekingSetTimeout != null) {
            clearTimeout(seekingSetTimeout);
            seekingSetTimeout = null;
        }
    }

    function startPlayingVideo(callRegister) {
        baseUrl = document.querySelectorAll("input[name=server]:checked")[0].value;
        if (document.querySelector("input[id=token]").value) {
            token = document.querySelector("input[id=token]").value;
        } else {
            token = "ed24e37c7ee84313acf2805a80122f94";
        }
        if (document.querySelector("input[id=hashfile]").value) {
            hashfile = document.querySelector("input[id=hashfile]").value;
        } else {
            document.querySelector("input[id=hashfile]").value = "AW3S5UBDAOMZMN2C";
            hashfile = "AW3S5UBDAOMZMN2C";
        }

        requiredQuality = $("#quality").val()

        console.clear();
        // Create Media Source
        mediaSource = new MediaSource(); // mediaSource.readyState === 'closed'
        // Get video element
        video = document.querySelector("video");
        // Attach media source to video element
        video.src = URL.createObjectURL(mediaSource);

        video.crossOrigin = "anonymous";
        // Wait for media source to be open
        mediaSource.addEventListener("sourceopen", function () {
            mediaSource = this; // mediaSource.readyState === 'open'
            if (callRegister)
                register();
        });

        video.addEventListener("seeking", (event) => {
            if (!pause) {
                pause = true;
                seek();
            }
        });

        video.addEventListener("timeupdate", () => {
            if (!pause) setLoading(false);
        });

        video.addEventListener("waiting", (event) => {
            setLoading(true);
        });
        video.addEventListener("suspend ", (event) => {
            setLoading(true);
        });
        video.addEventListener("loadeddata", (event) => {
            setLoading(false);
        });
        video.addEventListener("play", (event) => {
            setLoading(false);
        });
        video.addEventListener("playing", (event) => {
            setLoading(false);
        });
        video.addEventListener("seeked", (event) => {
            setLoading(false);
        });
    }

    function register(registerAgain = false, segment = currentSegment) {
        $(".selected-quality").html(requiredQuality)
        console.info("register start");
        const ajaxTime = new Date().getTime();
        setLoading(true);
        abortRecentRequests();
        const url =
            baseUrl +
            "/register/?token=" +
            token +
            "&hashFile=" +
            hashfile +
            "&progressive=false&security=false&quality=" +
            requiredQuality +
            "&mobile=false";
        $.ajax(url, {
            method: "GET",
            dataType: "json", // type of response data
            cache: false,
            accepts: {
                json: "application/json",
            },
            success: function (response, status, xhr) {
                // success callback function
                const totalTime = new Date().getTime() - ajaxTime;
                console.info("register response after: " + totalTime);
                console.info(response);
                setLoading(false);

                consumeLink = response.consumLink;
                produceLink = response.produceLink;
                console.info("consumeLink:" + response.consumLink);
                console.info("produceLink: " + response.produceLink);
                console.info(
                    "total-segment-count:" + totalSegmentCount,
                    "segment-duration-seconds: " + segmentDuration,
                    "mimeCodec: " + mimeCodec
                );

                if (!registerAgain) {
                    initManifestData(response.manifest + "")
                    initSourceBuffer();
                    video.play();
                } else {
                    console.log("SEEKING IN REGISTER")
                    seekToSegment(segment);
                }
            },
            error: function (jqXhr, textStatus, errorMessage) {
                // error callback
                setLoading(false);
                console.error(errorMessage);
            },
        });
    }

    function seek() {
        video.pause();
        if (seekingSetTimeout != null) {
            clearTimeout(seekingSetTimeout);
            seekingSetTimeout = null;
        }
        seekingSetTimeout = setTimeout(function () {
            // const currentPlayingSegment = Math.max(parseInt(Math.floor(Math.floor(video.currentTime) / (segmentDuration / 1000))), 0);
            // video.currentTime = currentPlayingSegment * (segmentDuration / 1000);
            const serverSeekSegment = getServerSeekSegment();
            seekToSegment(serverSeekSegment);
            video.play();
        }, 500)
    }

    function seekToSegment(segment) {
        abortRecentRequests();
        console.info("seeking to segment: " + segment);
        segment = Math.min(segment, totalSegmentCount)
        const url = produceLink + "?segment=" + segment;
        const seekRequest = $.ajax(url, {
            method: "GET",
            dataType: "json", // type of response data
            cache: false,
            accepts: {
                json: "application/json",
            },
            headers: {
                _token_: token,
            },
            success: function (response, status, xhr) {
                currentSegment = segment - 1;
                console.info("seeking to segment done response: " + response);
                pause = false;
                requestsList.splice(requestsList.indexOf(seekRequest), 1);
            },
            statusCode: {
                404: function () {
                    registerAndSeek(segment);
                },
            },
            error: function (jqXhr, textStatus, errorMessage) {
                // error callback
                requestsList.splice(requestsList.indexOf(seekRequest), 1);
                console.error(errorMessage);
                pause = false;
            }
        });
        requestsList.push(seekRequest);
    }

    function nextSegment() {
        currentSegment = Math.max(currentSegment, -1);
        if (currentSegment <= totalSegmentCount - 1) {
            if (!checkBuffered(currentSegment + 1)) {
                currentSegment += 1;
                fetchArrayBuffer(currentSegment);
            } else {
                const calculatedSegment = getServerSeekSegment();
                if (calculatedSegment >= totalSegmentCount || checkBufferedTime(calculatedSegment * (segmentDuration / 1000), (calculatedSegment + 1) * segmentDuration / 1000)) {
                    console.info("in buffered")
                    currentSegment = calculatedSegment - 1;
                } else if (calculatedSegment < totalSegmentCount) {
                    if (requestsList.length === 0) {
                        console.debug("segment" + currentSegment + " read by cache buffer");
                        pause = true;
                        seekToSegment(calculatedSegment);
                    }
                }
            }
        }
    }

    function checkBuffered(segment) {
        try {
            const ranges = sourceBuffer.buffered;
            const currentTime = segment * (segmentDuration / 1000);
            for (let i = 0, len = ranges.length; i < len; i += 1) {
                const endI = Math.ceil(ranges.end(i));
                if (ranges.start(i) < currentTime && currentTime <= endI) return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    function getServerSeekSegment() {
        try {
            let ranges = sourceBuffer.buffered;
            for (let i = 0, len = ranges.length; i < len; i += 1) {
                const endI = Math.ceil(ranges.end(i));
                if (ranges.start(i) <= video.currentTime && video.currentTime <= endI) {
                    console.debug("FIND IN RANGE :  " + ranges.start(i) + " : " + endI)
                    console.debug("FIND SEGMENT : " + Math.max(parseInt(Math.floor(Math.floor(endI) / (segmentDuration / 1000))), 0))
                    return Math.max(parseInt(Math.floor(Math.floor(endI) / (segmentDuration / 1000))), 0) + 1;
                }
            }
        } catch (e) {
            return Math.max(
                parseInt(Math.floor(Math.floor(video.currentTime) / (segmentDuration / 1000))),
                0) + 1;
        }
        return Math.max(
            parseInt(Math.floor(Math.floor(video.currentTime) / (segmentDuration / 1000))),
            0) + 1;
    }

    function logBuffered() {
        try {
            let ranges = sourceBuffer.buffered;
            console.debug("BUFFERED RANGES: " + ranges.length);
            for (let i = 0, len = ranges.length; i < len; i += 1) {
                console.debug("RANGE: " + ranges.start(i) + " - " + ranges.end(i));
            }
        } catch (e) {
            console.error("log error" + e)
        }
    }

    function fetchArrayBuffer(segment) {
        const ajaxTime = new Date().getTime();
        console.info(consumeLink, "segment :" + segment);
        console.info("start to fetch bytes for segment: " + segment);
        currentRequestNumber += 1;
        const consumeReq = $.ajax(consumeLink, {
            method: "GET",
            cache: false,
            retryCount: 0,
            data: {a: segment},
            xhr: function () {
                const xhr = new XMLHttpRequest();
                xhr.responseType = "arraybuffer";
                return xhr;
            },
            success: function (response, status, xhr) {
                currentRequestNumber -= 1;
                const totalTime = new Date().getTime() - ajaxTime;
                console.info(
                    "response for segment:" +
                    segment +
                    " length: " +
                    response.byteLength +
                    " totalTime: " +
                    totalTime
                );
                const appendIntVal = setInterval(() => {
                    try {
                        if (!sourceBuffer.updating) {
                            sourceBuffer.appendBuffer(response);
                            setTimeout(function () {
                                logBuffered();
                            }, 200)
                            clearInterval(appendIntVal);
                        }
                    } catch (e) {
                        clearInterval(appendIntVal);
                    }
                }, 150);
                requestsList.splice(requestsList.indexOf(consumeReq), 1);
            },
            statusCode: {
                410: function () {
                    currentSegment--;
                },
                404: function () {
                    registerAndSeek(currentSegment);
                },
            },
            error: function (jqXhr, textStatus, errorMessage) {
                // error callback
                requestsList.splice(requestsList.indexOf(consumeReq), 1);
                currentRequestNumber -= 1;
                console.error(errorMessage);
            },
        });

        requestsList.push(consumeReq);
    }

    function changeQuality(quality) {
        pause = true;
        video.pause();
        abortRecentRequests();
        const url = produceLink + "?quality=" + quality + "&segment=0";
        const seekSegment = Math.floor(video.currentTime / (parseInt(segmentDuration) / 1000));
        const ajaxTime = new Date().getTime();
        console.info("seeking : " + url);
        $.ajax(url, {
            method: "GET",
            cache: false,
            accepts: {
                json: "application/json",
            },
            success: function () {
                $(".selected-quality").html(quality)
                const totalTime = new Date().getTime() - ajaxTime;
                console.info("response for seeking totalTime: " + totalTime);
                removeBuffered();
                currentSegment = 0;
                fetchArrayBuffer(currentSegment);
                currentSegment = 1;
                fetchArrayBuffer(currentSegment);
                currentSegment = 3;
                fetchArrayBuffer(currentSegment);

                const seekIntVal = setInterval(() => {
                    if (checkBufferedTime(0, 2 * segmentDuration / 1000)) {
                        console.log("seek start data has buffered")
                        seekToSegment(seekSegment);
                        video.play();
                        clearInterval(seekIntVal);
                    }
                }, 150);
            },
            error: function (jqXhr, textStatus, errorMessage) {
                // error callback
                pause = false;
                console.error(errorMessage);
            },
        });
    }

    function checkBufferedTime(begin, end) {
        try {
            console.log("checked buffered start:" + begin + "end :" + end)
            const ranges = sourceBuffer.buffered;
            for (let i = 0, len = ranges.length; i < len; i += 1) {
                const endI = String(ranges.end(i)).includes(".999999")
                    ? parseFloat(ranges.end(i)) + 0.000001
                    : ranges.end(i);
                console.log("seek start" + ranges.start(i) + " end :" + endI)
                if (ranges.start(i) <= begin && end <= Math.ceil(endI)) return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function createFetchingInterval() {
        if (fetchingIntervalStart == null) {
            fetchingIntervalStart = setInterval(() => {
                if (consumeLink.length > 0 && !pause) {
                    const currentPlayingSegment = Math.max(parseInt(Math.floor(Math.floor(video.currentTime) / (segmentDuration / 1000))), 0);
                    if (!pause && currentRequestNumber <= maxRequestNumber && currentSegment <= totalSegmentCount - 1 && getServerSeekSegment() < currentPlayingSegment + afterBufferSecond / (segmentDuration / 1000) + 1) {
                        nextSegment();
                    }
                }
                if (!pause && !sourceBuffer.updating && video.currentTime > beforeBufferSecond) {
                    const endRemove = Math.max(parseInt(Math.floor(Math.floor(video.currentTime) / (segmentDuration / 1000))), 0) * (segmentDuration / 1000) - beforeBufferSecond;
                    if (endRemove !== 0)
                        sourceBuffer.remove(0, endRemove);
                }
            }, 500);
        }
    }

    function changeHashFile(hashFile, token, quality) {
        pause = true;
        video.pause();
        const url = produceLink + "?quality=" + quality + "&hashFile=" + hashFile;
        console.info("changeHashFile : " + url);
        $.ajax(url, {
            method: "GET",
            cache: false,
            accepts: {
                json: "application/json",
            },
            success: function (response) {
                $(".selected-quality").html(quality)
                console.info("changing hashFile done");
                document.querySelector("input[id=hashfile]").value = hashFile;
                startPlayingVideo(false)
                setTimeout(function () {
                    console.log("changeHashFile", response)
                    initManifestData(response.manifest + "")
                    initSourceBuffer();
                    video.currentTime = 0;
                    pause = false;
                    video.play()
                }, 2000)
            },
            error: function (jqXhr, textStatus, errorMessage) {
                // error callback
                pause = false;
                console.error(errorMessage);
            },
        });
    }

    function initManifestData(manifest) {
        console.log(manifest)
        const xmlDoc = parser.parseFromString(manifest, "text/xml");
        totalSegmentCount = parseInt(
            xmlDoc.getElementsByTagName("segment-count")[0].childNodes[0].nodeValue - 1
        );
        segmentDuration = xmlDoc.getElementsByTagName("segment-duration-seconds")[0]
            .childNodes[0].nodeValue;
        mimeCodec =
            'video/mp4; codecs="' +
            xmlDoc.getElementsByTagName("codec")[0].childNodes[0].nodeValue +
            '"';
        console.info(
            "total-segment-count:" + totalSegmentCount,
            "segment-duration-seconds: " + segmentDuration,
            "mimeCodec: " + mimeCodec
        );


        controller.HD.menu.innerHTML = "";

        for (let i = 0; i < xmlDoc.getElementsByTagName("quality").length; i++) {
            const quality = xmlDoc.getElementsByTagName("quality")[i].getAttribute("name");
            let li = document.createElement('li');
            li.innerText = quality;
            li.addEventListener("click", () => {
                changeQuality(quality);
            });
            controller.HD.menu.appendChild(li);
        }
    }

    function initSourceBuffer() {
        sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
        console.info("MediaSource support mimeCodec: " + MediaSource.isTypeSupported(mimeCodec));

        sourceBuffer.addEventListener("error", function (ev) {
            console.error("error to update buffer:" + ev);
        });

        createFetchingInterval()
    }

    function removeBuffered() {
        try {
            sourceBuffer.remove(0, video.duration);
        } catch (e) {

        }
    }

    function registerAndSeek(segment) {
        register(true, segment);
    }

    function abortRecentRequests() {
        try {
            /*--------------------- Abort all of recent requests ---------------------*/
            while (requestsList?.length > 0) {
                const req = requestsList.pop();
                if (req.readyState !== 4) req.abort();
            }
        } catch (e) {

        }
    }
})
