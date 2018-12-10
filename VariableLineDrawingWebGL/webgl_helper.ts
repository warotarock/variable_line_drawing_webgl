
class RenderShader {

    gl: WebGLRenderingContext;

    floatPrecisionDefinitionCode = '';
    vertexShaderSourceCode = '';
    fragmentShaderSourceCode = '';

    vertexShader: WebGLShader = null;
    fragmentShader: WebGLShader = null;
    program: WebGLProgram = null;

    attribLocationList = new List<int>();
    vertexAttribPointerOffset = 0;

    uPMatrix: WebGLUniformLocation = null;
    uMVMatrix: WebGLUniformLocation = null;

    initializeSourceCode(precisionText: string) {

        this.floatPrecisionDefinitionCode = '#ifdef GL_ES\n precision ' + precisionText + ' float;\n #endif\n';

        this.initializeVertexSourceCode();

        this.initializeFragmentSourceCode();
    }

    protected initializeVertexSourceCode() {

        // Override method
    }

    protected initializeFragmentSourceCode() {

        // Override method
    }

    initializeAttributes() {

        // Override method
    }

    protected getAttribLocation(name: string): int {

        let attribLocation = this.gl.getAttribLocation(this.program, name);
        this.attribLocationList.push(attribLocation);

        return attribLocation;
    }

    protected getUniformLocation(name: string): WebGLUniformLocation {

        return this.gl.getUniformLocation(this.program, name);
    }

    enableVertexAttributes() {

        for (let attribLocation of this.attribLocationList) {

            this.gl.enableVertexAttribArray(attribLocation);
        }
    }

    disableVertexAttributes() {

        for (let attribLocation of this.attribLocationList) {

            this.gl.disableVertexAttribArray(attribLocation);
        }
    }

    resetVertexAttribPointerOffset() {

        this.vertexAttribPointerOffset = 0;
    }

    vertexAttribPointer(indx: number, size: number, type: number, stride: number) {

        let gl = this.gl;

        if (type == gl.FLOAT || type == gl.INT) {

            gl.vertexAttribPointer(indx, size, type, false, stride, this.vertexAttribPointerOffset);
            this.vertexAttribPointerOffset += 4 * size;
        }
    }

    skipVertexAttribPointer(type: number, size: number) {

        let gl = this.gl;

        if (type == gl.FLOAT || type == gl.INT) {

            this.vertexAttribPointerOffset += 4 * size;
        }
    }

    setProjectionMatrix(matrix: Mat4) {

        this.gl.uniformMatrix4fv(this.uPMatrix, false, matrix);
    }

    setModelViewMatrix(matrix: Mat4) {

        this.gl.uniformMatrix4fv(this.uMVMatrix, false, matrix);
    }
}

class WebGLHelper {

    gl: WebGLRenderingContext = null;
    floatPrecisionText: string = '';

    initializeWebGL(canvas: HTMLCanvasElement): boolean {

        try {

            let option = { preserveDrawingBuffer: true, antialias: true };

            this.gl = <WebGLRenderingContext>(
                canvas.getContext('webgl', option)
                || canvas.getContext('experimental-webgl', option)
            );

            if (this.gl == null) {

                throw ('Faild to initialize WebGL.');
            }
        }
        catch (e) {

            return true;
        }

        let gl = this.gl;

        let format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        this.floatPrecisionText = format.precision != 0 ? 'highp' : 'mediump';

        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);

        return false;
    }

    initializeShader(shader: RenderShader) {

        let gl = this.gl;

        shader.gl = gl;

        shader.initializeSourceCode(this.floatPrecisionText);

        let program = gl.createProgram();
        let vertexShader = this.createShader(shader.vertexShaderSourceCode, true, gl);
        let fragmentShader = this.createShader(shader.fragmentShaderSourceCode, false, gl);

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
    }

    private createShader(glslSourceCode: string, isVertexShader: boolean, gl: WebGLRenderingContext): WebGLShader {

        let shader: WebGLShader;
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
    }

    releaseShader(shader: RenderShader) {

        let gl = this.gl;

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
    }
}
