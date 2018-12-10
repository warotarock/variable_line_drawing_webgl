
namespace VariableLineDrawingWebGL {

    class Main {

        webglHelder = new WebGLHelper();
        webglCanvas: HTMLCanvasElement = null;
        viewWidth = 0.0;
        viewHeight = 0.0;

        displayCanvas: HTMLCanvasElement = null;
        context2D: CanvasRenderingContext2D = null;

        linePoints = new List<LinePoint>();

        polyLineShader = new PolyLineShader();
        polyLine_VertexBuffer = new VertexBuffer();

        bezierLineShader = new BezierLineShader();
        bezierLine_VertexBuffer = new VertexBuffer();

        scale = vec3.create();
        direction = vec3.create();
        controlPointVec = vec3.create();
        normal = vec3.create();
        invMat = mat4.create();
        tempMat = mat4.create();

        relativeVecA = vec3.create();
        relativeVecB = vec3.create();
        relativeEdgePointVecA = vec3.create();
        relativeEdgePointVecB = vec3.create();

        eyeLocation = vec3.create();
        lookatLocation = vec3.create();
        upVector = vec3.create();
        modelLocation = vec3.create();

        modelMatrix = mat4.create();
        viewMatrix = mat4.create();
        modelViewMatrix = mat4.create();
        projectionMatrix = mat4.create();

        mouseX = 0.0;
        mouseY = 0.0;
        editPointIndex = 1;
        showPoints = false;

        isStressTestMode = false;
        testDataFileName = 'test_data.json';

        onLoad() {

            // 線データの作成

            this.linePoints.push(new LinePoint([-200.0, -10.0, 0.0], 2.0, 0.3));
            this.linePoints.push(new LinePoint([-50.0, -20.0, 0.0], 5.0, 1.0));
            this.linePoints.push(new LinePoint([100.0, 20.0, 0.0], 15.0, 0.7));
            this.linePoints.push(new LinePoint([200.0, 80.0, 0.0], 5.0, 0.5));
            this.linePoints.push(new LinePoint([220.0, 150.0, 0.0], 2.0, 0.0));

            this.mouseX = this.linePoints[this.editPointIndex].location[0];
            this.mouseY = this.linePoints[this.editPointIndex].location[1];

            // キャンバスとWebGLの初期化

            this.resizeWindow(null);

            if (this.webglHelder.initializeWebGL(this.webglCanvas)) {
                throw ('３Ｄ機能を初期化できませんでした。');
            }

            this.context2D = this.displayCanvas.getContext('2d');

            // シェーダの初期化

            this.webglHelder.initializeShader(this.polyLineShader);
            this.webglHelder.initializeShader(this.bezierLineShader);

            // 線モデルの頂点バッファを作成

            {
                let vertexUnitSize = this.polyLineShader.getVertexUnitSize();
                let vertexCount = (this.linePoints.length - 1) * (2 + 2) * 3; // 辺の数 * 左側２ポリゴン＋右側２ポリゴン * 3頂点
                this.allocateBuffer(this.polyLine_VertexBuffer, vertexCount, vertexUnitSize);
            }

            {
                let vertexUnitSize = this.bezierLineShader.getVertexUnitSize();
                let vertexCount = (this.linePoints.length - 1) * (4 + 4) * 3; // 辺の数 * 左側４ポリゴン＋右側４ポリゴン * 3頂点
                this.allocateBuffer(this.bezierLine_VertexBuffer, vertexCount, vertexUnitSize);
            }

            // 線モデルの頂点バッファの内容を計算し、頂点バッファにセット

            this.calculateLinePointEdgeLocation(this.linePoints);
            this.calculateLinePointBezierLocation(this.linePoints);
            this.calculateControlPointVertexLocations(this.linePoints);

            this.calculateVertexBuffer_PloyLine(this.linePoints, this.polyLine_VertexBuffer);
            this.updateBufferData(this.polyLine_VertexBuffer);

            this.calculateVertexBuffer_BezierLine(this.linePoints, this.bezierLine_VertexBuffer);
            this.updateBufferData(this.bezierLine_VertexBuffer);

            // ベントの設定
            this.setEvent();
        }

        allocateBuffer(vertexBuffer: VertexBuffer, vertexCount: int, vertexUnitSize: int) {

            let bufferSize = vertexCount * vertexUnitSize;

            if (bufferSize < vertexBuffer.bufferSize) {
                return;
            }

            let gl = this.webglHelder.gl;

            if (vertexBuffer.buffer != null) {

                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                gl.deleteBuffer(vertexBuffer.buffer);

                vertexBuffer.buffer = null;
            }

            vertexBuffer.buffer = gl.createBuffer();
            vertexBuffer.bufferSize = bufferSize;
            vertexBuffer.dataArray = new Float32Array(bufferSize);
        }

        updateBufferData(vertexBuffer: VertexBuffer) {

            let gl = this.webglHelder.gl;

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertexBuffer.dataArray, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }

        calculateLinePointEdgeLocation(linePoints: List<LinePoint>) {

            // 点の左右の頂点位置を計算
            for (let index = 0; index < linePoints.length; index++) {

                let linePoint = linePoints[index];

                let linePointPrev: LinePoint;
                let linePointNext: LinePoint;

                if (index == 0) {

                    // 最初の点は最初の点から次の点へのベクトルから計算
                    linePointPrev = linePoints[index];
                    linePointNext = linePoints[index + 1];
                }
                else if (index == linePoints.length - 1) {

                    // 最後の点は前の点から最後の点へのベクトルから計算
                    linePointPrev = linePoints[index - 1];
                    linePointNext = linePoints[index];

                    // 最後の点にはフラグを設定
                    linePoint.isEndPoint = true;
                }
                else {

                    // 中間の点は前の点から次の点へのベクトルから計算
                    linePointPrev = linePoints[index - 1];
                    linePointNext = linePoints[index + 1];
                }

                vec3.subtract(linePoint.direction, linePointNext.location, linePointPrev.location);
                vec3.normalize(this.direction, linePoint.direction);

                vec3.set(this.normal, this.direction[1], -this.direction[0], 0.0); // 90度回転したベクトル
                vec3.scale(this.normal, this.normal, linePoint.width);

                vec3.subtract(linePoint.edgePointL, linePoint.location, this.normal);
                vec3.add(linePoint.edgePointR, linePoint.location, this.normal);
            }
        }

