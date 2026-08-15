import { ditherRgba, type OneBitOptions } from './reference'

export type OneBitBackendKind = 'webgl2' | 'canvas2d'

export interface OneBitBackend {
  readonly canvas: HTMLCanvasElement
  readonly kind: OneBitBackendKind
  resize(width: number, height: number): void
  render(source: CanvasImageSource, options: Readonly<OneBitOptions>): void
  captureFrame(): ImageData | null
  dispose(): void
  simulateContextLossForDiagnostics?(): boolean
}

const vertexShaderSource = `#version 300 es
precision highp float;
out vec2 vUv;

void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

const fragmentShaderSource = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uContrast;
uniform float uGridScale;
in vec2 vUv;
out vec4 outColor;

float bayerThreshold(vec2 fragmentPosition) {
  vec2 topLeftPosition = vec2(fragmentPosition.x, uResolution.y - fragmentPosition.y);
  ivec2 cell = ivec2(floor(topLeftPosition / uGridScale));
  int x = cell.x & 3;
  int y = cell.y & 3;
  int index = x + y * 4;
  float matrix[16] = float[16](
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0
  );
  return (matrix[index] + 0.5) / 16.0;
}

void main() {
  vec3 source = texture(uSource, vUv).rgb;
  float lightness = dot(source, vec3(0.2126, 0.7152, 0.0722));
  lightness = clamp((lightness - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec3 colour = lightness > bayerThreshold(gl_FragCoord.xy) ? uPaper : uInk;
  outColor = vec4(colour, 1.0);
}`

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to create WebGL shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compilation error'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = gl.createProgram()
  if (!program) throw new Error('Unable to create WebGL program')
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown WebGL link error'
    gl.deleteProgram(program)
    throw new Error(message)
  }
  return program
}

function isSvgImageSource(source: CanvasImageSource): source is SVGImageElement {
  return typeof SVGImageElement !== 'undefined' && source instanceof SVGImageElement
}

export class WebGlOneBitBackend implements OneBitBackend {
  readonly canvas = document.createElement('canvas')
  readonly kind = 'webgl2' as const
  private readonly gl: WebGL2RenderingContext
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private vertexArray: WebGLVertexArrayObject | null = null
  private ready = false
  private disposed = false
  private auditPending = import.meta.env.DEV
  private readonly onPermanentFailure: () => void
  private readonly uploadCanvas = document.createElement('canvas')
  private readonly uploadContext: CanvasRenderingContext2D | null

  constructor(onPermanentFailure: () => void) {
    this.onPermanentFailure = onPermanentFailure
    this.uploadContext = this.uploadCanvas.getContext('2d', { alpha: false })
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('WebGL2 is unavailable')
    this.gl = gl
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    this.initializeResources()
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
    this.uploadCanvas.width = width
    this.uploadCanvas.height = height
    this.auditPending = import.meta.env.DEV
    if (this.ready) this.gl.viewport(0, 0, width, height)
  }

