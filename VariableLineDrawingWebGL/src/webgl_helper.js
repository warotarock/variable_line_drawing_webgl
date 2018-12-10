var RenderShader = /** @class */ (function () {
    function RenderShader() {
        this.floatPrecisionDefinitionCode = '';
        this.vertexShaderSourceCode = '';
        this.fragmentShaderSourceCode = '';
        this.vertexShader = null;
        this.fragmentShader = null;
        this.program = null;
        this.attribLocationList = new List();
        this.vertexAttribPointerOffset = 0;
        this.uPMatrix = null;
        this.uMVMatrix = null;
    }
    RenderShader.prototype.initializeSourceCode = function (precisionText) {
        this.floatPrecisionDefinitionCode = '#ifdef GL_ES\n precision ' + precisionText + ' float;\n #endif\n';
        this.initializeVertexSourceCode();
        this.initializeFragmentSourceCode();
    };
    RenderShader.prototype.initializeVertexSourceCode = function () {
        // Override method
    };
    RenderShader.prototype.initializeFragmentSourceCode = function () {
        // Override method
    };
    RenderShader.prototype.initializeAttributes = function () {
        // Override method
    };
    RenderShader.prototype.getAttribLocation = function (name) {
        var attribLocation = this.gl.getAttribLocation(this.program, name);
        this.attribLocationList.push(attribLocation);
        return attribLocation;
    };
    RenderShader.prototype.getUniformLocation = function (name) {
        return this.gl.getUniformLocation(this.program, name);
    };
    RenderShader.prototype.enableVertexAttributes = function () {
        for (var _i = 0, _a = this.attribLocationList; _i < _a.length; _i++) {
            var attribLocation = _a[_i];
            this.gl.enableVertexAttribArray(attribLocation);
        }
    };
    RenderShader.prototype.disableVertexAttributes = function () {
        for (var _i = 0, _a = this.attribLocationList; _i < _a.length; _i++) {
            var attribLocation = _a[_i];
            this.gl.disableVertexAttribArray(attribLocation);
        }
    };
    RenderShader.prototype.resetVertexAttribPointerOffset = function () {
        this.vertexAttribPointerOffset = 0;
    };
    RenderShader.prototype.vertexAttribPointer = function (indx, size, type, stride) {
        var gl = this.gl;
        if (type == gl.FLOAT || type == gl.INT) {
            gl.vertexAttribPointer(indx, size, type, false, stride, this.vertexAttribPointerOffset);
            this.vertexAttribPointerOffset += 4 * size;
        }
    };
    RenderShader.prototype.skipVertexAttribPointer = function (type, size) {
        var gl = this.gl;
        if (type == gl.FLOAT || type == gl.INT) {
            this.vertexAttribPointerOffset += 4 * size;
        }
    };
    RenderShader.prototype.setProjectionMatrix = function (matrix) {
        this.gl.uniformMatrix4fv(this.uPMatrix, false, matrix);
    };
    RenderShader.prototype.setModelViewMatrix = function (matrix) {
        this.gl.uniformMatrix4fv(this.uMVMatrix, false, matrix);
    };
    return RenderShader;
}());
var WebGLHelper = /** @class */ (function () {
    function WebGLHelper() {
        this.gl = null;
        this.floatPrecisionText = '';
    }
    WebGLHelper.prototype.initializeWebGL = function (canvas) {
        try {
            var option = { preserveDrawingBuffer: true, antialias: true };
            this.gl = (canvas.getContext('webgl', option)
                || canvas.getContext('experimental-webgl', option));
            if (this.gl == null) {
                throw ('Faild to initialize WebGL.');
            }
        }
        catch (e) {
            return true;
        }
        var gl = this.gl;
        var format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        this.floatPrecisionText = format.precision != 0 ? 'highp' : 'mediump';
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
        return false;
    };
    WebGLHelper.prototype.initializeShader = function (shader) {
        var gl = this.gl;
        shader.gl = gl;
        shader.initializeSourceCode(this.floatPrecisionText);
        var program = gl.createProgram();
        var vertexShader = this.createShader(shader.vertexShaderSourceCode, true, gl);
        var fragmentShader = this.createShader(shader.fragmentShaderSourceCode, false, gl);
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            shader.program = program;
            shader.vertexShader = vertexShader;
            shader.fragmentShader = fragmentShader;
            shader.initializeAttributes();
            return program;
        }
        else {
            alert(gl.getProgramInfoLog(program));
        }
    };
    WebGLHelper.prototype.createShader = function (glslSourceCode, isVertexShader, gl) {
        var shader;
        if (isVertexShader) {
            shader = gl.createShader(gl.VERTEX_SHADER);
        }
        else {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        }
        gl.shaderSource(shader, glslSourceCode);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            return shader;
        }
        else {
            alert(gl.getShaderInfoLog(shader));
        }
    };
    WebGLHelper.prototype.releaseShader = function (shader) {
        var gl = this.gl;
        if (shader.program != null) {
            gl.useProgram(null);
            gl.detachShader(shader.program, shader.vertexShader);
            gl.deleteShader(shader.vertexShader);
            shader.vertexShader = null;
            gl.detachShader(shader.program, shader.fragmentShader);
            gl.deleteShader(shader.fragmentShader);
            shader.fragmentShader = null;
            gl.deleteShader(shader.program);
            shader.program = null;
        }
    };
    return WebGLHelper;
}());