        calculateLinePointBezierLocation(linePoints: List<LinePoint>) {

            // 中間の点の制御点の位置を計算

            for (let index = 0; index < linePoints.length - 1; index++) {

                let linePoint = linePoints[index];

                if (index < linePoints.length - 1) {

                    let linePointNext = linePoints[index + 1];

                    this.calculateSegmentMat(linePoint.pointMat, linePoint.location, linePointNext.location);
                    mat4.invert(linePoint.invMat, linePoint.pointMat);
                }

                if (index > 0 && index < linePoints.length - 1) {

                    let linePointPrev = linePoints[index - 1];
                    let linePointNext = linePoints[index + 1];

                    this.calculateControlPoint(
                        linePoint.controlPointCF,
                        linePoint.controlPointCB,
                        linePoint.direction,
                        linePoint.location,
                        linePointPrev.location,
                        linePointNext.location
                    );

                    this.calculateControlPoint(
                        linePoint.controlPointLF,
                        linePoint.controlPointLB,
                        linePoint.direction,
                        linePoint.edgePointL,
                        linePointPrev.edgePointL,
                        linePointNext.edgePointL
                    );

                    this.calculateControlPoint(
                        linePoint.controlPointRF,
                        linePoint.controlPointRB,
                        linePoint.direction,
                        linePoint.edgePointR,
                        linePointPrev.edgePointR,
                        linePointNext.edgePointR
                    );
                }
            }

            // 最初の点の制御点の位置を計算
            {
                let linePoint = linePoints[0];
                let linePointNext = linePoints[1];

                this.calculateMirroredControlPoint(
                    linePoint.controlPointCF,
                    linePointNext.controlPointCB,
                    linePointNext.location,
                    linePoint.location,
                    linePoint.pointMat,
                    linePoint.invMat
                );

                this.calculateSegmentMat(this.tempMat, linePoint.edgePointL, linePointNext.edgePointL);
                mat4.invert(this.invMat, this.tempMat);

                this.calculateMirroredControlPoint(
                    linePoint.controlPointLF,
                    linePointNext.controlPointLB,
                    linePointNext.edgePointL,
                    linePoint.edgePointL,
                    this.tempMat,
                    this.invMat
                );

                this.calculateSegmentMat(this.tempMat, linePoint.edgePointR, linePointNext.edgePointR);
                mat4.invert(this.invMat, this.tempMat);

                this.calculateMirroredControlPoint(
                    linePoint.controlPointRF,
                    linePointNext.controlPointRB,
                    linePointNext.edgePointR,
                    linePoint.edgePointR,
                    this.tempMat,
                    this.invMat
                );
            }

            // 最後の点の制御点の位置を計算
            {
                let linePoint = linePoints[linePoints.length - 1];
                let linePointNext = linePoints[linePoints.length - 2];

                this.calculateSegmentMat(linePoint.pointMat, linePoint.location, linePointNext.location);
                mat4.invert(linePoint.invMat, linePoint.pointMat);

                this.calculateMirroredControlPoint(
                    linePoint.controlPointCB,
                    linePointNext.controlPointCF,
                    linePointNext.location,
                    linePoint.location,
                    linePoint.pointMat,
                    linePoint.invMat
                );

                this.calculateSegmentMat(this.tempMat, linePoint.edgePointL, linePointNext.edgePointL);
                mat4.invert(this.invMat, this.tempMat);

                this.calculateMirroredControlPoint(
                    linePoint.controlPointLB,
                    linePointNext.controlPointLF,
                    linePointNext.edgePointL,
                    linePoint.edgePointL,
                    this.tempMat,
                    this.invMat
                );

                this.calculateSegmentMat(this.tempMat, linePoint.edgePointR, linePointNext.edgePointR);
                mat4.invert(this.invMat, this.tempMat);

                this.calculateMirroredControlPoint(
                    linePoint.controlPointRB,
                    linePointNext.controlPointRF,
                    linePointNext.edgePointR,
                    linePoint.edgePointR,
                    this.tempMat,
                    this.invMat
                );
            }
        }

        calculateSegmentMat_Direction = vec3.create();

        calculateSegmentMat(result: Mat4, locationFrom: Vec3, locationTo: Vec3) {

            vec3.subtract(this.calculateSegmentMat_Direction, locationTo, locationFrom);
            vec3.normalize(this.calculateSegmentMat_Direction, this.calculateSegmentMat_Direction);
            mat4.identity(result);
            result[0] = this.calculateSegmentMat_Direction[0];
            result[1] = this.calculateSegmentMat_Direction[1];
            result[4] = -this.calculateSegmentMat_Direction[1];
            result[5] = this.calculateSegmentMat_Direction[0];
            result[10] = 1.0;
            result[12] = locationFrom[0];
            result[13] = locationFrom[1];
        }

        calculateControlPoint(resultF: Vec3, resultB: Vec3, direction: Vec3, edgePointC: Vec3, edgePointB: Vec3, edgePointF: Vec3) {

            let distance = vec3.length(direction);
            let distanceB = vec3.distance(edgePointB, edgePointC);
            let distanceF = vec3.distance(edgePointF, edgePointC);
            let distanceBF = distanceB + distanceF;

            vec3.scale(this.controlPointVec, direction, (distanceF / distanceBF) * 0.33); // いいかげんです
            vec3.add(resultF, edgePointC, this.controlPointVec);

            vec3.scale(this.controlPointVec, direction, -(distanceB / distanceBF) * 0.33); // いいかげんです
            vec3.add(resultB, edgePointC, this.controlPointVec);
        }

        calculateMirroredControlPoint(resultF: Vec3, controlPointTo: Vec3, edgePointTo: Vec3, edgePointFrom: Vec3, pointMat: Mat4, invMat: Mat4) {

            vec3.subtract(this.relativeVecA, controlPointTo, edgePointTo);
            vec3.add(this.relativeVecA, this.relativeVecA, edgePointFrom);

            vec3.transformMat4(this.relativeVecB, this.relativeVecA, invMat);

            this.relativeVecB[0] *= -1;

            vec3.transformMat4(resultF, this.relativeVecB, pointMat);
        }

        calculateControlPointVertexLocations(linePoints: List<LinePoint>) {

            for (let index = 0; index < linePoints.length - 1; index++) {

                let linePoint = linePoints[index];
                let linePointNext = linePoints[index + 1];

                this.calculateControlPointVertexLocation(
                    linePoint.controlPointVertexLF,
                    linePoint.edgePointL,
                    linePoint.controlPointLF,
                    linePointNext.edgePointL,
                    linePointNext.controlPointLB,
                    1.0
                );

                this.calculateControlPointVertexLocation(
                    linePoint.controlPointVertexRF,
                    linePoint.edgePointR,
                    linePoint.controlPointRF,
                    linePointNext.edgePointR,
                    linePointNext.controlPointRB,
                    -1.0
                );
            }

            for (let index = 1; index < linePoints.length; index++) {

                let linePoint = linePoints[index];
                let linePointPrev = linePoints[index - 1];

                this.calculateControlPointVertexLocation(
                    linePoint.controlPointVertexLB,
                    linePoint.edgePointL,
                    linePoint.controlPointLB,
                    linePointPrev.edgePointL,
                    linePointPrev.controlPointLF,
                    -1.0
                );

                this.calculateControlPointVertexLocation(
                    linePoint.controlPointVertexRB,
                    linePoint.edgePointR,
                    linePoint.controlPointRB,
                    linePointPrev.edgePointR,
                    linePointPrev.controlPointRF,
                    1.0
                );
            }
        }