  render(source: CanvasImageSource, options: Readonly<OneBitOptions>) {
    if (!this.ready || this.disposed || !this.program || !this.texture || !this.vertexArray) return
    const gl = this.gl
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.resolveTextureSource(source))
    gl.uniform1i(gl.getUniformLocation(this.program, 'uSource'), 0)
    gl.uniform2f(gl.getUniformLocation(this.program, 'uResolution'), this.canvas.width, this.canvas.height)
    gl.uniform3f(gl.getUniformLocation(this.program, 'uPaper'), options.paper[0] / 255, options.paper[1] / 255, options.paper[2] / 255)
    gl.uniform3f(gl.getUniformLocation(this.program, 'uInk'), options.ink[0] / 255, options.ink[1] / 255, options.ink[2] / 255)
    gl.uniform1f(gl.getUniformLocation(this.program, 'uContrast'), options.contrast)
    gl.uniform1f(gl.getUniformLocation(this.program, 'uGridScale'), options.gridScale)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (this.auditPending) this.auditPalette(options)
    gl.bindVertexArray(null)
  }

  captureFrame() {
    if (!this.ready || this.disposed || this.canvas.width <= 0 || this.canvas.height <= 0) return null
    const { width, height } = this.canvas
    const stride = width * 4
    const pixels = new Uint8Array(stride * height)
    const row = new Uint8Array(stride)
    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels)
    for (let top = 0, bottom = height - 1; top < bottom; top += 1, bottom -= 1) {
      const topOffset = top * stride
      const bottomOffset = bottom * stride
      row.set(pixels.subarray(topOffset, topOffset + stride))
      pixels.copyWithin(topOffset, bottomOffset, bottomOffset + stride)
      pixels.set(row, bottomOffset)
    }
    return new ImageData(new Uint8ClampedArray(pixels.buffer), width, height)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.ready = false
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    this.disposeResources()
  }

  simulateContextLossForDiagnostics() {
    if (!import.meta.env.DEV || this.disposed) return false
    const extension = this.gl.getExtension('WEBGL_lose_context')
    if (!extension) return false
    extension.loseContext()
    setTimeout(() => extension.restoreContext(), 80)
    return true
  }

  private initializeResources() {
    const gl = this.gl
    this.program = createProgram(gl)
    this.texture = gl.createTexture()
    this.vertexArray = gl.createVertexArray()
    if (!this.texture || !this.vertexArray) throw new Error('Unable to create WebGL resources')
    gl.disable(gl.DITHER)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.auditPending = import.meta.env.DEV
    this.ready = true
  }

  private auditPalette(options: Readonly<OneBitOptions>) {
    const byteLength = this.canvas.width * this.canvas.height * 4
    const first = new Uint8Array(byteLength)
    const second = new Uint8Array(byteLength)
    this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, first)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
    this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, second)
    this.canvas.dataset.palette = hasOnlyPaletteColours(first, options) ? 'valid' : 'invalid'
    this.canvas.dataset.deterministic = buffersEqual(first, second) ? 'valid' : 'invalid'
    this.auditPending = false
  }

  private resolveTextureSource(source: CanvasImageSource): TexImageSource {
    if (isSvgImageSource(source)) {
      if (!this.uploadContext) throw new Error('Canvas 2D SVG staging is unavailable')
      this.uploadContext.clearRect(0, 0, this.uploadCanvas.width, this.uploadCanvas.height)
      this.uploadContext.drawImage(source, 0, 0, this.uploadCanvas.width, this.uploadCanvas.height)
      return this.uploadCanvas
    }
    return source
  }

  private disposeResources() {
    if (this.program) this.gl.deleteProgram(this.program)
    if (this.texture) this.gl.deleteTexture(this.texture)
    if (this.vertexArray) this.gl.deleteVertexArray(this.vertexArray)
    this.program = null
    this.texture = null
    this.vertexArray = null
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault()
    this.ready = false
  }

  private handleContextRestored = () => {
    if (this.disposed) return
    try {
      this.disposeResources()
      this.initializeResources()
    } catch {
      this.onPermanentFailure()
    }
  }
}

export class CanvasOneBitBackend implements OneBitBackend {
  readonly canvas = document.createElement('canvas')
  readonly kind = 'canvas2d' as const
  private readonly context: CanvasRenderingContext2D
  private readonly sourceCanvas = document.createElement('canvas')
  private readonly sourceContext: CanvasRenderingContext2D
  private output: ImageData | null = null
  private auditPending = import.meta.env.DEV

  constructor() {
    const context = this.canvas.getContext('2d', { alpha: false })
    const sourceContext = this.sourceCanvas.getContext('2d', { alpha: false, willReadFrequently: true })
    if (!context || !sourceContext) throw new Error('Canvas 2D is unavailable')
    this.context = context
    this.sourceContext = sourceContext
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
    this.sourceCanvas.width = width
    this.sourceCanvas.height = height
    this.output = this.context.createImageData(width, height)
    this.auditPending = import.meta.env.DEV
  }

  render(source: CanvasImageSource, options: Readonly<OneBitOptions>) {
    if (!this.output) return
    const { width, height } = this.canvas
    this.sourceContext.clearRect(0, 0, width, height)
    this.sourceContext.drawImage(source, 0, 0, width, height)
    const input = this.sourceContext.getImageData(0, 0, width, height)
    ditherRgba(input.data, width, height, options, this.output.data)
    this.context.putImageData(this.output, 0, 0)
    if (this.auditPending) {
      const verification = ditherRgba(input.data, width, height, options)
      this.canvas.dataset.palette = hasOnlyPaletteColours(this.output.data, options) ? 'valid' : 'invalid'
      this.canvas.dataset.deterministic = buffersEqual(this.output.data, verification) ? 'valid' : 'invalid'
      this.auditPending = false
    }
  }

  captureFrame() {
    if (this.canvas.width <= 0 || this.canvas.height <= 0) return null
    return this.context.getImageData(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose() {
    this.output = null
    this.canvas.width = 1
    this.canvas.height = 1
    this.sourceCanvas.width = 1
    this.sourceCanvas.height = 1
  }
}

function hasOnlyPaletteColours(pixels: Uint8Array | Uint8ClampedArray, options: Readonly<OneBitOptions>) {
  for (let index = 0; index < pixels.length; index += 4) {
    const isPaper = pixels[index] === options.paper[0]
      && pixels[index + 1] === options.paper[1]
      && pixels[index + 2] === options.paper[2]
    const isInk = pixels[index] === options.ink[0]
      && pixels[index + 1] === options.ink[1]
      && pixels[index + 2] === options.ink[2]
    if ((!isPaper && !isInk) || pixels[index + 3] !== 255) return false
  }
  return true
}

function buffersEqual(first: Uint8Array | Uint8ClampedArray, second: Uint8Array | Uint8ClampedArray) {
  if (first.length !== second.length) return false
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return false
  }
  return true
}
