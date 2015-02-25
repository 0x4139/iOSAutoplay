(function (z) {
    "use strict";
    var A = (function () {
        return z.requestAnimationFrame || z.webkitRequestAnimationFrame || z.mozRequestAnimationFrame || function (a) {
                z.setTimeout(a, 1000 / 60)
            }
    })();
    var B = z.MAGIC = function (a, b, c) {
        c = c || {};
        this.benchmark = !!c.benchmark;
        this.canvas = b;
        this.autoplay = true;
        this.loop = false;
        this.customIntraQuantMatrix = new Uint8Array(64);
        this.customNonIntraQuantMatrix = new Uint8Array(64);
        this.blockData = new Int32Array(64);
        this.zeroBlockData = new Int32Array(64);
        this.fillArray(this.zeroBlockData, 0);
        this.canvasContext = this.canvas.getContext('2d');
        this.renderFrame = this.renderFrame2D;
        this.load(a)
    };
    B.prototype.load = function (a) {
        this.url = a;
        var b = new XMLHttpRequest();
        var c = this;
        b.onreadystatechange = function () {
            if (b.readyState == b.DONE && b.status == 200) {
                c.loadCallback(b.response)
            }
        };
        b.onprogress = this.gl ? this.updateLoaderGL.bind(this) : this.updateLoader2D.bind(this);
        b.open('GET', a);
        b.responseType = "arraybuffer";
        b.send()
    };
    B.prototype.updateLoader2D = function (a) {
        var p = a.loaded / a.total, w = this.canvas.width, h = this.canvas.height, ctx = this.canvasContext;
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, h - h * p, w, h * p)
    };
    B.prototype.updateLoaderGL = function (a) {
        var b = this.gl;
        b.uniform1f(b.getUniformLocation(this.loadingProgram, 'loaded'), (a.loaded / a.total));
        b.drawArrays(b.TRIANGLE_STRIP, 0, 4)
    };
    B.prototype.loadCallback = function (a) {
        this.buffer = new E(a);
        this.findStartCode(START_SEQUENCE);
        this.firstSequenceHeader = this.buffer.index;
        this.decodeSequenceHeader();
        this.nextFrame();
        if (this.autoplay) {
            this.play()
        }
        if (this.externalLoadCallback) {
            this.externalLoadCallback(this)
        }
    };
    B.prototype.play = function (a) {
        if (this.playing) {
            return
        }
        this.targetTime = this.now();
        this.playing = true;
        this.scheduleNextFrame()
    };
    B.prototype.pause = function (a) {
        this.playing = false
    };
    B.prototype.stop = function (a) {
        if (this.buffer) {
            this.buffer.index = this.firstSequenceHeader
        }
        this.playing = false;
        if (this.client) {
            this.client.close();
            this.client = null
        }
    };
    B.prototype.readCode = function (a) {
        var b = 0;
        do {
            b = a[b + this.buffer.getBits(1)]
        } while (b >= 0 && a[b] != 0);
        return a[b + 2]
    };
    B.prototype.findStartCode = function (a) {
        var b = 0;
        while (true) {
            b = this.buffer.findNextMPEGStartCode();
            if (b == a || b == E.NOT_FOUND) {
                return b
            }
        }
        return E.NOT_FOUND
    };
    B.prototype.fillArray = function (a, b) {
        for (var i = 0, length = a.length; i < length; i++) {
            a[i] = b
        }
    };
    B.prototype.cachedFrameCount = 0;
    B.prototype.calculateFrameCount = function () {
        if (!this.buffer || this.cachedFrameCount) {
            return this.cachedFrameCount
        }
        var a = this.buffer.index, frames = 0;
        this.buffer.index = 0;
        while (this.findStartCode(START_PICTURE) !== E.NOT_FOUND) {
            frames++
        }
        this.buffer.index = a;
        this.cachedFrameCount = frames;
        return frames
    };
    B.prototype.calculateDuration = function () {
        return this.calculateFrameCount() * (1 / this.pictureRate)
    };
    B.prototype.pictureRate = 30;
    B.prototype.lateTime = 0;
    B.prototype.firstSequenceHeader = 0;
    B.prototype.targetTime = 0;
    B.prototype.benchmark = false;
    B.prototype.benchFrame = 0;
    B.prototype.benchDecodeTimes = 0;
    B.prototype.benchAvgFrameTime = 0;
    B.prototype.now = function () {
        return z.performance ? z.performance.now() : Date.now()
    }
    B.prototype.nextFrame = function () {
        if (!this.buffer) {
            return
        }
        var a = this.now();
        while (true) {
            var b = this.buffer.findNextMPEGStartCode();
            if (b == START_SEQUENCE) {
                this.decodeSequenceHeader()
            } else if (b == START_PICTURE) {
                if (this.playing) {
                    this.scheduleNextFrame()
                }
                this.decodePicture();
                this.benchDecodeTimes += this.now() - a;
                return this.canvas
            } else if (b == E.NOT_FOUND) {
                this.stop();
                if (this.externalFinishedCallback) {
                    this.externalFinishedCallback(this)
                }
                if (this.loop && this.sequenceStarted) {
                    this.play()
                }
                return null
            } else {
            }
        }
    };
    B.prototype.scheduleNextFrame = function () {
        this.lateTime = this.now() - this.targetTime;
        var a = Math.max(0, (1000 / this.pictureRate) - this.lateTime);
        this.targetTime = this.now() + a;
        if (this.benchmark) {
            this.benchFrame++;
            if (this.benchFrame >= 120) {
                this.benchAvgFrameTime = this.benchDecodeTimes / this.benchFrame;
                this.benchFrame = 0;
                this.benchDecodeTimes = 0;
                if (z.console) {
                    console.log("Average time per frame:", this.benchAvgFrameTime, 'ms')
                }
            }
            setTimeout(this.nextFrame.bind(this), 0)
        } else if (a < 18) {
            this.scheduleAnimation()
        } else {
            setTimeout(this.scheduleAnimation.bind(this), a)
        }
    };
    B.prototype.scheduleAnimation = function () {
        A(this.nextFrame.bind(this), this.canvas)
    };
    B.prototype.decodeSequenceHeader = function () {
        this.width = this.buffer.getBits(12);
        this.height = this.buffer.getBits(12);
        this.buffer.advance(4);
        this.pictureRate = PICTURE_RATE[this.buffer.getBits(4)];
        this.buffer.advance(18 + 1 + 10 + 1);
        this.initBuffers();
        if (this.buffer.getBits(1)) {
            for (var i = 0; i < 64; i++) {
                this.customIntraQuantMatrix[ZIG_ZAG[i]] = this.buffer.getBits(8)
            }
            this.intraQuantMatrix = this.customIntraQuantMatrix
        }
        if (this.buffer.getBits(1)) {
            for (var i = 0; i < 64; i++) {
                this.customNonIntraQuantMatrix[ZIG_ZAG[i]] = this.buffer.getBits(8)
            }
            this.nonIntraQuantMatrix = this.customNonIntraQuantMatrix
        }
    };
    B.prototype.initBuffers = function () {
        this.intraQuantMatrix = DEFAULT_INTRA_QUANT_MATRIX;
        this.nonIntraQuantMatrix = DEFAULT_NON_INTRA_QUANT_MATRIX;
        this.mbWidth = (this.width + 15) >> 4;
        this.mbHeight = (this.height + 15) >> 4;
        this.mbSize = this.mbWidth * this.mbHeight;
        this.codedWidth = this.mbWidth << 4;
        this.codedHeight = this.mbHeight << 4;
        this.codedSize = this.codedWidth * this.codedHeight;
        this.halfWidth = this.mbWidth << 3;
        this.halfHeight = this.mbHeight << 3;
        this.quarterSize = this.codedSize >> 2;
        if (this.sequenceStarted) {
            return
        }
        this.sequenceStarted = true;
        var a = z.Uint8ClampedArray || z.Uint8Array;
        if (!z.Uint8ClampedArray) {
            this.copyBlockToDestination = this.copyBlockToDestinationClamp;
            this.addBlockToDestination = this.addBlockToDestinationClamp
        }
        this.currentY = new a(this.codedSize);
        this.currentY32 = new Uint32Array(this.currentY.buffer);
        this.currentCr = new a(this.codedSize >> 2);
        this.currentCr32 = new Uint32Array(this.currentCr.buffer);
        this.currentCb = new a(this.codedSize >> 2);
        this.currentCb32 = new Uint32Array(this.currentCb.buffer);
        this.forwardY = new a(this.codedSize);
        this.forwardY32 = new Uint32Array(this.forwardY.buffer);
        this.forwardCr = new a(this.codedSize >> 2);
        this.forwardCr32 = new Uint32Array(this.forwardCr.buffer);
        this.forwardCb = new a(this.codedSize >> 2);
        this.forwardCb32 = new Uint32Array(this.forwardCb.buffer);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        if (this.gl) {
            this.gl.useProgram(this.program);
            this.gl.viewport(0, 0, this.width, this.height)
        } else {
            this.currentRGBA = this.canvasContext.getImageData(0, 0, this.width, this.height);
            this.fillArray(this.currentRGBA.data, 255)
        }
    };
    B.prototype.currentY = null;
    B.prototype.currentCr = null;
    B.prototype.currentCb = null;
    B.prototype.currentRGBA = null;
    B.prototype.pictureCodingType = 0;
    B.prototype.forwardY = null;
    B.prototype.forwardCr = null;
    B.prototype.forwardCb = null;
    B.prototype.fullPelForward = false;
    B.prototype.forwardFCode = 0;
    B.prototype.forwardRSize = 0;
    B.prototype.forwardF = 0;
    B.prototype.decodePicture = function (a) {
        this.buffer.advance(10);
        this.pictureCodingType = this.buffer.getBits(3);
        this.buffer.advance(16);
        if (this.pictureCodingType <= 0 || this.pictureCodingType >= PICTURE_TYPE_B) {
            return
        }
        if (this.pictureCodingType == PICTURE_TYPE_P) {
            this.fullPelForward = this.buffer.getBits(1);
            this.forwardFCode = this.buffer.getBits(3);
            if (this.forwardFCode == 0) {
                return
            }
            this.forwardRSize = this.forwardFCode - 1;
            this.forwardF = 1 << this.forwardRSize
        }
        var b = 0;
        do {
            b = this.buffer.findNextMPEGStartCode()
        } while (b == START_EXTENSION || b == START_USER_DATA);
        while (b >= START_SLICE_FIRST && b <= START_SLICE_LAST) {
            this.decodeSlice((b & 0x000000FF));
            b = this.buffer.findNextMPEGStartCode()
        }
        this.buffer.rewind(32);
        if (a != C) {
            this.renderFrame();
            if (this.externalDecodeCallback) {
                this.externalDecodeCallback(this, this.canvas)
            }
        }
        if (this.pictureCodingType == PICTURE_TYPE_I || this.pictureCodingType == PICTURE_TYPE_P) {
            var c = this.forwardY, tmpY32 = this.forwardY32, tmpCr = this.forwardCr, tmpCr32 = this.forwardCr32, tmpCb = this.forwardCb, tmpCb32 = this.forwardCb32;
            this.forwardY = this.currentY;
            this.forwardY32 = this.currentY32;
            this.forwardCr = this.currentCr;
            this.forwardCr32 = this.currentCr32;
            this.forwardCb = this.currentCb;
            this.forwardCb32 = this.currentCb32;
            this.currentY = c;
            this.currentY32 = tmpY32;
            this.currentCr = tmpCr;
            this.currentCr32 = tmpCr32;
            this.currentCb = tmpCb;
            this.currentCb32 = tmpCb32
        }
    };
    B.prototype.YCbCrToRGBA = function () {
        var a = this.currentY;
        var c = this.currentCb;
        var d = this.currentCr;
        var e = this.currentRGBA.data;
        var f = 0;
        var h = this.codedWidth;
        var i = this.codedWidth + (this.codedWidth - this.width);
        var j = 0;
        var k = this.halfWidth - (this.width >> 1);
        var l = 0;
        var m = this.width * 4;
        var n = this.width * 4;
        var o = this.width >> 1;
        var p = this.height >> 1;
        var y, cb, cr, r, g, b;
        for (var q = 0; q < p; q++) {
            for (var s = 0; s < o; s++) {
                cb = c[j];
                cr = d[j];
                j++;
                r = (cr + ((cr * 103) >> 8)) - 179;
                g = ((cb * 88) >> 8) - 44 + ((cr * 183) >> 8) - 91;
                b = (cb + ((cb * 198) >> 8)) - 227;
                var t = a[f++];
                var u = a[f++];
                e[l] = t + r;
                e[l + 1] = t - g;
                e[l + 2] = t + b;
                e[l + 4] = u + r;
                e[l + 5] = u - g;
                e[l + 6] = u + b;
                l += 8;
                var v = a[h++];
                var w = a[h++];
                e[m] = v + r;
                e[m + 1] = v - g;
                e[m + 2] = v + b;
                e[m + 4] = w + r;
                e[m + 5] = w - g;
                e[m + 6] = w + b;
                m += 8
            }
            f += i;
            h += i;
            l += n;
            m += n;
            j += k
        }
    };
    B.prototype.renderFrame2D = function () {
        this.YCbCrToRGBA();
        this.canvasContext.putImageData(this.currentRGBA, 0, 0)
    };
    B.prototype.gl = null;
    B.prototype.program = null;
    B.prototype.YTexture = null;
    B.prototype.CBTexture = null;
    B.prototype.CRTexture = null;
    B.prototype.createTexture = function (a, b) {
        var c = this.gl;
        var d = c.createTexture();
        c.bindTexture(c.TEXTURE_2D, d);
        c.texParameteri(c.TEXTURE_2D, c.TEXTURE_MAG_FILTER, c.LINEAR);
        c.texParameteri(c.TEXTURE_2D, c.TEXTURE_MIN_FILTER, c.LINEAR);
        c.texParameteri(c.TEXTURE_2D, c.TEXTURE_WRAP_S, c.CLAMP_TO_EDGE);
        c.texParameteri(c.TEXTURE_2D, c.TEXTURE_WRAP_T, c.CLAMP_TO_EDGE);
        c.uniform1i(c.getUniformLocation(this.program, b), a);
        return d
    };
    B.prototype.compileShader = function (a, b) {
        var c = this.gl;
        var d = c.createShader(a);
        c.shaderSource(d, b);
        c.compileShader(d);
        if (!c.getShaderParameter(d, c.COMPILE_STATUS)) {
            throw new Error(c.getShaderInfoLog(d));
        }
        return d
    };
    B.prototype.initWebGL = function () {
        try {
            var a = this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl')
        } catch (e) {
            return false
        }
        if (!a) {
            return false
        }
        this.buffer = a.createBuffer();
        a.bindBuffer(a.ARRAY_BUFFER, this.buffer);
        a.bufferData(a.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), a.STATIC_DRAW);
        this.program = a.createProgram();
        a.attachShader(this.program, this.compileShader(a.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
        a.attachShader(this.program, this.compileShader(a.FRAGMENT_SHADER, SHADER_FRAGMENT_YCBCRTORGBA));
        a.linkProgram(this.program);
        if (!a.getProgramParameter(this.program, a.LINK_STATUS)) {
            throw new Error(a.getProgramInfoLog(this.program));
        }
        a.useProgram(this.program);
        this.YTexture = this.createTexture(0, 'YTexture');
        this.CBTexture = this.createTexture(1, 'CBTexture');
        this.CRTexture = this.createTexture(2, 'CRTexture');
        var b = a.getAttribLocation(this.program, 'vertex');
        a.enableVertexAttribArray(b);
        a.vertexAttribPointer(b, 2, a.FLOAT, false, 0, 0);
        this.loadingProgram = a.createProgram();
        a.attachShader(this.loadingProgram, this.compileShader(a.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
        a.attachShader(this.loadingProgram, this.compileShader(a.FRAGMENT_SHADER, SHADER_FRAGMENT_LOADING));
        a.linkProgram(this.loadingProgram);
        a.useProgram(this.loadingProgram);
        b = a.getAttribLocation(this.loadingProgram, 'vertex');
        a.enableVertexAttribArray(b);
        a.vertexAttribPointer(b, 2, a.FLOAT, false, 0, 0);
        return true
    };
    B.prototype.renderFrameGL = function () {
        var a = this.gl;
        var b = new Uint8Array(this.currentY.buffer), uint8Cr = new Uint8Array(this.currentCr.buffer), uint8Cb = new Uint8Array(this.currentCb.buffer);
        a.activeTexture(a.TEXTURE0);
        a.bindTexture(a.TEXTURE_2D, this.YTexture);
        a.texImage2D(a.TEXTURE_2D, 0, a.LUMINANCE, this.codedWidth, this.height, 0, a.LUMINANCE, a.UNSIGNED_BYTE, b);
        a.activeTexture(a.TEXTURE1);
        a.bindTexture(a.TEXTURE_2D, this.CBTexture);
        a.texImage2D(a.TEXTURE_2D, 0, a.LUMINANCE, this.halfWidth, this.height / 2, 0, a.LUMINANCE, a.UNSIGNED_BYTE, uint8Cr);
        a.activeTexture(a.TEXTURE2);
        a.bindTexture(a.TEXTURE_2D, this.CRTexture);
        a.texImage2D(a.TEXTURE_2D, 0, a.LUMINANCE, this.halfWidth, this.height / 2, 0, a.LUMINANCE, a.UNSIGNED_BYTE, uint8Cb);
        a.drawArrays(a.TRIANGLE_STRIP, 0, 4)
    };
    B.prototype.quantizerScale = 0;
    B.prototype.sliceBegin = false;
    B.prototype.decodeSlice = function (a) {
        this.sliceBegin = true;
        this.macroblockAddress = (a - 1) * this.mbWidth - 1;
        this.motionFwH = this.motionFwHPrev = 0;
        this.motionFwV = this.motionFwVPrev = 0;
        this.dcPredictorY = 128;
        this.dcPredictorCr = 128;
        this.dcPredictorCb = 128;
        this.quantizerScale = this.buffer.getBits(5);
        while (this.buffer.getBits(1)) {
            this.buffer.advance(8)
        }
        do {
            this.decodeMacroblock()
        } while (!this.buffer.nextBytesAreStartCode())
    }
    B.prototype.macroblockAddress = 0;
    B.prototype.mbRow = 0;
    B.prototype.mbCol = 0;
    B.prototype.macroblockType = 0;
    B.prototype.macroblockIntra = false;
    B.prototype.macroblockMotFw = false;
    B.prototype.motionFwH = 0;
    B.prototype.motionFwV = 0;
    B.prototype.motionFwHPrev = 0;
    B.prototype.motionFwVPrev = 0;
    B.prototype.decodeMacroblock = function () {
        var a = 0, t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);
        while (t == 34) {
            t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT)
        }
        while (t == 35) {
            a += 33;
            t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT)
        }
        a += t;
        if (this.sliceBegin) {
            this.sliceBegin = false;
            this.macroblockAddress += a
        } else {
            if (this.macroblockAddress + a >= this.mbSize) {
                return
            }
            if (a > 1) {
                this.dcPredictorY = 128;
                this.dcPredictorCr = 128;
                this.dcPredictorCb = 128;
                if (this.pictureCodingType == PICTURE_TYPE_P) {
                    this.motionFwH = this.motionFwHPrev = 0;
                    this.motionFwV = this.motionFwVPrev = 0
                }
            }
            while (a > 1) {
                this.macroblockAddress++;
                this.mbRow = (this.macroblockAddress / this.mbWidth) | 0;
                this.mbCol = this.macroblockAddress % this.mbWidth;
                this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb);
                a--
            }
            this.macroblockAddress++
        }
        this.mbRow = (this.macroblockAddress / this.mbWidth) | 0;
        this.mbCol = this.macroblockAddress % this.mbWidth;
        this.macroblockType = this.readCode(D[this.pictureCodingType]);
        this.macroblockIntra = (this.macroblockType & 0x01);
        this.macroblockMotFw = (this.macroblockType & 0x08);
        if ((this.macroblockType & 0x10) != 0) {
            this.quantizerScale = this.buffer.getBits(5)
        }
        if (this.macroblockIntra) {
            this.motionFwH = this.motionFwHPrev = 0;
            this.motionFwV = this.motionFwVPrev = 0
        } else {
            this.dcPredictorY = 128;
            this.dcPredictorCr = 128;
            this.dcPredictorCb = 128;
            this.decodeMotionVectors();
            this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb)
        }
        var b = ((this.macroblockType & 0x02) != 0) ? this.readCode(CODE_BLOCK_PATTERN) : (this.macroblockIntra ? 0x3f : 0);
        for (var c = 0, mask = 0x20; c < 6; c++) {
            if ((b & mask) != 0) {
                this.decodeBlock(c)
            }
            mask >>= 1
        }
    };
    B.prototype.decodeMotionVectors = function () {
        var a, d, r = 0;
        if (this.macroblockMotFw) {
            a = this.readCode(MOTION);
            if ((a != 0) && (this.forwardF != 1)) {
                r = this.buffer.getBits(this.forwardRSize);
                d = ((Math.abs(a) - 1) << this.forwardRSize) + r + 1;
                if (a < 0) {
                    d = -d
                }
            } else {
                d = a
            }
            this.motionFwHPrev += d;
            if (this.motionFwHPrev > (this.forwardF << 4) - 1) {
                this.motionFwHPrev -= this.forwardF << 5
            } else if (this.motionFwHPrev < ((-this.forwardF) << 4)) {
                this.motionFwHPrev += this.forwardF << 5
            }
            this.motionFwH = this.motionFwHPrev;
            if (this.fullPelForward) {
                this.motionFwH <<= 1
            }
            a = this.readCode(MOTION);
            if ((a != 0) && (this.forwardF != 1)) {
                r = this.buffer.getBits(this.forwardRSize);
                d = ((Math.abs(a) - 1) << this.forwardRSize) + r + 1;
                if (a < 0) {
                    d = -d
                }
            } else {
                d = a
            }
            this.motionFwVPrev += d;
            if (this.motionFwVPrev > (this.forwardF << 4) - 1) {
                this.motionFwVPrev -= this.forwardF << 5
            } else if (this.motionFwVPrev < ((-this.forwardF) << 4)) {
                this.motionFwVPrev += this.forwardF << 5
            }
            this.motionFwV = this.motionFwVPrev;
            if (this.fullPelForward) {
                this.motionFwV <<= 1
            }
        } else if (this.pictureCodingType == PICTURE_TYPE_P) {
            this.motionFwH = this.motionFwHPrev = 0;
            this.motionFwV = this.motionFwVPrev = 0
        }
    };
    B.prototype.copyMacroblock = function (a, b, c, d, e) {
        var f, scan, H, V, oddH, oddV, src, dest, last;
        var g = this.currentY32;
        var h = this.currentCb32;
        var i = this.currentCr32;
        f = this.codedWidth;
        scan = f - 16;
        H = a >> 1;
        V = b >> 1;
        oddH = (a & 1) == 1;
        oddV = (b & 1) == 1;
        src = ((this.mbRow << 4) + V) * f + (this.mbCol << 4) + H;
        dest = (this.mbRow * f + this.mbCol) << 2;
        last = dest + (f << 2);
        var j, y2, y;
        if (oddH) {
            if (oddV) {
                while (dest < last) {
                    j = c[src] + c[src + f];
                    src++;
                    for (var x = 0; x < 4; x++) {
                        y2 = c[src] + c[src + f];
                        src++;
                        y = (((j + y2 + 2) >> 2) & 0xff);
                        j = c[src] + c[src + f];
                        src++;
                        y |= (((j + y2 + 2) << 6) & 0xff00);
                        y2 = c[src] + c[src + f];
                        src++;
                        y |= (((j + y2 + 2) << 14) & 0xff0000);
                        j = c[src] + c[src + f];
                        src++;
                        y |= (((j + y2 + 2) << 22) & 0xff000000);
                        g[dest++] = y
                    }
                    dest += scan >> 2;
                    src += scan - 1
                }
            } else {
                while (dest < last) {
                    j = c[src++];
                    for (var x = 0; x < 4; x++) {
                        y2 = c[src++];
                        y = (((j + y2 + 1) >> 1) & 0xff);
                        j = c[src++];
                        y |= (((j + y2 + 1) << 7) & 0xff00);
                        y2 = c[src++];
                        y |= (((j + y2 + 1) << 15) & 0xff0000);
                        j = c[src++];
                        y |= (((j + y2 + 1) << 23) & 0xff000000);
                        g[dest++] = y
                    }
                    dest += scan >> 2;
                    src += scan - 1
                }
            }
        } else {
            if (oddV) {
                while (dest < last) {
                    for (var x = 0; x < 4; x++) {
                        y = (((c[src] + c[src + f] + 1) >> 1) & 0xff);
                        src++;
                        y |= (((c[src] + c[src + f] + 1) << 7) & 0xff00);
                        src++;
                        y |= (((c[src] + c[src + f] + 1) << 15) & 0xff0000);
                        src++;
                        y |= (((c[src] + c[src + f] + 1) << 23) & 0xff000000);
                        src++;
                        g[dest++] = y
                    }
                    dest += scan >> 2;
                    src += scan
                }
            } else {
                while (dest < last) {
                    for (var x = 0; x < 4; x++) {
                        y = c[src];
                        src++;
                        y |= c[src] << 8;
                        src++;
                        y |= c[src] << 16;
                        src++;
                        y |= c[src] << 24;
                        src++;
                        g[dest++] = y
                    }
                    dest += scan >> 2;
                    src += scan
                }
            }
        }
        f = this.halfWidth;
        scan = f - 8;
        H = (a / 2) >> 1;
        V = (b / 2) >> 1;
        oddH = ((a / 2) & 1) == 1;
        oddV = ((b / 2) & 1) == 1;
        src = ((this.mbRow << 3) + V) * f + (this.mbCol << 3) + H;
        dest = (this.mbRow * f + this.mbCol) << 1;
        last = dest + (f << 1);
        var k, cr2, cr;
        var l, cb2, cb;
        if (oddH) {
            if (oddV) {
                while (dest < last) {
                    k = d[src] + d[src + f];
                    l = e[src] + e[src + f];
                    src++;
                    for (var x = 0; x < 2; x++) {
                        cr2 = d[src] + d[src + f];
                        cb2 = e[src] + e[src + f];
                        src++;
                        cr = (((k + cr2 + 2) >> 2) & 0xff);
                        cb = (((l + cb2 + 2) >> 2) & 0xff);
                        k = d[src] + d[src + f];
                        l = e[src] + e[src + f];
                        src++;
                        cr |= (((k + cr2 + 2) << 6) & 0xff00);
                        cb |= (((l + cb2 + 2) << 6) & 0xff00);
                        cr2 = d[src] + d[src + f];
                        cb2 = e[src] + e[src + f];
                        src++;
                        cr |= (((k + cr2 + 2) << 14) & 0xff0000);
                        cb |= (((l + cb2 + 2) << 14) & 0xff0000);
                        k = d[src] + d[src + f];
                        l = e[src] + e[src + f];
                        src++;
                        cr |= (((k + cr2 + 2) << 22) & 0xff000000);
                        cb |= (((l + cb2 + 2) << 22) & 0xff000000);
                        i[dest] = cr;
                        h[dest] = cb;
                        dest++
                    }
                    dest += scan >> 2;
                    src += scan - 1
                }
            } else {
                while (dest < last) {
                    k = d[src];
                    l = e[src];
                    src++;
                    for (var x = 0; x < 2; x++) {
                        cr2 = d[src];
                        cb2 = e[src++];
                        cr = (((k + cr2 + 1) >> 1) & 0xff);
                        cb = (((l + cb2 + 1) >> 1) & 0xff);
                        k = d[src];
                        l = e[src++];
                        cr |= (((k + cr2 + 1) << 7) & 0xff00);
                        cb |= (((l + cb2 + 1) << 7) & 0xff00);
                        cr2 = d[src];
                        cb2 = e[src++];
                        cr |= (((k + cr2 + 1) << 15) & 0xff0000);
                        cb |= (((l + cb2 + 1) << 15) & 0xff0000);
                        k = d[src];
                        l = e[src++];
                        cr |= (((k + cr2 + 1) << 23) & 0xff000000);
                        cb |= (((l + cb2 + 1) << 23) & 0xff000000);
                        i[dest] = cr;
                        h[dest] = cb;
                        dest++
                    }
                    dest += scan >> 2;
                    src += scan - 1
                }
            }
        } else {
            if (oddV) {
                while (dest < last) {
                    for (var x = 0; x < 2; x++) {
                        cr = (((d[src] + d[src + f] + 1) >> 1) & 0xff);
                        cb = (((e[src] + e[src + f] + 1) >> 1) & 0xff);
                        src++;
                        cr |= (((d[src] + d[src + f] + 1) << 7) & 0xff00);
                        cb |= (((e[src] + e[src + f] + 1) << 7) & 0xff00);
                        src++;
                        cr |= (((d[src] + d[src + f] + 1) << 15) & 0xff0000);
                        cb |= (((e[src] + e[src + f] + 1) << 15) & 0xff0000);
                        src++;
                        cr |= (((d[src] + d[src + f] + 1) << 23) & 0xff000000);
                        cb |= (((e[src] + e[src + f] + 1) << 23) & 0xff000000);
                        src++;
                        i[dest] = cr;
                        h[dest] = cb;
                        dest++
                    }
                    dest += scan >> 2;
                    src += scan
                }
            } else {
                while (dest < last) {
                    for (var x = 0; x < 2; x++) {
                        cr = d[src];
                        cb = e[src];
                        src++;
                        cr |= d[src] << 8;
                        cb |= e[src] << 8;
                        src++;
                        cr |= d[src] << 16;
                        cb |= e[src] << 16;
                        src++;
                        cr |= d[src] << 24;
                        cb |= e[src] << 24;
                        src++;
                        i[dest] = cr;
                        h[dest] = cb;
                        dest++
                    }
                    dest += scan >> 2;
                    src += scan
                }
            }
        }
    };
    B.prototype.dcPredictorY;
    B.prototype.dcPredictorCr;
    B.prototype.dcPredictorCb;
    B.prototype.blockData = null;
    B.prototype.decodeBlock = function (a) {
        var n = 0, quantMatrix;
        if (this.macroblockIntra) {
            var b, dctSize;
            if (a < 4) {
                b = this.dcPredictorY;
                dctSize = this.readCode(DCT_DC_SIZE_LUMINANCE)
            } else {
                b = (a == 4 ? this.dcPredictorCr : this.dcPredictorCb);
                dctSize = this.readCode(DCT_DC_SIZE_CHROMINANCE)
            }
            if (dctSize > 0) {
                var c = this.buffer.getBits(dctSize);
                if ((c & (1 << (dctSize - 1))) != 0) {
                    this.blockData[0] = b + c
                } else {
                    this.blockData[0] = b + ((-1 << dctSize) | (c + 1))
                }
            } else {
                this.blockData[0] = b
            }
            if (a < 4) {
                this.dcPredictorY = this.blockData[0]
            } else if (a == 4) {
                this.dcPredictorCr = this.blockData[0]
            } else {
                this.dcPredictorCb = this.blockData[0]
            }
            this.blockData[0] <<= (3 + 5);
            quantMatrix = this.intraQuantMatrix;
            n = 1
        } else {
            quantMatrix = this.nonIntraQuantMatrix
        }
        var d = 0;
        while (true) {
            var e = 0, coeff = this.readCode(DCT_COEFF);
            if ((coeff == 0x0001) && (n > 0) && (this.buffer.getBits(1) == 0)) {
                break
            }
            if (coeff == 0xffff) {
                e = this.buffer.getBits(6);
                d = this.buffer.getBits(8);
                if (d == 0) {
                    d = this.buffer.getBits(8)
                } else if (d == 128) {
                    d = this.buffer.getBits(8) - 256
                } else if (d > 128) {
                    d = d - 256
                }
            } else {
                e = coeff >> 8;
                d = coeff & 0xff;
                if (this.buffer.getBits(1)) {
                    d = -d
                }
            }
            n += e;
            var f = ZIG_ZAG[n];
            n++;
            d <<= 1;
            if (!this.macroblockIntra) {
                d += (d < 0 ? -1 : 1)
            }
            d = (d * this.quantizerScale * quantMatrix[f]) >> 4;
            if ((d & 1) == 0) {
                d -= d > 0 ? 1 : -1
            }
            if (d > 2047) {
                d = 2047
            } else if (d < -2048) {
                d = -2048
            }
            this.blockData[f] = d * PREMULTIPLIER_MATRIX[f]
        }
        ;
        var g, destIndex, scan;
        if (a < 4) {
            g = this.currentY;
            scan = this.codedWidth - 8;
            destIndex = (this.mbRow * this.codedWidth + this.mbCol) << 4;
            if ((a & 1) != 0) {
                destIndex += 8
            }
            if ((a & 2) != 0) {
                destIndex += this.codedWidth << 3
            }
        } else {
            g = (a == 4) ? this.currentCb : this.currentCr;
            scan = (this.codedWidth >> 1) - 8;
            destIndex = ((this.mbRow * this.codedWidth) << 2) + (this.mbCol << 3)
        }
        if (this.macroblockIntra) {
            if (n == 1) {
                this.copyValueToDestination((this.blockData[0] + 128) >> 8, g, destIndex, scan);
                this.blockData[0] = 0
            } else {
                this.IDCT();
                this.copyBlockToDestination(this.blockData, g, destIndex, scan);
                this.blockData.set(this.zeroBlockData)
            }
        } else {
            if (n == 1) {
                this.addValueToDestination((this.blockData[0] + 128) >> 8, g, destIndex, scan);
                this.blockData[0] = 0
            } else {
                this.IDCT();
                this.addBlockToDestination(this.blockData, g, destIndex, scan);
                this.blockData.set(this.zeroBlockData)
            }
        }
        n = 0
    };
    B.prototype.copyBlockToDestination = function (a, b, c, d) {
        for (var n = 0; n < 64; n += 8, c += d + 8) {
            b[c + 0] = a[n + 0];
            b[c + 1] = a[n + 1];
            b[c + 2] = a[n + 2];
            b[c + 3] = a[n + 3];
            b[c + 4] = a[n + 4];
            b[c + 5] = a[n + 5];
            b[c + 6] = a[n + 6];
            b[c + 7] = a[n + 7]
        }
    };
    B.prototype.addBlockToDestination = function (a, b, c, d) {
        for (var n = 0; n < 64; n += 8, c += d + 8) {
            b[c + 0] += a[n + 0];
            b[c + 1] += a[n + 1];
            b[c + 2] += a[n + 2];
            b[c + 3] += a[n + 3];
            b[c + 4] += a[n + 4];
            b[c + 5] += a[n + 5];
            b[c + 6] += a[n + 6];
            b[c + 7] += a[n + 7]
        }
    };
    B.prototype.copyValueToDestination = function (a, b, c, d) {
        for (var n = 0; n < 64; n += 8, c += d + 8) {
            b[c + 0] = a;
            b[c + 1] = a;
            b[c + 2] = a;
            b[c + 3] = a;
            b[c + 4] = a;
            b[c + 5] = a;
            b[c + 6] = a;
            b[c + 7] = a
        }
    };
    B.prototype.addValueToDestination = function (a, b, c, d) {
        for (var n = 0; n < 64; n += 8, c += d + 8) {
            b[c + 0] += a;
            b[c + 1] += a;
            b[c + 2] += a;
            b[c + 3] += a;
            b[c + 4] += a;
            b[c + 5] += a;
            b[c + 6] += a;
            b[c + 7] += a
        }
    };
    B.prototype.copyBlockToDestinationClamp = function (a, b, c, d) {
        var n = 0;
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                var p = a[n++];
                b[c++] = p > 255 ? 255 : (p < 0 ? 0 : p)
            }
            c += d
        }
    };
    B.prototype.addBlockToDestinationClamp = function (a, b, c, d) {
        var n = 0;
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                var p = a[n++] + b[c];
                b[c++] = p > 255 ? 255 : (p < 0 ? 0 : p)
            }
            c += d
        }
    };
    B.prototype.IDCT = function () {
        var a, b3, b4, b6, b7, tmp1, tmp2, m0, x0, x1, x2, x3, x4, y3, y4, y5, y6, y7, i, blockData = this.blockData;
        for (i = 0; i < 8; ++i) {
            a = blockData[4 * 8 + i];
            b3 = blockData[2 * 8 + i] + blockData[6 * 8 + i];
            b4 = blockData[5 * 8 + i] - blockData[3 * 8 + i];
            tmp1 = blockData[1 * 8 + i] + blockData[7 * 8 + i];
            tmp2 = blockData[3 * 8 + i] + blockData[5 * 8 + i];
            b6 = blockData[1 * 8 + i] - blockData[7 * 8 + i];
            b7 = tmp1 + tmp2;
            m0 = blockData[0 * 8 + i];
            x4 = ((b6 * 473 - b4 * 196 + 128) >> 8) - b7;
            x0 = x4 - (((tmp1 - tmp2) * 362 + 128) >> 8);
            x1 = m0 - a;
            x2 = (((blockData[2 * 8 + i] - blockData[6 * 8 + i]) * 362 + 128) >> 8) - b3;
            x3 = m0 + a;
            y3 = x1 + x2;
            y4 = x3 + b3;
            y5 = x1 - x2;
            y6 = x3 - b3;
            y7 = -x0 - ((b4 * 473 + b6 * 196 + 128) >> 8);
            blockData[0 * 8 + i] = b7 + y4;
            blockData[1 * 8 + i] = x4 + y3;
            blockData[2 * 8 + i] = y5 - x0;
            blockData[3 * 8 + i] = y6 - y7;
            blockData[4 * 8 + i] = y6 + y7;
            blockData[5 * 8 + i] = x0 + y5;
            blockData[6 * 8 + i] = y3 - x4;
            blockData[7 * 8 + i] = y4 - b7
        }
        for (i = 0; i < 64; i += 8) {
            a = blockData[4 + i];
            b3 = blockData[2 + i] + blockData[6 + i];
            b4 = blockData[5 + i] - blockData[3 + i];
            tmp1 = blockData[1 + i] + blockData[7 + i];
            tmp2 = blockData[3 + i] + blockData[5 + i];
            b6 = blockData[1 + i] - blockData[7 + i];
            b7 = tmp1 + tmp2;
            m0 = blockData[0 + i];
            x4 = ((b6 * 473 - b4 * 196 + 128) >> 8) - b7;
            x0 = x4 - (((tmp1 - tmp2) * 362 + 128) >> 8);
            x1 = m0 - a;
            x2 = (((blockData[2 + i] - blockData[6 + i]) * 362 + 128) >> 8) - b3;
            x3 = m0 + a;
            y3 = x1 + x2;
            y4 = x3 + b3;
            y5 = x1 - x2;
            y6 = x3 - b3;
            y7 = -x0 - ((b4 * 473 + b6 * 196 + 128) >> 8);
            blockData[0 + i] = (b7 + y4 + 128) >> 8;
            blockData[1 + i] = (x4 + y3 + 128) >> 8;
            blockData[2 + i] = (y5 - x0 + 128) >> 8;
            blockData[3 + i] = (y6 - y7 + 128) >> 8;
            blockData[4 + i] = (y6 + y7 + 128) >> 8;
            blockData[5 + i] = (x0 + y5 + 128) >> 8;
            blockData[6 + i] = (y3 - x4 + 128) >> 8;
            blockData[7 + i] = (y4 - b7 + 128) >> 8
        }
    };
    var C = 1, PICTURE_RATE = [0.000, 24.376, 29.000, 21.000, 22.320, 31.013, 52.000, 53.210, 30.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000],
        ZIG_ZAG = new Uint8Array([0, 1, 8, 16, 9, 2, 4, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63]),
        DEFAULT_INTRA_QUANT_MATRIX = new Uint8Array([9, 15, 19, 24, 23, 27, 29, 34, 16, 16, 21, 24, 25, 29, 34, 37, 19, 22, 26, 27, 29, 34, 34, 38, 22, 22, 26, 27, 29, 34, 37, 40, 22, 26, 27, 29, 32, 32, 40, 48, 26, 27, 29, 32, 35, 40, 48, 58, 26, 27, 29, 34, 38, 46, 56, 62, 22, 29, 35, 38, 46, 56, 69, 83]),
        DEFAULT_NON_INTRA_QUANT_MATRIX = new Uint8Array([14, 13, 12, 16, 16, 16, 19, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 12, 14, 16, 16, 10, 12, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]),
        PREMULTIPLIER_MATRIX = new Uint8Array([30, 42, 40, 36, 30, 23, 15, 9, 44, 62, 58, 52, 44, 35, 24, 12, 42, 58, 55, 49, 42, 33, 23, 12, 38, 52, 49, 44, 38, 30, 20, 10, 32, 44, 42, 38, 32, 25, 17, 9, 25, 35, 33, 30, 25, 20, 14, 7, 17, 24, 23, 20, 17, 14, 9, 5, 9, 12, 12, 10, 9, 7, 5, 2]), MACROBLOCK_ADDRESS_INCREMENT = new Int16Array([1 * 3, 2 * 3, 0, 3 * 3, 4 * 3, 0, 0, 0, 1, 5 * 3, 6 * 3, 0, 7 * 3, 8 * 3, 0, 9 * 3, 10 * 3, 0, 11 * 3, 12 * 3, 0, 0, 0, 3, 0, 0, 2, 13 * 3, 14 * 3, 0, 15 * 3, 16 * 3, 0, 0, 0, 5, 0, 0, 4, 17 * 3, 18 * 3, 0, 19 * 3, 20 * 3, 0, 0, 0, 7, 0, 0, 6, 21 * 3, 22 * 3, 0, 23 * 3, 24 * 3, 0, 25 * 3, 26 * 3, 0, 27 * 3, 28 * 3, 0, -1, 29 * 3, 0, -1, 30 * 3, 0, 31 * 3, 32 * 3, 0, 33 * 3, 34 * 3, 0, 35 * 3, 36 * 3, 0, 37 * 3, 38 * 3, 0, 0, 0, 9, 0, 0, 8, 39 * 3, 40 * 3, 0, 41 * 3, 42 * 3, 0, 43 * 3, 44 * 3, 0, 45 * 3, 46 * 3, 0, 0, 0, 15, 0, 0, 14, 0, 0, 13, 0, 0, 12, 0, 0, 11, 0, 0, 10, 47 * 3, -1, 0, -1, 48 * 3, 0, 49 * 3, 50 * 3, 0, 51 * 3, 52 * 3, 0, 53 * 3, 54 * 3, 0, 55 * 3, 56 * 3, 0, 57 * 3, 58 * 3, 0, 59 * 3, 60 * 3, 0, 61 * 3, -1, 0, -1, 62 * 3, 0, 63 * 3, 64 * 3, 0, 65 * 3, 66 * 3, 0, 67 * 3, 68 * 3, 0, 69 * 3, 70 * 3, 0, 71 * 3, 72 * 3, 0, 73 * 3, 74 * 3, 0, 0, 0, 21, 0, 0, 20, 0, 0, 19, 0, 0, 18, 0, 0, 17, 0, 0, 16, 0, 0, 35, 0, 0, 34, 0, 0, 33, 0, 0, 32, 0, 0, 31, 0, 0, 30, 0, 0, 29, 0, 0, 28, 0, 0, 27, 0, 0, 26, 0, 0, 25, 0, 0, 24, 0, 0, 23, 0, 0, 22]), MACROBLOCK_TYPE_I = new Int8Array([1 * 3, 2 * 3, 0, -1, 3 * 3, 0, 0, 0, 0x01, 0, 0, 0x11]), MACROBLOCK_TYPE_P = new Int8Array([1 * 3, 2 * 3, 0, 3 * 3, 4 * 3, 0, 0, 0, 0x0a, 5 * 3, 6 * 3, 0, 0, 0, 0x02, 7 * 3, 8 * 3, 0, 0, 0, 0x08, 9 * 3, 10 * 3, 0, 11 * 3, 12 * 3, 0, -1, 13 * 3, 0, 0, 0, 0x12, 0, 0, 0x1a, 0, 0, 0x01, 0, 0, 0x11]), MACROBLOCK_TYPE_B = new Int8Array([1 * 3, 2 * 3, 0, 3 * 3, 5 * 3, 0, 4 * 3, 6 * 3, 0, 8 * 3, 7 * 3, 0, 0, 0, 0x0c, 9 * 3, 10 * 3, 0, 0, 0, 0x0e, 13 * 3, 14 * 3, 0, 12 * 3, 11 * 3, 0, 0, 0, 0x04, 0, 0, 0x06, 18 * 3, 16 * 3, 0, 15 * 3, 17 * 3, 0, 0, 0, 0x08, 0, 0, 0x0a, -1, 19 * 3, 0, 0, 0, 0x01, 20 * 3, 21 * 3, 0, 0, 0, 0x1e, 0, 0, 0x11, 0, 0, 0x16, 0, 0, 0x1a]), CODE_BLOCK_PATTERN = new Int16Array([2 * 3, 1 * 3, 0, 3 * 3, 6 * 3, 0, 4 * 3, 5 * 3, 0, 8 * 3, 11 * 3, 0, 12 * 3, 13 * 3, 0, 9 * 3, 7 * 3, 0, 10 * 3, 14 * 3, 0, 20 * 3, 19 * 3, 0, 18 * 3, 16 * 3, 0, 23 * 3, 17 * 3, 0, 27 * 3, 25 * 3, 0, 21 * 3, 28 * 3, 0, 15 * 3, 22 * 3, 0, 24 * 3, 26 * 3, 0, 0, 0, 60, 35 * 3, 40 * 3, 0, 44 * 3, 48 * 3, 0, 38 * 3, 36 * 3, 0, 42 * 3, 47 * 3, 0, 29 * 3, 31 * 3, 0, 39 * 3, 32 * 3, 0, 0, 0, 32, 45 * 3, 46 * 3, 0, 33 * 3, 41 * 3, 0, 43 * 3, 34 * 3, 0, 0, 0, 4, 30 * 3, 37 * 3, 0, 0, 0, 8, 0, 0, 16, 0, 0, 44, 50 * 3, 56 * 3, 0, 0, 0, 28, 0, 0, 52, 0, 0, 62, 61 * 3, 59 * 3, 0, 52 * 3, 60 * 3, 0, 0, 0, 1, 55 * 3, 54 * 3, 0, 0, 0, 61, 0, 0, 56, 57 * 3, 58 * 3, 0, 0, 0, 2, 0, 0, 40, 51 * 3, 62 * 3, 0, 0, 0, 48, 64 * 3, 63 * 3, 0, 49 * 3, 53 * 3, 0, 0, 0, 20, 0, 0, 12, 80 * 3, 83 * 3, 0, 0, 0, 63, 77 * 3, 75 * 3, 0, 65 * 3, 73 * 3, 0, 84 * 3, 66 * 3, 0, 0, 0, 24, 0, 0, 36, 0, 0, 3, 69 * 3, 87 * 3, 0, 81 * 3, 79 * 3, 0, 68 * 3, 71 * 3, 0, 70 * 3, 78 * 3, 0, 67 * 3, 76 * 3, 0, 72 * 3, 74 * 3, 0, 86 * 3, 85 * 3, 0, 88 * 3, 82 * 3, 0, -1, 94 * 3, 0, 95 * 3, 97 * 3, 0, 0, 0, 33, 0, 0, 9, 106 * 3, 110 * 3, 0, 102 * 3, 116 * 3, 0, 0, 0, 5, 0, 0, 10, 93 * 3, 89 * 3, 0, 0, 0, 6, 0, 0, 18, 0, 0, 17, 0, 0, 34, 113 * 3, 119 * 3, 0, 103 * 3, 104 * 3, 0, 90 * 3, 92 * 3, 0, 109 * 3, 107 * 3, 0, 117 * 3, 118 * 3, 0, 101 * 3, 99 * 3, 0, 98 * 3, 96 * 3, 0, 100 * 3, 91 * 3, 0, 114 * 3, 115 * 3, 0, 105 * 3, 108 * 3, 0, 112 * 3, 111 * 3, 0, 121 * 3, 125 * 3, 0, 0, 0, 41, 0, 0, 14, 0, 0, 21, 124 * 3, 122 * 3, 0, 120 * 3, 123 * 3, 0, 0, 0, 11, 0, 0, 19, 0, 0, 7, 0, 0, 35, 0, 0, 13, 0, 0, 50, 0, 0, 49, 0, 0, 58, 0, 0, 37, 0, 0, 25, 0, 0, 45, 0, 0, 57, 0, 0, 26, 0, 0, 29, 0, 0, 38, 0, 0, 53, 0, 0, 23, 0, 0, 43, 0, 0, 46, 0, 0, 42, 0, 0, 22, 0, 0, 54, 0, 0, 51, 0, 0, 15, 0, 0, 30, 0, 0, 39, 0, 0, 47, 0, 0, 55, 0, 0, 27, 0, 0, 59, 0, 0, 31]), MOTION = new Int16Array([1 * 3, 2 * 3, 0, 4 * 3, 3 * 3, 0, 0, 0, 0, 6 * 3, 5 * 3, 0, 8 * 3, 7 * 3, 0, 0, 0, -1, 0, 0, 1, 9 * 3, 10 * 3, 0, 12 * 3, 11 * 3, 0, 0, 0, 2, 0, 0, -2, 14 * 3, 15 * 3, 0, 16 * 3, 13 * 3, 0, 20 * 3, 18 * 3, 0, 0, 0, 3, 0, 0, -3, 17 * 3, 19 * 3, 0, -1, 23 * 3, 0, 27 * 3, 25 * 3, 0, 26 * 3, 21 * 3, 0, 24 * 3, 22 * 3, 0, 32 * 3, 28 * 3, 0, 29 * 3, 31 * 3, 0, -1, 33 * 3, 0, 36 * 3, 35 * 3, 0, 0, 0, -4, 30 * 3, 34 * 3, 0, 0, 0, 4, 0, 0, -7, 0, 0, 5, 37 * 3, 41 * 3, 0, 0, 0, -5, 0, 0, 7, 38 * 3, 40 * 3, 0, 42 * 3, 39 * 3, 0, 0, 0, -6, 0, 0, 6, 51 * 3, 54 * 3, 0, 50 * 3, 49 * 3, 0, 45 * 3, 46 * 3, 0, 52 * 3, 47 * 3, 0, 43 * 3, 53 * 3, 0, 44 * 3, 48 * 3, 0, 0, 0, 10, 0, 0, 9, 0, 0, 8, 0, 0, -8, 57 * 3, 66 * 3, 0, 0, 0, -9, 60 * 3, 64 * 3, 0, 56 * 3, 61 * 3, 0, 55 * 3, 62 * 3, 0, 58 * 3, 63 * 3, 0, 0, 0, -10, 59 * 3, 65 * 3, 0, 0, 0, 12, 0, 0, 16, 0, 0, 13, 0, 0, 14, 0, 0, 11, 0, 0, 15, 0, 0, -16, 0, 0, -12, 0, 0, -14, 0, 0, -15, 0, 0, -11, 0, 0, -13]), DCT_DC_SIZE_LUMINANCE = new Int8Array([2 * 3, 1 * 3, 0, 6 * 3, 5 * 3, 0, 3 * 3, 4 * 3, 0, 0, 0, 1, 0, 0, 2, 9 * 3, 8 * 3, 0, 7 * 3, 10 * 3, 0, 0, 0, 0, 12 * 3, 11 * 3, 0, 0, 0, 4, 0, 0, 3, 13 * 3, 14 * 3, 0, 0, 0, 5, 0, 0, 6, 16 * 3, 15 * 3, 0, 17 * 3, -1, 0, 0, 0, 7, 0, 0, 8]), DCT_DC_SIZE_CHROMINANCE = new Int8Array([2 * 3, 1 * 3, 0, 4 * 3, 3 * 3, 0, 6 * 3, 5 * 3, 0, 8 * 3, 7 * 3, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 10 * 3, 9 * 3, 0, 0, 0, 3, 12 * 3, 11 * 3, 0, 0, 0, 4, 14 * 3, 13 * 3, 0, 0, 0, 5, 16 * 3, 15 * 3, 0, 0, 0, 6, 17 * 3, -1, 0, 0, 0, 7, 0, 0, 8]), DCT_COEFF = new Int32Array([3, 2 * 3, 0, 4 * 3, 3 * 3, 0, 0, 0, 0x0001, 7 * 3, 8 * 3, 0, 6 * 3, 5 * 3, 0, 13 * 3, 9 * 3, 0, 11 * 3, 10 * 3, 0, 14 * 3, 12 * 3, 0, 0, 0, 0x0101, 20 * 3, 22 * 3, 0, 18 * 3, 21 * 3, 0, 16 * 3, 19 * 3, 0, 0, 0, 0x0201, 17 * 3, 15 * 3, 0, 0, 0, 0x0002, 0, 0, 0x0003, 27 * 3, 25 * 3, 0, 29 * 3, 31 * 3, 0, 24 * 3, 26 * 3, 0, 32 * 3, 30 * 3, 0, 0, 0, 0x0401, 23 * 3, 28 * 3, 0, 0, 0, 0x0301, 0, 0, 0x0102, 0, 0, 0x0701, 0, 0, 0xffff, 0, 0, 0x0601, 37 * 3, 36 * 3, 0, 0, 0, 0x0501, 35 * 3, 34 * 3, 0, 39 * 3, 38 * 3, 0, 33 * 3, 42 * 3, 0, 40 * 3, 41 * 3, 0, 52 * 3, 50 * 3, 0, 54 * 3, 53 * 3, 0, 48 * 3, 49 * 3, 0, 43 * 3, 45 * 3, 0, 46 * 3, 44 * 3, 0, 0, 0, 0x0801, 0, 0, 0x0004, 0, 0, 0x0202, 0, 0, 0x0901, 51 * 3, 47 * 3, 0, 55 * 3, 57 * 3, 0, 60 * 3, 56 * 3, 0, 59 * 3, 58 * 3, 0, 61 * 3, 62 * 3, 0, 0, 0, 0x0a01, 0, 0, 0x0d01, 0, 0, 0x0006, 0, 0, 0x0103, 0, 0, 0x0005, 0, 0, 0x0302, 0, 0, 0x0b01, 0, 0, 0x0c01, 76 * 3, 75 * 3, 0, 67 * 3, 70 * 3, 0, 73 * 3, 71 * 3, 0, 78 * 3, 74 * 3, 0, 72 * 3, 77 * 3, 0, 69 * 3, 64 * 3, 0, 68 * 3, 63 * 3, 0, 66 * 3, 65 * 3, 0, 81 * 3, 87 * 3, 0, 91 * 3, 80 * 3, 0, 82 * 3, 79 * 3, 0, 83 * 3, 86 * 3, 0, 93 * 3, 92 * 3, 0, 84 * 3, 85 * 3, 0, 90 * 3, 94 * 3, 0, 88 * 3, 89 * 3, 0, 0, 0, 0x0203, 0, 0, 0x0104, 0, 0, 0x0007, 0, 0, 0x0402, 0, 0, 0x0502, 0, 0, 0x1001, 0, 0, 0x0f01, 0, 0, 0x0e01, 105 * 3, 107 * 3, 0, 111 * 3, 114 * 3, 0, 104 * 3, 97 * 3, 0, 125 * 3, 119 * 3, 0, 96 * 3, 98 * 3, 0, -1, 123 * 3, 0, 95 * 3, 101 * 3, 0, 106 * 3, 121 * 3, 0, 99 * 3, 102 * 3, 0, 113 * 3, 103 * 3, 0, 112 * 3, 116 * 3, 0, 110 * 3, 100 * 3, 0, 124 * 3, 115 * 3, 0, 117 * 3, 122 * 3, 0, 109 * 3, 118 * 3, 0, 120 * 3, 108 * 3, 0, 127 * 3, 136 * 3, 0, 139 * 3, 140 * 3, 0, 130 * 3, 126 * 3, 0, 145 * 3, 146 * 3, 0, 128 * 3, 129 * 3, 0, 0, 0, 0x0802, 132 * 3, 134 * 3, 0, 155 * 3, 154 * 3, 0, 0, 0, 0x0008, 137 * 3, 133 * 3, 0, 143 * 3, 144 * 3, 0, 151 * 3, 138 * 3, 0, 142 * 3, 141 * 3, 0, 0, 0, 0x000a, 0, 0, 0x0009, 0, 0, 0x000b, 0, 0, 0x1501, 0, 0, 0x0602, 0, 0, 0x0303, 0, 0, 0x1401, 0, 0, 0x0702, 0, 0, 0x1101, 0, 0, 0x1201, 0, 0, 0x1301, 148 * 3, 152 * 3, 0, 0, 0, 0x0403, 153 * 3, 150 * 3, 0, 0, 0, 0x0105, 131 * 3, 135 * 3, 0, 0, 0, 0x0204, 149 * 3, 147 * 3, 0, 172 * 3, 173 * 3, 0, 162 * 3, 158 * 3, 0, 170 * 3, 161 * 3, 0, 168 * 3, 166 * 3, 0, 157 * 3, 179 * 3, 0, 169 * 3, 167 * 3, 0, 174 * 3, 171 * 3, 0, 178 * 3, 177 * 3, 0, 156 * 3, 159 * 3, 0, 164 * 3, 165 * 3, 0, 183 * 3, 182 * 3, 0, 175 * 3, 176 * 3, 0, 0, 0, 0x0107, 0, 0, 0x0a02, 0, 0, 0x0902, 0, 0, 0x1601, 0, 0, 0x1701, 0, 0, 0x1901, 0, 0, 0x1801, 0, 0, 0x0503, 0, 0, 0x0304, 0, 0, 0x000d, 0, 0, 0x000c, 0, 0, 0x000e, 0, 0, 0x000f, 0, 0, 0x0205, 0, 0, 0x1a01, 0, 0, 0x0106, 180 * 3, 181 * 3, 0, 160 * 3, 163 * 3, 0, 196 * 3, 199 * 3, 0, 0, 0, 0x001b, 203 * 3, 185 * 3, 0, 202 * 3, 201 * 3, 0, 0, 0, 0x0013, 0, 0, 0x0016, 197 * 3, 207 * 3, 0, 0, 0, 0x0012, 191 * 3, 192 * 3, 0, 188 * 3, 190 * 3, 0, 0, 0, 0x0014, 184 * 3, 194 * 3, 0, 0, 0, 0x0015, 186 * 3, 193 * 3, 0, 0, 0, 0x0017, 204 * 3, 198 * 3, 0, 0, 0, 0x0019, 0, 0, 0x0018, 200 * 3, 205 * 3, 0, 0, 0, 0x001f, 0, 0, 0x001e, 0, 0, 0x001c, 0, 0, 0x001d, 0, 0, 0x001a, 0, 0, 0x0011, 0, 0, 0x0010, 189 * 3, 206 * 3, 0, 187 * 3, 195 * 3, 0, 218 * 3, 211 * 3, 0, 0, 0, 0x0025, 215 * 3, 216 * 3, 0, 0, 0, 0x0024, 210 * 3, 212 * 3, 0, 0, 0, 0x0022, 213 * 3, 209 * 3, 0, 221 * 3, 222 * 3, 0, 219 * 3, 208 * 3, 0, 217 * 3, 214 * 3, 0, 223 * 3, 220 * 3, 0, 0, 0, 0x0023, 0, 0, 0x010b, 0, 0, 0x0028, 0, 0, 0x010c, 0, 0, 0x010a, 0, 0, 0x0020, 0, 0, 0x0108, 0, 0, 0x0109, 0, 0, 0x0026, 0, 0, 0x010d, 0, 0, 0x010e, 0, 0, 0x0021, 0, 0, 0x0027, 0, 0, 0x1f01, 0, 0, 0x1b01, 0, 0, 0x1e01, 0, 0, 0x1002, 0, 0, 0x1d01, 0, 0, 0x1c01, 0, 0, 0x010f, 0, 0, 0x0112, 0, 0, 0x0111, 0, 0, 0x0110, 0, 0, 0x0603, 0, 0, 0x0b02, 0, 0, 0x0e02, 0, 0, 0x0d02, 0, 0, 0x0c02, 0, 0, 0x0f02]), PICTURE_TYPE_I = 1, PICTURE_TYPE_P = 2, PICTURE_TYPE_B = 3, START_SEQUENCE = 0xB3, START_SLICE_FIRST = 0x01, START_SLICE_LAST = 0xAF, START_PICTURE = 0x00, START_EXTENSION = 0xB5, START_USER_DATA = 0xB2, SHADER_FRAGMENT_YCBCRTORGBA = ['precision mediump float;', 'uniform sampler2D YTexture;', 'uniform sampler2D CBTexture;', 'uniform sampler2D CRTexture;', 'varying vec2 texCoord;', 'void main() {', 'float y = texture2D(YTexture, texCoord).r;', 'float cr = texture2D(CBTexture, texCoord).r - 0.5;', 'float cb = texture2D(CRTexture, texCoord).r - 0.5;', 'gl_FragColor = vec4(', 'y + 1.4 * cr,', 'y + -0.343 * cb - 0.711 * cr,', 'y + 1.765 * cb,', '1.0', ');', '}'].join('\n'), SHADER_FRAGMENT_LOADING = ['precision mediump float;', 'uniform float loaded;', 'varying vec2 texCoord;', 'void main() {', 'float c = ceil(loaded-(1.0-texCoord.y));', 'gl_FragColor = vec4(c,c,c,1);', '}'].join('\n'), SHADER_VERTEX_IDENTITY = ['attribute vec2 vertex;', 'varying vec2 texCoord;', 'void main() {', 'texCoord = vertex;', 'gl_Position = vec4((vertex * 2.0 - 1.0) * vec2(1, -1), 0.0, 1.0);', '}'].join('\n');
    var D = [null, MACROBLOCK_TYPE_I, MACROBLOCK_TYPE_P, MACROBLOCK_TYPE_B];
    var E = function (a) {
        this.bytes = new Uint8Array(a);
        this.length = this.bytes.length;
        this.writePos = this.bytes.length;
        this.index = 0
    };
    E.NOT_FOUND = -1;
    E.prototype.findNextMPEGStartCode = function () {
        for (var i = (this.index + 7 >> 3); i < this.writePos; i++) {
            if (this.bytes[i] == 0x00 && this.bytes[i + 1] == 0x00 && this.bytes[i + 2] == 0x01) {
                this.index = (i + 4) << 3;
                return this.bytes[i + 3]
            }
        }
        this.index = (this.writePos << 3);
        return E.NOT_FOUND
    };
    E.prototype.nextBytesAreStartCode = function () {
        var i = (this.index + 7 >> 3);
        return (i >= this.writePos || (this.bytes[i] == 0x00 && this.bytes[i + 1] == 0x00 && this.bytes[i + 2] == 0x01))
    };
    E.prototype.nextBits = function (a) {
        var b = this.index >> 3, room = (8 - this.index % 8);
        if (room >= a) {
            return (this.bytes[b] >> (room - a)) & (0xff >> (8 - a))
        }
        var c = (this.index + a) % 8, end = (this.index + a - 1) >> 3, value = this.bytes[b] & (0xff >> (8 - room));
        for (b++; b < end; b++) {
            value <<= 8;
            value |= this.bytes[b]
        }
        if (c > 0) {
            value <<= c;
            value |= (this.bytes[b] >> (8 - c))
        } else {
            value <<= 8;
            value |= this.bytes[b]
        }
        return value
    };
    E.prototype.getBits = function (a) {
        var b = this.nextBits(a);
        this.index += a;
        return b
    };
    E.prototype.advance = function (a) {
        return (this.index += a)
    };
    E.prototype.rewind = function (a) {
        return (this.index -= a)
    }
})(window);