        calculateControlPointVertexLocation(controlPointVertexLF: Vec3, edgePointFrom: Vec3, controlPointFrom: Vec3, edgePointTo: Vec3, controlPointTo: Vec3, flipY: float) {

            this.calculateSegmentMat(this.tempMat, edgePointFrom, edgePointTo);
            mat4.invert(this.invMat, this.tempMat);

            vec3.transformMat4(this.relativeEdgePointVecA, edgePointFrom, this.invMat);
            vec3.transformMat4(this.relativeVecA, controlPointFrom, this.invMat);

            vec3.transformMat4(this.relativeVecB, controlPointTo, this.invMat);
            if (this.relativeVecB[1] * flipY < 0.0) {
                vec3.transformMat4(this.relativeVecB, edgePointTo, this.invMat);
            }

            let tiltX = this.relativeVecB[0] - this.relativeEdgePointVecA[0];
            let tiltY = this.relativeVecB[1] - this.relativeEdgePointVecA[1];

            if (tiltX == 0.0) {
                return;
            }

            let deltaX = this.relativeVecA[0] - this.relativeEdgePointVecA[0];
            let localY = (tiltY / tiltX) * deltaX + this.relativeEdgePointVecA[1];

            if (this.relativeVecA[1] * flipY < localY * flipY) {

                controlPointVertexLF[0] = this.relativeVecA[0];
                controlPointVertexLF[1] = localY;
                controlPointVertexLF[2] = 0.0;
                vec3.transformMat4(controlPointVertexLF, controlPointVertexLF, this.tempMat);
            }
            else {

                vec3.copy(controlPointVertexLF, controlPointFrom);
            }
        }

        // 1: location
        // 2: edgePointL, 3: controlPointVertexLF, 4: controlPointVertexLB
        // 5: edgePointR, 6: controlPointVertexRF, 7: controlPointVertexRB
        solidLinePolygonMap = [
            // 左側
            { cur: 1, loc: 2 }, { cur: 2, loc: 2 }, { cur: 1, loc: 5 },
            { cur: 1, loc: 5 }, { cur: 2, loc: 2 }, { cur: 2, loc: 5 },
        ];

        bezierPolygonMap = [
            // 左側
            { lr: 1, cur: 1, loc: 1 }, { lr: 1, cur: 1, loc: 2 }, { lr: 1, cur: 1, loc: 3 },
            { lr: 1, cur: 1, loc: 3 }, { lr: 1, cur: 2, loc: 4 }, { lr: 1, cur: 1, loc: 1 },
            { lr: 1, cur: 1, loc: 1 }, { lr: 1, cur: 2, loc: 4 }, { lr: 1, cur: 2, loc: 1 },
            { lr: 1, cur: 2, loc: 1 }, { lr: 1, cur: 2, loc: 4 }, { lr: 1, cur: 2, loc: 2 },
            // 右側
            { lr: 2, cur: 1, loc: 5 }, { lr: 2, cur: 1, loc: 1 }, { lr: 2, cur: 1, loc: 6 },
            { lr: 2, cur: 1, loc: 6 }, { lr: 2, cur: 1, loc: 1 }, { lr: 2, cur: 2, loc: 7 },
            { lr: 2, cur: 2, loc: 7 }, { lr: 2, cur: 1, loc: 1 }, { lr: 2, cur: 2, loc: 1 },
            { lr: 2, cur: 2, loc: 1 }, { lr: 2, cur: 2, loc: 5 }, { lr: 2, cur: 2, loc: 7 },
        ];

        calculateVertexBuffer_PloyLine(linePoints: List<LinePoint>, vertexBuffer: VertexBuffer) {

            // バッファにセットする頂点データを作成
            let offset = 0;
            let data = vertexBuffer.dataArray;
            for (let index = 0; index < linePoints.length - 1; index++) {

                let linePoint = linePoints[index];
                let linePointNext = linePoints[index + 1];

                for (let map of this.solidLinePolygonMap) {

                    let point: LinePoint;
                    if (map.cur == 1) {
                        point = linePoint;
                    }
                    else {
                        point = linePointNext;
                    }

                    let vec: Vec3;
                    if (map.loc == 1) {
                        vec = point.location;
                    }
                    else if (map.loc == 2) {
                        vec = point.edgePointL;
                    }
                    else if (map.loc == 5) {
                        vec = point.edgePointR;
                    }

                    data[offset++] = vec[0];
                    data[offset++] = vec[1];
                    data[offset++] = point.alpha;
                }
            }
        }

        calculateVertexBuffer_BezierLine(linePoints: List<LinePoint>, vertexBuffer: VertexBuffer) {

            // バッファにセットする頂点データを作成
            let offset = 0;
            let data = vertexBuffer.dataArray;
            for (let index = 0; index < linePoints.length - 1; index++) {

                let linePoint = linePoints[index];
                let linePointNext = linePoints[index + 1];

                if (linePoint.isEndPoint) {
                    continue;
                }

                for (let map of this.bezierPolygonMap) {

                    let point: LinePoint; 
                    if (map.cur == 1) {
                        point = linePoint;
                    }
                    else {
                        point = linePointNext;
                    }

                    let vec: Vec3;
                    if (map.loc == 1) {
                        vec = point.location;
                    }
                    else if (map.loc == 2) {
                        vec = point.edgePointL;
                    }
                    else if (map.loc == 3) {
                        vec = point.controlPointVertexLF;
                    }
                    else if (map.loc == 4) {
                        vec = point.controlPointVertexLB;
                    }
                    else if (map.loc == 5) {
                        vec = point.edgePointR;
                    }
                    else if (map.loc == 6) {
                        vec = point.controlPointVertexRF;
                    }
                    else if (map.loc == 7) {
                        vec = point.controlPointVertexRB;
                    }

                    data[offset++] = vec[0];
                    data[offset++] = vec[1];

                    let flipY = (map.lr == 1 ? 1.0 : -1.0);
                    let flip = false;

                    // セグメントローカル座標 x, y
                    vec3.transformMat4(this.relativeVecA, vec, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1] * (flip ? flipY : 1.0);

                    // セグメントローカル t (0.0 -> 1.0)
                    let length = vec3.distance(linePoint.location, linePointNext.location);
                    data[offset++] = this.relativeVecA[0] / length;

                    vec3.transformMat4(this.relativeVecA, linePoint.edgePointL, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    vec3.transformMat4(this.relativeVecA, linePoint.controlPointLF, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    vec3.transformMat4(this.relativeVecA, linePointNext.controlPointLB, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    vec3.transformMat4(this.relativeVecA, linePointNext.edgePointL, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    vec3.transformMat4(this.relativeVecA, linePoint.edgePointR, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    vec3.transformMat4(this.relativeVecA, linePoint.controlPointRF, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    vec3.transformMat4(this.relativeVecA, linePointNext.controlPointRB, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    vec3.transformMat4(this.relativeVecA, linePointNext.edgePointR, linePoint.invMat);
                    data[offset++] = this.relativeVecA[0];
                    data[offset++] = this.relativeVecA[1];

                    data[offset++] = linePoint.width;
                    data[offset++] = linePointNext.width;

                    data[offset++] = linePoint.alpha;
                    data[offset++] = linePointNext.alpha;
                }
            }
        }

        run() {

            if (!this.isStressTestMode) {

                this.run_LineView();
            }
            else {

                this.run_StressTest();
            }
        }

        run_LineView() {

            // 入力の受付

            {

                let location = this.linePoints[this.editPointIndex].location;
                location[0] += (this.mouseX - location[0]) * 0.2;
                location[1] += (this.mouseY - location[1]) * 0.2;

                // バッファの再計算
                this.calculateLinePointEdgeLocation(this.linePoints);
                this.calculateLinePointBezierLocation(this.linePoints);
                this.calculateControlPointVertexLocations(this.linePoints);

                this.calculateVertexBuffer_PloyLine(this.linePoints, this.polyLine_VertexBuffer);
                this.updateBufferData(this.polyLine_VertexBuffer);

                this.calculateVertexBuffer_BezierLine(this.linePoints, this.bezierLine_VertexBuffer);
                this.updateBufferData(this.bezierLine_VertexBuffer);
            }

            // 画面のクリア

            let gl = this.webglHelder.gl;

            gl.viewport(0.0, 0.0, this.viewWidth, this.viewHeight);
            gl.disable(gl.CULL_FACE);
            gl.clearColor(1.0, 1.0, 0.98, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // カメラ行列の計算

            vec3.set(this.lookatLocation, 0.0, 0.0, 0.0);
            vec3.set(this.upVector, 0.0, 1.0, 0.0);
            vec3.set(this.eyeLocation, 0.0, 0.0, 1.0);

            mat4.lookAt(this.viewMatrix, this.eyeLocation, this.lookatLocation, this.upVector);

            let orthoWidth = this.viewWidth / 2;
            let aspect = this.viewHeight / this.viewWidth;
            mat4.ortho(this.projectionMatrix, -orthoWidth, orthoWidth, -orthoWidth * aspect, orthoWidth * aspect, 0.1, 1.0);

            vec3.set(this.scale, 1.0, 1.0, 1.0);
            mat4.scale(this.projectionMatrix, this.projectionMatrix, this.scale);

            // 描画

            {

                vec3.set(this.modelLocation, 50.0, -100.0, 0.0);

                mat4.identity(this.modelMatrix);
                mat4.translate(this.modelMatrix, this.modelMatrix, this.modelLocation);

                mat4.multiply(this.modelViewMatrix, this.viewMatrix, this.modelMatrix);

                gl.useProgram(this.polyLineShader.program);

                this.polyLineShader.setModelViewMatrix(this.modelViewMatrix);
                this.polyLineShader.setProjectionMatrix(this.projectionMatrix);

                this.polyLineShader.setVertexBuffer(this.polyLine_VertexBuffer);

                let drawCount = this.polyLineShader.getDrawArrayTryanglesCount(this.polyLine_VertexBuffer.bufferSize);
                gl.drawArrays(gl.TRIANGLES, 0, drawCount);
            }

            {
                vec3.set(this.modelLocation, 0.0, 0.0, 0.0);

                mat4.identity(this.modelMatrix);
                mat4.translate(this.modelMatrix, this.modelMatrix, this.modelLocation);

                mat4.multiply(this.modelViewMatrix, this.viewMatrix, this.modelMatrix);

                gl.useProgram(this.bezierLineShader.program);

                this.bezierLineShader.setModelViewMatrix(this.modelViewMatrix);
                this.bezierLineShader.setProjectionMatrix(this.projectionMatrix);

                this.bezierLineShader.setVertexBuffer(this.bezierLine_VertexBuffer);

                let drawCount = this.bezierLineShader.getDrawArrayTryanglesCount(this.bezierLine_VertexBuffer.bufferSize);
                gl.drawArrays(gl.TRIANGLES, 0, drawCount);
            }

            // 制御点の表示
            let context2D = this.context2D;

            context2D.setTransform(1.0, 0.0, 0.0, 1.0, 0.0, 0.0);
            context2D.clearRect(0, 0, this.viewWidth, this.viewHeight);

            context2D.setTransform(1.0, 0.0, 0.0, -1.0, this.viewWidth / 2, this.viewHeight / 2);

            context2D.fillStyle = this.getColorStyleText(1.0, 0.5, 0.0, 0.5);
            this.fillCircle(this.linePoints[this.editPointIndex].location, this.modelLocation, 10.0, context2D);

            if (this.showPoints) {

                context2D.strokeStyle = this.getColorStyleText(0.5, 0.5, 0.5, 1.0);
                for (let linePoint of this.linePoints) {

                    this.drawCircle(linePoint.location, this.modelLocation, 3.0, context2D);
                }

                context2D.strokeStyle = this.getColorStyleText(0.5, 0.5, 0.5, 1.0);
                for (let linePoint of this.linePoints) {

                    this.drawCircle(linePoint.edgePointL, this.modelLocation, 3.0, context2D);
                    this.drawCircle(linePoint.edgePointR, this.modelLocation, 3.0, context2D);
                }

                context2D.strokeStyle = this.getColorStyleText(0.0, 0.8, 0.0, 1.0);
                for (let linePoint of this.linePoints) {

                    //this.drawCircle(linePoint.controlPointCF, this.modelLocation, 3.0, context2D);
                    //this.drawCircle(linePoint.controlPointCB, this.modelLocation, 3.0, context2D);

                    this.drawCircle(linePoint.controlPointLF, this.modelLocation, 3.0, context2D);
                    this.drawCircle(linePoint.controlPointLB, this.modelLocation, 3.0, context2D);

                    this.drawCircle(linePoint.controlPointRF, this.modelLocation, 3.0, context2D);
                    this.drawCircle(linePoint.controlPointRB, this.modelLocation, 3.0, context2D);
                }

                context2D.strokeStyle = this.getColorStyleText(1.0, 0.0, 0.0, 1.0);
                for (let linePoint of this.linePoints) {

                    this.drawCircle(linePoint.controlPointVertexLF, this.modelLocation, 2.0, context2D);
                    this.drawCircle(linePoint.controlPointVertexRF, this.modelLocation, 2.0, context2D);
                }

                context2D.strokeStyle = this.getColorStyleText(1.0, 0.5, 0.0, 1.0);
                for (let linePoint of this.linePoints) {

                    this.drawCircle(linePoint.controlPointVertexLB, this.modelLocation, 2.0, context2D);
                    this.drawCircle(linePoint.controlPointVertexRB, this.modelLocation, 2.0, context2D);
                }

                // debug ************
                //context2D.fillStyle = this.getColorStyleText(0.0, 0.0, 0.0, 1.0);
                //this.fillCircle([0.0, 0.0, 0.0], this.modelLocation, 3.0, context2D);
                //context2D.fillStyle = this.getColorStyleText(1.0, 0.0, 0.0, 1.0);
                //this.fillCircle(this.linePoints[0].controlPointVertexLF, this.modelLocation, 3.0, context2D);
                //context2D.fillStyle = this.getColorStyleText(0.0, 0.0, 1.0, 1.0);
                //this.fillCircle(this.linePoints[0].controlPointRF, this.modelLocation, 3.0, context2D);
                // debug ************
            }
        }

        animationTime = 0.0;

        run_StressTest() {

            vec3.set(this.modelLocation, this.mouseX * 5.0, this.mouseY * 5.0, 0.0);

            // 画面のクリア

            let gl = this.webglHelder.gl;

            gl.viewport(0.0, 0.0, this.viewWidth, this.viewHeight);
            gl.disable(gl.CULL_FACE);
            gl.clearColor(1.0, 1.0, 0.98, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            let context2D = this.context2D;

            context2D.setTransform(1.0, 0.0, 0.0, 1.0, 0.0, 0.0);
            context2D.clearRect(0, 0, this.viewWidth, this.viewHeight);

            // カメラ行列の計算

            vec3.set(this.lookatLocation, 0.0, 0.0, 0.0);
            vec3.set(this.upVector, 0.0, 1.0, 0.0);
            vec3.set(this.eyeLocation, 0.0, 0.0, 1.0);

            mat4.lookAt(this.viewMatrix, this.eyeLocation, this.lookatLocation, this.upVector);

            let orthoWidth = this.viewWidth / 2;
            let aspect = this.viewHeight / this.viewWidth;
            mat4.ortho(this.projectionMatrix, -orthoWidth, orthoWidth, -orthoWidth * aspect, orthoWidth * aspect, 0.1, 1.0);

            vec3.set(this.scale, 1.0, 1.0, 1.0);
            mat4.scale(this.projectionMatrix, this.projectionMatrix, this.scale);

            // 描画

            {
                mat4.identity(this.modelMatrix);
                mat4.translate(this.modelMatrix, this.modelMatrix, this.modelLocation);

                this.animationTime += 0.01;
                let scale = (1.06 + Math.cos(this.animationTime)) * 5.0;
                vec3.set(this.scale, scale, scale, 1.0);
                mat4.scale(this.modelMatrix, this.modelMatrix, this.scale);
                mat4.rotateZ(this.modelMatrix, this.modelMatrix, Math.cos(this.animationTime * 5.0) * 0.2);

                mat4.multiply(this.modelViewMatrix, this.viewMatrix, this.modelMatrix);

                gl.useProgram(this.bezierLineShader.program);

                this.bezierLineShader.setModelViewMatrix(this.modelViewMatrix);
                this.bezierLineShader.setProjectionMatrix(this.projectionMatrix);

                this.bezierLineShader.setVertexBuffer(this.bezierLine_VertexBuffer);

                let drawCount = this.bezierLineShader.getDrawArrayTryanglesCount(this.bezierLine_VertexBuffer.bufferSize);
                gl.drawArrays(gl.TRIANGLES, 0, drawCount);
            }
        }

        drawCircle(location: Vec3, modelLocation: Vec3, radius: float, context2D: CanvasRenderingContext2D) {

            if (location[0] == 0 && location[1] == 0) {
                return;
            }

            let x = location[0] + modelLocation[0];
            let y = location[1] + modelLocation[1];
            context2D.beginPath();
            context2D.arc(x, y, radius, 0.0, Math.PI * 2.0);
            context2D.stroke();
        }

        fillCircle(location: Vec3, modelLocation: Vec3, radius: float, context2D: CanvasRenderingContext2D) {

            let x = location[0] + modelLocation[0];
            let y = location[1] + modelLocation[1];
            context2D.beginPath();
            context2D.arc(x, y, radius, 0.0, Math.PI * 2.0);
            context2D.fill();
        }

        getColorStyleText(r: float, g: float, b: float, a: float) {

            return 'rgba(' + (r * 255).toFixed(0) + ',' + (g * 255).toFixed(0) + ',' + (b * 255).toFixed(0) + ',' + (a).toFixed(2) + ')';
        }

        setEvent() {

            window.addEventListener('resize', (e: Event) => {
                this.resizeWindow(e);
            });

            this.displayCanvas.addEventListener('mousedown', (e: MouseEvent) => {

                this.setMousePosition(e.offsetX, e.offsetY);
            });

            this.displayCanvas.addEventListener('mousemove', (e: MouseEvent) => {

                if (e.buttons != 0) {
                    this.setMousePosition(e.offsetX, e.offsetY);
                }
            });

            this.displayCanvas.addEventListener('touchstart', (e: TouchEvent) => {

                if (e.touches.length > 0) {
                    this.setMousePosition(e.touches[0].clientX, e.touches[0].clientY);

                    e.preventDefault();
                }
            });

            this.displayCanvas.addEventListener('touchmove', (e: TouchEvent) => {

                if (e.touches.length > 0) {
                    this.setMousePosition(e.touches[0].clientX, e.touches[0].clientY);

                    e.preventDefault();
                }
            });

            document.getElementById('editPointTarget').addEventListener('click', (e: Event) => {

                this.editPointIndex = (this.editPointIndex + 1) % this.linePoints.length;
                this.mouseX = this.linePoints[this.editPointIndex].location[0];
                this.mouseY = this.linePoints[this.editPointIndex].location[1];
            });

            document.getElementById('hidePoints').addEventListener('click', (e: Event) => {

                this.showPoints = !this.showPoints;
            });

            document.getElementById('stressTest').addEventListener('click', (e: Event) => {

                this.setMousePosition(this.viewWidth / 2.0, this.viewHeight / 2.0);

                let url = this.testDataFileName;
                let xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.responseType = 'json';

                xhr.addEventListener('load',
                    (e: Event) => {

                        let data: any;
                        if (xhr.responseType == 'json') {
                            data = xhr.response;
                        }
                        else {
                            data = JSON.parse(xhr.response);
                        }

                        this.importTestData(data);
                    }
                );

                xhr.send();
            });
        }

        setMousePosition(x: float, y: float) {

            this.mouseX = x - this.viewWidth / 2;
            this.mouseY = -(y - this.viewHeight / 2);
        }

        resizeWindow(e: Event) {

            this.viewWidth = this.webglCanvas.parentElement.clientWidth
            this.viewHeight = this.webglCanvas.parentElement.clientHeight

            this.webglCanvas.width = this.viewWidth;
            this.webglCanvas.height = this.viewHeight;

            this.displayCanvas.width = this.viewWidth;
            this.displayCanvas.height = this.viewHeight;
        }

        importTestData(data: any) {

            this.linePoints = new List<LinePoint>();
            this.importTestDataRecursive(data.rootLayer, this.linePoints);

            let vertexUnitSize = this.bezierLineShader.getVertexUnitSize();
            let vertexCount = (this.linePoints.length - 1) * (4 + 4) * 3; // 辺の数 * 左側４ポリゴン＋右側４ポリゴン * 3頂点
            this.allocateBuffer(this.bezierLine_VertexBuffer, vertexCount, vertexUnitSize);

            this.calculateVertexBuffer_BezierLine(this.linePoints, this.bezierLine_VertexBuffer);
            this.updateBufferData(this.bezierLine_VertexBuffer);

            this.isStressTestMode = true;
        }

        lastLocation = vec3.create();

        importTestDataRecursive(layer: any, linePoints: List<LinePoint>) {

            for (let childLayer of layer.childLayers) {

                if (!childLayer.isVisible) {
                    continue;
                }

                if (childLayer.type == 2) { // VectorLayer

                    let keyFrame = null;

                    for (let search_Keyframe of childLayer.keyframes) {

                        if (search_Keyframe.geometry.groups.length > 0) {

                            keyFrame = search_Keyframe;
                            break;
                        }
                    }

                    if (keyFrame == null) {
                        continue;
                    }

                    for (let group of keyFrame.geometry.groups) {

                        for (let line of group.lines) {

                            let singleLine_Points = new List<LinePoint>();

                            for (let point of line.points) {

                                point.location[1] *= -1.0;

                                if (vec3.distance(point.location, this.lastLocation) > 0.1) {

                                    singleLine_Points.push(new LinePoint(point.location, point.lineWidth, 1.0));

                                    vec3.copy(this.lastLocation, point.location);
                                }
                            }

                            if (singleLine_Points.length > 3) {

                                // デモ用に線の太さと透明度を変えて線の入りと抜きを表現してみる
                                singleLine_Points[0].width *= 0.3;
                                singleLine_Points[0].alpha = 0.3;
                                singleLine_Points[singleLine_Points.length - 1].width *= 0.3;
                                singleLine_Points[singleLine_Points.length - 1].alpha = 0.3;

                                this.calculateLinePointEdgeLocation(singleLine_Points);
                                this.calculateLinePointBezierLocation(singleLine_Points);
                                this.calculateControlPointVertexLocations(singleLine_Points);

                                ListAddRange(linePoints, singleLine_Points);
                            }
                        }
                    }
                }
                else if (childLayer.type == 3) { // GroupLayer

                    this.importTestDataRecursive(childLayer, this.linePoints);
                }
            }
        }
    }

    class VertexBuffer {

        bufferSize = 0;
        buffer: WebGLBuffer = null;
        dataArray: Float32Array = null;
    }

    class LinePoint {

        location: Vec3 = null;
        width = 1.0;
        alpha = 1.0;

        direction = vec3.fromValues(0.0, 0.0, 0.0);
        controlPointCF = vec3.fromValues(0.0, 0.0, 0.0); // 正方向への制御点の位置
        controlPointCB = vec3.fromValues(0.0, 0.0, 0.0); // 逆方向への制御点の位置

        edgePointL = vec3.fromValues(0.0, 0.0, 0.0);     // 点の左側の頂点の位置
        controlPointLF = vec3.fromValues(0.0, 0.0, 0.0); // 左側の頂点から正方向への制御点の位置
        controlPointLB = vec3.fromValues(0.0, 0.0, 0.0); // 左側の頂点から逆方向への制御点の位置

        edgePointR = vec3.fromValues(0.0, 0.0, 0.0);     // 点の右側の頂点の位置
        controlPointRF = vec3.fromValues(0.0, 0.0, 0.0); // 右側の頂点から正方向への制御点の位置
        controlPointRB = vec3.fromValues(0.0, 0.0, 0.0); // 右側の頂点から逆方向への制御点の位置

        controlPointVertexLF = vec3.fromValues(0.0, 0.0, 0.0); // 曲線を囲むように配置したポリゴンの頂点座標
        controlPointVertexLB = vec3.fromValues(0.0, 0.0, 0.0);
        controlPointVertexRF = vec3.fromValues(0.0, 0.0, 0.0);
        controlPointVertexRB = vec3.fromValues(0.0, 0.0, 0.0);

        pointMat = mat4.create();
        invMat = mat4.create();

        isEndPoint = false;

        constructor(loc: Vec3, width: float, alpha: float) {

            this.location = loc;
            this.width = width;
            this.alpha = alpha;
        }
    }

    export class PolyLineShader extends RenderShader {

        protected aPosition = -1;
        protected aAlpha = -1;

        getVertexUnitSize(): int {

            return (
                2 // 頂点の位置 vec2
                + 1 // 不透明度 float
            );
        }

        getDrawArrayTryanglesCount(bufferSize: int): int {

            return bufferSize / this.getVertexUnitSize();
        }

        initializeVertexSourceCode() {

            this.vertexShaderSourceCode = [
                this.floatPrecisionDefinitionCode,

                'attribute vec2 aPosition;',
                'attribute float aAlpha;',

                'uniform mat4 uPMatrix;',
                'uniform mat4 uMVMatrix;',

                'varying float vAlpha;',

                'void main(void) {',

                '	   gl_Position = uPMatrix * uMVMatrix * vec4(aPosition, 0.5, 1.0);',
                '	   vAlpha = aAlpha;',
                '}',
                ''].join('\n');
        }

        initializeFragmentSourceCode() {

            this.fragmentShaderSourceCode = [
                this.floatPrecisionDefinitionCode,

                'varying float vAlpha;',

                'void main(void) {',

                '    gl_FragColor = vec4(1.0, 0.8, 0.5, vAlpha * 0.2);',
                
                '}',
                ''].join('\n');
        }

        initializeAttributes() {

            let gl = this.gl;

            this.uPMatrix = this.getUniformLocation('uPMatrix');
            this.uMVMatrix = this.getUniformLocation('uMVMatrix');

            this.aPosition = this.getAttribLocation('aPosition');
            this.aAlpha = this.getAttribLocation('aAlpha');
        }

        setVertexBuffer(vertexBuffer: VertexBuffer) {

            let gl = this.gl;

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);

            this.enableVertexAttributes();
            this.resetVertexAttribPointerOffset();

            let vertexDataStride = 4 * this.getVertexUnitSize();

            this.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aAlpha, 1, gl.FLOAT, vertexDataStride);
        }
    }

    export class BezierLineShader extends RenderShader {

        protected aPosition = -1;
        protected aLocalPosition = -1;

        protected aLinePoint1 = -1;
        protected aControlPoint1 = -1;
        protected aLinePoint2 = -1;
        protected aControlPoint2 = -1;

        protected aLinePoint1R = -1;
        protected aControlPoint1R = -1;
        protected aLinePoint2R = -1;
        protected aControlPoint2R = -1;

        protected aWidth = -1;
        protected aAlpha = -1;

        getVertexUnitSize(): int {

            return (
                2 // 頂点位置 vec2
                + 3 // ローカル空間座標 vec3 (x, y, t)

                + 2 // 頂点１ vec2
                + 2 // 制御点１ vec2
                + 2 // 制御点２ vec2
                + 2 // 頂点２ vec2

                + 2 // 頂点１R vec2
                + 2 // 制御点１R vec2
                + 2 // 制御点２R vec2
                + 2 // 頂点２R vec2

                + 2 // 太さ vec2 (from, to)
                + 2 // 不透明度 vec2 (from, to)
            );
        }

        getDrawArrayTryanglesCount(bufferSize: int): int {

            return bufferSize / this.getVertexUnitSize();
        }

        initializeVertexSourceCode() {

            this.vertexShaderSourceCode = [
                this.floatPrecisionDefinitionCode,

                'attribute vec2 aPosition;',
                'attribute vec3 aLocalPosition;',

                'attribute vec2 aLinePoint1;',
                'attribute vec2 aControlPoint1;',
                'attribute vec2 aControlPoint2;',
                'attribute vec2 aLinePoint2;',

                'attribute vec2 aLinePoint1R;',
                'attribute vec2 aControlPoint1R;',
                'attribute vec2 aControlPoint2R;',
                'attribute vec2 aLinePoint2R;',

                'attribute vec2 aWidth;',
                'attribute vec2 aAlpha;',

                'uniform mat4 uPMatrix;',
                'uniform mat4 uMVMatrix;',

                'varying vec3 vLocalPosition;',

                'varying vec2 vLinePoint1;',
                'varying vec2 vControlPoint1;',
                'varying vec2 vControlPoint2;',
                'varying vec2 vLinePoint2;',

                'varying vec2 vLinePoint1R;',
                'varying vec2 vControlPoint1R;',
                'varying vec2 vControlPoint2R;',
                'varying vec2 vLinePoint2R;',

                'varying vec2 vWidth;',
                'varying vec2 vAlpha;',

                'void main(void) {',

                '	   gl_Position = uPMatrix * uMVMatrix * vec4(aPosition, 0.5, 1.0);',

                '	   vLocalPosition = aLocalPosition;',

                '	   vLinePoint1 = aLinePoint1;',
                '	   vControlPoint1 = aControlPoint1;',
                '	   vControlPoint2 = aControlPoint2;',
                '	   vLinePoint2 = aLinePoint2;',

                '	   vLinePoint1R = aLinePoint1R;',
                '	   vControlPoint1R = aControlPoint1R;',
                '	   vControlPoint2R = aControlPoint2R;',
                '	   vLinePoint2R = aLinePoint2R;',

                '	   vWidth = aWidth;',
                '	   vAlpha = aAlpha;',
                '}',
                ''].join('\n');
        }

        initializeFragmentSourceCode() {

            this.fragmentShaderSourceCode = [
                this.floatPrecisionDefinitionCode,

                'float cubeRoot(float x) {',
                '',
                '    float res = pow(abs(x), 1.0 / 3.0);',
                '    return (x >= 0.0) ? res : -res;',
                '}',

                'void solveQuadraticEquation(out vec3 solution, float a, float b, float c) {',
                '',
                '    float d;',
                '    float x1;',
                '    float x2;',
                '',
                '    if (a == 0.0) {',
                '',
                '        solution[0] = -c / b;',
                '        solution[1] = -1.0;',
                '        return;',
                '    }',

                '    d = b * b - 4.0 * a * c;',

                '    if (d > 0.0) {',
                '',
                '        if (b < 0.0) {',
                '',
                '            x1 = (-b - sqrt(d)) / 2.0 / a;',
                '            x2 = -b / a - x1;',
                '        }',
                '        else {',
                '',
                '            x1 = (-b + sqrt(d)) / 2.0 / a;',
                '            x2 = -b / a - x1;',
                '        }',
                '',
                '        solution[0] = x1;',
                '        solution[1]= x2;',
                '    }',
                '    else if (d == 0.0) {',
                '',
                '        solution[0] = -b / 2.0 / a;',
                '        solution[1] = -1.0;',
                '    }',
                '    else {',
                '',
                '        // imaginary root',
                '    }',
                '}',

                'void solveCubicEquation(out vec3 solution, float a, float b, float c, float d) {',

                '  float PI = 3.14159265358979323846264;',
                '  float p;',
                '  float q;',
                '  float t;',
                '  float a3;',
                '  float b3;',

                '  if (a == 0.0) {;',
                '    solveQuadraticEquation(solution, b, c, d);',
                '    return;',
                '  }',

                '  b /= 3.0 * a;',
                '  c /= a;',
                '  d /= a;',
                '  p = b * b - c / 3.0;',
                '  q = (b * (c - 2.0 * b * b) - d) / 2.0;',

                '  a = q * q - p * p * p;',

                '  if (a == 0.0) {',
                '  ',
                '    q = cubeRoot(q);',
                '    solution[0] = 2.0 * q - b;',
                '    solution[1] = -q - b;',
                '    solution[2] = -1.0;',
                '  }',
                '  else if (a > 0.0) {',

                '    float sign = 1.0;',
                '    if (q <= 0.0) { sign = -1.0; }',
                '    a3 = cubeRoot(q + (sign) * sqrt(a));',
                '    b3 = p / a3;',
                '    solution[0] = a3 + b3 - b;',
                '    solution[1] = -1.0;',
                '    solution[2] = -1.0;',
                '  }',
                '  else {',
                '  ',
                '    a = 2.0 * sqrt(p);',
                '    t = acos(q / (p * a / 2.0));',
                '    solution[0] = a * cos(t / 3.0) - b;',
                '    solution[1] = a * cos((t + 2.0 * PI) / 3.0) - b;',
                '    solution[2] = a * cos((t + 4.0 * PI) / 3.0) - b;',
                '  }',
                '}',

                'float calcBezierTimeInSection(float x1, float x2, float x3, float x4, float targetX) {',

                '    vec3 solution = vec3(0.0, 0.0, 0.0);',
                '    float a = x4 - 3.0 * (x3 - x2) - x1;',
                '    float b = 3.0 * (x3 - 2.0 * x2 + x1);',
                '    float c = 3.0 * (x2 - x1);',
                '    float d = x1 - targetX;',

                '    solveCubicEquation(solution, a, b, c, d);',

                '    if (solution[0] >= -0.1 && solution[0] <= 1.0) {',
                '        return solution[0];',
                '    }',
                '    else if (solution[1] >= 0.0 && solution[1] <= 1.0) {',
                '        return solution[1];',
                '    }',
                '    else if (solution[2] >= 0.0 && solution[2] <= 1.0) {',
                '        return solution[2];',
                '    }',
                '    else {',
                '        return -1.0;',
                '    }',
                '}',

                'float calcInterpolationBezier(float x1, float x2, float x3, float x4, float t) {',
                '',
                '    return (1.0 - t) * (1.0 - t) * (1.0 - t) * x1 +',
                '        3.0 * (1.0 - t) * (1.0 - t) * t * x2 +',
                '        3.0 * (1.0 - t) * t * t * x3 +',
                '        t * t * t * x4;',
                '}',

                'varying vec3 vLocalPosition;',

                'varying vec2 vLinePoint1;',
                'varying vec2 vControlPoint1;',
                'varying vec2 vControlPoint2;',
                'varying vec2 vLinePoint2;',

                'varying vec2 vLinePoint1R;',
                'varying vec2 vControlPoint1R;',
                'varying vec2 vControlPoint2R;',
                'varying vec2 vLinePoint2R;',

                'varying vec2 vWidth;',
                'varying vec2 vAlpha;',

                'void main(void) {',

                '    float t1 = calcBezierTimeInSection(',
                '        vLinePoint1.x,',
                '        vControlPoint1.x,',
                '        vControlPoint2.x,',
                '        vLinePoint2.x,',
                '        vLocalPosition.x',
                '    );',
                '    float y1;',
                '    if (t1 >= 0.0) {',
                '        y1 = calcInterpolationBezier(',
                '            vLinePoint1.y,',
                '            vControlPoint1.y,',
                '            vControlPoint2.y,',
                '            vLinePoint2.y,',
                '            t1',
                '        );',
                '    }',
                '    else {',
                '        y1 = vLocalPosition.y + 1.0;',
                '    }',

                '    float t2 = calcBezierTimeInSection(',
                '        vLinePoint1R.x,',
                '        vControlPoint1R.x,',
                '        vControlPoint2R.x,',
                '        vLinePoint2R.x,',
                '        vLocalPosition.x',
                '    );',
                '    float y2;',
                '    if (t2 >= 0.0) {',
                '        y2 = calcInterpolationBezier(',
                '            vLinePoint1R.y,',
                '            vControlPoint1R.y,',
                '            vControlPoint2R.y,',
                '            vLinePoint2R.y,',
                '            t2',
                '        );',
                '    }',
                '    else {',
                '        y2 = vLocalPosition.y - 1.0;',
                '    }',

                '    float col = (vLocalPosition.y <= y1 && vLocalPosition.y >= y2)? 1.0 : 0.0;',

                '    gl_FragColor = vec4(0.0, 0.0, 0.0, col * mix(vAlpha[0], vAlpha[1], vLocalPosition.z));',
                //'    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
                '}',
                ''].join('\n');
        }

        initializeAttributes() {

            let gl = this.gl;

            this.uPMatrix = this.getUniformLocation('uPMatrix');
            this.uMVMatrix = this.getUniformLocation('uMVMatrix');

            this.aPosition = this.getAttribLocation('aPosition');
            this.aLocalPosition = this.getAttribLocation('aLocalPosition');

            this.aLinePoint1 = this.getAttribLocation('aLinePoint1');
            this.aControlPoint1 = this.getAttribLocation('aControlPoint1');
            this.aControlPoint2 = this.getAttribLocation('aControlPoint2');
            this.aLinePoint2 = this.getAttribLocation('aLinePoint2');

            this.aLinePoint1R = this.getAttribLocation('aLinePoint1R');
            this.aControlPoint1R = this.getAttribLocation('aControlPoint1R');
            this.aControlPoint2R = this.getAttribLocation('aControlPoint2R');
            this.aLinePoint2R = this.getAttribLocation('aLinePoint2R');

            this.aWidth = this.getAttribLocation('aWidth');
            this.aAlpha = this.getAttribLocation('aAlpha');
        }

        setVertexBuffer(vertexBuffer: VertexBuffer) {

            let gl = this.gl;

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);

            this.enableVertexAttributes();
            this.resetVertexAttribPointerOffset();

            let vertexDataStride = 4 * this.getVertexUnitSize();

            this.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aLocalPosition, 3, gl.FLOAT, vertexDataStride);

            this.vertexAttribPointer(this.aLinePoint1, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aControlPoint1, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aControlPoint2, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aLinePoint2, 2, gl.FLOAT, vertexDataStride);

            this.vertexAttribPointer(this.aLinePoint1R, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aControlPoint1R, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aControlPoint2R, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aLinePoint2R, 2, gl.FLOAT, vertexDataStride);

            this.vertexAttribPointer(this.aWidth, 2, gl.FLOAT, vertexDataStride);
            this.vertexAttribPointer(this.aAlpha, 2, gl.FLOAT, vertexDataStride);
        }
    }

    var _Main: Main = null;

    window.onload = () => {

        _Main = new Main();
        _Main.webglCanvas = <HTMLCanvasElement>document.getElementById('mainCanvas');
        _Main.displayCanvas = <HTMLCanvasElement>document.getElementById('displayCanvas');

        _Main.onLoad();

        window.requestAnimationFrame(run);
    };

    function run() {

        _Main.run();

        window.requestAnimationFrame(run);
    }
}