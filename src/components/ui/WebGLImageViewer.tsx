import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'

interface WheelConfig {
  step: number
  wheelDisabled?: boolean
  touchPadDisabled?: boolean
}

interface PinchConfig {
  step: number
  disabled?: boolean
}

interface DoubleClickConfig {
  step: number
  disabled?: boolean
  mode: 'toggle' | 'zoom'
  animationTime: number
}

interface PanningConfig {
  disabled?: boolean
  velocityDisabled?: boolean
}

interface AlignmentAnimationConfig {
  sizeX: number
  sizeY: number
  velocityAlignmentTime: number
}

interface VelocityAnimationConfig {
  sensitivity: number
  animationTime: number
}

interface WebGLImageViewerProps {
  src: string
  className?: string
  initialScale?: number
  minScale?: number
  maxScale?: number
  wheel?: WheelConfig
  pinch?: PinchConfig
  doubleClick?: DoubleClickConfig
  panning?: PanningConfig
  limitToBounds?: boolean
  centerOnInit?: boolean
  smooth?: boolean
  alignmentAnimation?: AlignmentAnimationConfig
  velocityAnimation?: VelocityAnimationConfig
  onZoomChange?: (originalScale: number, relativeScale: number) => void
  onImageCopied?: () => void
}

interface WebGLImageViewerRef {
  zoomIn: (animated?: boolean) => void
  zoomOut: (animated?: boolean) => void
  resetView: () => void
  getScale: () => number
}

// WebGL Image Viewer implementation class
class WebGLImageViewerEngine {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program!: WebGLProgram
  private texture: WebGLTexture | null = null
  private imageLoaded = false
  private originalImageSrc = ''

  // Transform state
  private scale = 1
  private translateX = 0
  private translateY = 0
  private imageWidth = 0
  private imageHeight = 0
  private canvasWidth = 0
  private canvasHeight = 0

  // Interaction state
  private isDragging = false
  private lastMouseX = 0
  private lastMouseY = 0
  private lastTouchDistance = 0
  private lastDoubleClickTime = 0
  private isOriginalSize = false

  // Animation state
  private isAnimating = false
  private animationStartTime = 0
  private animationDuration = 300 // ms
  private startScale = 1
  private targetScale = 1
  private startTranslateX = 0
  private startTranslateY = 0
  private targetTranslateX = 0
  private targetTranslateY = 0

  // Configuration
  private config: Required<WebGLImageViewerProps>
  private onZoomChange?: (originalScale: number, relativeScale: number) => void
  private onImageCopied?: () => void

  // Bound event handlers for proper cleanup
  private boundHandleMouseDown: (e: MouseEvent) => void
  private boundHandleMouseMove: (e: MouseEvent) => void
  private boundHandleMouseUp: () => void
  private boundHandleWheel: (e: WheelEvent) => void
  private boundHandleDoubleClick: (e: MouseEvent) => void
  private boundHandleTouchStart: (e: TouchEvent) => void
  private boundHandleTouchMove: (e: TouchEvent) => void
  private boundHandleTouchEnd: () => void
  private boundResizeCanvas: () => void

  // Vertex and fragment shaders
  private vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    
    uniform mat3 u_matrix;
    
    varying vec2 v_texCoord;
    
    void main() {
      vec3 position = u_matrix * vec3(a_position, 1.0);
      gl_Position = vec4(position.xy, 0, 1);
      v_texCoord = a_texCoord;
    }
  `

  private fragmentShaderSource = `
    precision mediump float;
    
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    
    void main() {
      gl_FragColor = texture2D(u_image, v_texCoord);
    }
  `

  constructor(
    canvas: HTMLCanvasElement,
    config: Required<WebGLImageViewerProps>,
    onZoomChange?: (originalScale: number, relativeScale: number) => void,
    onImageCopied?: () => void,
  ) {
    this.canvas = canvas
    this.config = config
    this.onZoomChange = onZoomChange
    this.onImageCopied = onImageCopied

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
    })
    if (!gl) {
      throw new Error('WebGL not supported')
    }
    this.gl = gl

    this.scale = config.initialScale

    // Bind event handlers for proper cleanup
    this.boundHandleMouseDown = (e: MouseEvent) => this.handleMouseDown(e)
    this.boundHandleMouseMove = (e: MouseEvent) => this.handleMouseMove(e)
    this.boundHandleMouseUp = () => this.handleMouseUp()
    this.boundHandleWheel = (e: WheelEvent) => this.handleWheel(e)
    this.boundHandleDoubleClick = (e: MouseEvent) => this.handleDoubleClick(e)
    this.boundHandleTouchStart = (e: TouchEvent) => this.handleTouchStart(e)
    this.boundHandleTouchMove = (e: TouchEvent) => this.handleTouchMove(e)
    this.boundHandleTouchEnd = () => this.handleTouchEnd()
    this.boundResizeCanvas = () => this.resizeCanvas()

    this.setupCanvas()
    this.initWebGL()
    this.setupEventListeners()
  }

  private setupCanvas() {
    this.resizeCanvas()
    window.addEventListener('resize', this.boundResizeCanvas)
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    this.canvasWidth = rect.width
    this.canvasHeight = rect.height
    this.canvas.width = this.canvasWidth
    this.canvas.height = this.canvasHeight
    this.gl.viewport(0, 0, this.canvasWidth, this.canvasHeight)

    if (this.imageLoaded) {
      this.constrainImagePosition()
      this.render()
    }
  }

  private initWebGL() {
    const { gl } = this

    // Create shaders
    const vertexShader = this.createShader(
      gl.VERTEX_SHADER,
      this.vertexShaderSource,
    )
    const fragmentShader = this.createShader(
      gl.FRAGMENT_SHADER,
      this.fragmentShaderSource,
    )

    // Create program
    this.program = gl.createProgram()!
    gl.attachShader(this.program, vertexShader)
    gl.attachShader(this.program, fragmentShader)
    gl.linkProgram(this.program)

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(
        `Program linking failed: ${gl.getProgramInfoLog(this.program)}`,
      )
    }

    gl.useProgram(this.program)

    // Enable blending for transparency
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // Create geometry (quad that will be transformed to image size)
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ])

    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0])

    // Position buffer
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Texture coordinate buffer
    const texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)

    const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord')
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
  }

  private createShader(type: number, source: string): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader compilation failed: ${error}`)
    }

    return shader
  }

  async loadImage(url: string) {
    this.originalImageSrc = url
    const image = new Image()
    image.crossOrigin = 'anonymous'

    return new Promise<void>((resolve, reject) => {
      image.onload = () => {
        this.imageWidth = image.width
        this.imageHeight = image.height
        this.createTexture(image)

        if (this.config.centerOnInit) {
          this.fitImageToScreen()
        }

        this.imageLoaded = true
        this.render()
        this.notifyZoomChange() // 通知初始缩放值
        resolve()
      }

      image.onerror = () => reject(new Error('Failed to load image'))
      image.src = url
    })
  }

  private createTexture(image: HTMLImageElement) {
    const { gl } = this
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  }

  private fitImageToScreen() {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    const fitToScreenScale = Math.min(scaleX, scaleY)

    // initialScale 是相对于适应页面大小的比例
    this.scale = fitToScreenScale * this.config.initialScale

    // Center the image
    this.translateX = 0
    this.translateY = 0

    this.isOriginalSize = false
  }

  // Easing function for smooth animation
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  private startAnimation(
    targetScale: number,
    targetTranslateX: number,
    targetTranslateY: number,
    animationTime?: number,
  ) {
    this.isAnimating = true
    this.animationStartTime = performance.now()
    this.animationDuration =
      animationTime ||
      (this.config.smooth
        ? this.config.velocityAnimation.animationTime * 1000
        : 0)
    this.startScale = this.scale
    this.targetScale = targetScale
    this.startTranslateX = this.translateX
    this.startTranslateY = this.translateY
    this.targetTranslateX = targetTranslateX
    this.targetTranslateY = targetTranslateY

    this.animate()
  }

  private animate() {
    if (!this.isAnimating) return

    const now = performance.now()
    const elapsed = now - this.animationStartTime
    const progress = Math.min(elapsed / this.animationDuration, 1)
    const easedProgress = this.config.smooth
      ? this.easeInOutCubic(progress)
      : progress

    // Interpolate scale and translation
    this.scale =
      this.startScale + (this.targetScale - this.startScale) * easedProgress
    this.translateX =
      this.startTranslateX +
      (this.targetTranslateX - this.startTranslateX) * easedProgress
    this.translateY =
      this.startTranslateY +
      (this.targetTranslateY - this.startTranslateY) * easedProgress

    this.render()
    this.notifyZoomChange()

    if (progress < 1) {
      requestAnimationFrame(() => this.animate())
    } else {
      this.isAnimating = false
      // Ensure constraints are applied at the end of animation
      this.constrainImagePosition()
      this.render()
      this.notifyZoomChange()
    }
  }

  private createMatrix(): Float32Array {
    // Create transformation matrix
    const scaleX = (this.imageWidth * this.scale) / this.canvasWidth
    const scaleY = (this.imageHeight * this.scale) / this.canvasHeight

    const translateX = (this.translateX * 2) / this.canvasWidth
    const translateY = -(this.translateY * 2) / this.canvasHeight

    return new Float32Array([
      scaleX,
      0,
      0,
      0,
      scaleY,
      0,
      translateX,
      translateY,
      1,
    ])
  }

  private getFitToScreenScale(): number {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    return Math.min(scaleX, scaleY)
  }

  private constrainImagePosition() {
    if (!this.config.limitToBounds) return

    const fitScale = this.getFitToScreenScale()

    // If current scale is less than or equal to fit-to-screen scale, center the image
    if (this.scale <= fitScale) {
      this.translateX = 0
      this.translateY = 0
      return
    }

    // Otherwise, constrain the image within reasonable bounds
    const scaledWidth = this.imageWidth * this.scale
    const scaledHeight = this.imageHeight * this.scale

    // Calculate the maximum allowed translation to keep image edges within viewport
    const maxTranslateX = Math.max(0, (scaledWidth - this.canvasWidth) / 2)
    const maxTranslateY = Math.max(0, (scaledHeight - this.canvasHeight) / 2)

    // Constrain translation
    this.translateX = Math.max(
      -maxTranslateX,
      Math.min(maxTranslateX, this.translateX),
    )
    this.translateY = Math.max(
      -maxTranslateY,
      Math.min(maxTranslateY, this.translateY),
    )
  }

  private render() {
    const { gl } = this

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.texture) return

    gl.useProgram(this.program)

    // Set transformation matrix
    const matrixLocation = gl.getUniformLocation(this.program, 'u_matrix')
    gl.uniformMatrix3fv(matrixLocation, false, this.createMatrix())

    const imageLocation = gl.getUniformLocation(this.program, 'u_image')
    gl.uniform1i(imageLocation, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private notifyZoomChange() {
    if (this.onZoomChange) {
      // 原图缩放比例（相对于图片原始大小）
      const originalScale = this.scale

      // 相对于页面适应大小的缩放比例
      const fitToScreenScale = this.getFitToScreenScale()
      const relativeScale = this.scale / fitToScreenScale

      this.onZoomChange(originalScale, relativeScale)
    }
  }

  private setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.addEventListener('mousemove', this.boundHandleMouseMove)
    this.canvas.addEventListener('mouseup', this.boundHandleMouseUp)
    this.canvas.addEventListener('wheel', this.boundHandleWheel)
    this.canvas.addEventListener('dblclick', this.boundHandleDoubleClick)

    // Touch events
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart)
    this.canvas.addEventListener('touchmove', this.boundHandleTouchMove)
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd)
  }

  private removeEventListeners() {
    this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove)
    this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp)
    this.canvas.removeEventListener('wheel', this.boundHandleWheel)
    this.canvas.removeEventListener('dblclick', this.boundHandleDoubleClick)
    this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart)
    this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove)
    this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd)
  }

  private handleMouseDown(e: MouseEvent) {
    if (this.isAnimating || this.config.panning.disabled) return

    this.isDragging = true
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDragging || this.config.panning.disabled) return

    const deltaX = e.clientX - this.lastMouseX
    const deltaY = e.clientY - this.lastMouseY

    this.translateX += deltaX
    this.translateY += deltaY

    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY

    this.constrainImagePosition()
    this.render()
  }

  private handleMouseUp() {
    this.isDragging = false
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault()

    if (this.isAnimating || this.config.wheel.wheelDisabled) return

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const scaleFactor =
      e.deltaY > 0 ? 1 - this.config.wheel.step : 1 + this.config.wheel.step
    this.zoomAt(mouseX, mouseY, scaleFactor)
  }

  private handleDoubleClick(e: MouseEvent) {
    e.preventDefault()

    if (this.config.doubleClick.disabled) return

    const now = Date.now()
    if (now - this.lastDoubleClickTime < 300) return
    this.lastDoubleClickTime = now

    // Stop any ongoing animation
    this.isAnimating = false

    if (this.config.doubleClick.mode === 'toggle') {
      const fitToScreenScale = this.getFitToScreenScale()

      if (this.isOriginalSize) {
        // Animate to fit-to-screen 1x (适应页面大小)
        this.startAnimation(
          fitToScreenScale,
          0,
          0,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = false
      } else {
        // Animate to original size 1x (原图原始大小)
        this.startAnimation(
          1, // 1x = 原图原始大小
          0,
          0,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = true
      }
    } else {
      // Zoom mode
      const rect = this.canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      this.zoomAt(mouseX, mouseY, this.config.doubleClick.step)
    }
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault()

    if (this.isAnimating) return

    if (e.touches.length === 1 && !this.config.panning.disabled) {
      this.isDragging = true
      this.lastMouseX = e.touches[0].clientX
      this.lastMouseY = e.touches[0].clientY
    } else if (e.touches.length === 2 && !this.config.pinch.disabled) {
      this.isDragging = false
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      this.lastTouchDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault()

    if (
      e.touches.length === 1 &&
      this.isDragging &&
      !this.config.panning.disabled
    ) {
      const deltaX = e.touches[0].clientX - this.lastMouseX
      const deltaY = e.touches[0].clientY - this.lastMouseY

      this.translateX += deltaX
      this.translateY += deltaY

      this.lastMouseX = e.touches[0].clientX
      this.lastMouseY = e.touches[0].clientY

      this.constrainImagePosition()
      this.render()
    } else if (e.touches.length === 2 && !this.config.pinch.disabled) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )

      if (this.lastTouchDistance > 0) {
        const scaleFactor = distance / this.lastTouchDistance
        const centerX = (touch1.clientX + touch2.clientX) / 2
        const centerY = (touch1.clientY + touch2.clientY) / 2

        const rect = this.canvas.getBoundingClientRect()
        this.zoomAt(centerX - rect.left, centerY - rect.top, scaleFactor)
      }

      this.lastTouchDistance = distance
    }
  }

  private handleTouchEnd() {
    this.isDragging = false
    this.lastTouchDistance = 0
  }

  private zoomAt(x: number, y: number, scaleFactor: number, animated = false) {
    const newScale = this.scale * scaleFactor
    const fitToScreenScale = this.getFitToScreenScale()

    // 将相对缩放比例转换为绝对缩放比例进行限制
    const absoluteMinScale = fitToScreenScale * this.config.minScale
    const absoluteMaxScale = fitToScreenScale * this.config.maxScale

    // Limit zoom
    if (newScale < absoluteMinScale || newScale > absoluteMaxScale) return

    if (animated && this.config.smooth) {
      // Calculate zoom point relative to current transform
      const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
      const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

      // Calculate target translation after zoom
      const targetTranslateX = x - this.canvasWidth / 2 - zoomX * newScale
      const targetTranslateY = y - this.canvasHeight / 2 - zoomY * newScale

      this.startAnimation(newScale, targetTranslateX, targetTranslateY)
    } else {
      // Calculate zoom point relative to current transform
      const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
      const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

      this.scale = newScale

      // Adjust translation to keep zoom point fixed
      this.translateX = x - this.canvasWidth / 2 - zoomX * this.scale
      this.translateY = y - this.canvasHeight / 2 - zoomY * this.scale

      this.constrainImagePosition()
      this.render()
      this.notifyZoomChange()
    }
  }

  async copyOriginalImageToClipboard() {
    try {
      // 获取原始图片
      const response = await fetch(this.originalImageSrc)
      const blob = await response.blob()

      // 检查浏览器是否支持剪贴板API
      if (!navigator.clipboard || !navigator.clipboard.write) {
        console.warn('Clipboard API not supported')
        return
      }

      // 创建ClipboardItem并写入剪贴板
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob,
      })

      await navigator.clipboard.write([clipboardItem])
      console.info('Original image copied to clipboard')
      if (this.onImageCopied) {
        this.onImageCopied()
      }
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error)
    }
  }

  // Public methods
  public zoomIn(animated = false) {
    const centerX = this.canvasWidth / 2
    const centerY = this.canvasHeight / 2
    this.zoomAt(centerX, centerY, 1 + this.config.wheel.step, animated)
  }

  public zoomOut(animated = false) {
    const centerX = this.canvasWidth / 2
    const centerY = this.canvasHeight / 2
    this.zoomAt(centerX, centerY, 1 - this.config.wheel.step, animated)
  }

  public resetView() {
    const fitToScreenScale = this.getFitToScreenScale()
    const targetScale = fitToScreenScale * this.config.initialScale
    this.startAnimation(targetScale, 0, 0)
  }

  public getScale(): number {
    return this.scale
  }

  public destroy() {
    this.removeEventListeners()
    window.removeEventListener('resize', this.boundResizeCanvas)
  }
}

const defaultWheelConfig: WheelConfig = {
  step: 0.1,
  wheelDisabled: false,
  touchPadDisabled: false,
}

const defaultPinchConfig: PinchConfig = {
  step: 0.5,
  disabled: false,
}

const defaultDoubleClickConfig: DoubleClickConfig = {
  step: 2,
  disabled: false,
  mode: 'toggle',
  animationTime: 200,
}

const defaultPanningConfig: PanningConfig = {
  disabled: false,
  velocityDisabled: true,
}

const defaultAlignmentAnimation: AlignmentAnimationConfig = {
  sizeX: 0,
  sizeY: 0,
  velocityAlignmentTime: 0.2,
}

const defaultVelocityAnimation: VelocityAnimationConfig = {
  sensitivity: 1,
  animationTime: 0.2,
}

export const WebGLImageViewer = ({
  ref,
  src,
  className = '',
  initialScale = 1,
  minScale = 0.1,
  maxScale = 10,
  wheel = defaultWheelConfig,
  pinch = defaultPinchConfig,
  doubleClick = defaultDoubleClickConfig,
  panning = defaultPanningConfig,
  limitToBounds = true,
  centerOnInit = true,
  smooth = true,
  alignmentAnimation = defaultAlignmentAnimation,
  velocityAnimation = defaultVelocityAnimation,
  onZoomChange,
  onImageCopied,
}: WebGLImageViewerProps & {
  ref?: React.RefObject<WebGLImageViewerRef | null>
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<WebGLImageViewerEngine | null>(null)

  const config: Required<WebGLImageViewerProps> = useMemo(
    () => ({
      src,
      className,
      initialScale,
      minScale,
      maxScale,
      wheel: {
        ...defaultWheelConfig,
        ...wheel,
      },
      pinch: { ...defaultPinchConfig, ...pinch },
      doubleClick: { ...defaultDoubleClickConfig, ...doubleClick },
      panning: { ...defaultPanningConfig, ...panning },
      limitToBounds,
      centerOnInit,
      smooth,
      alignmentAnimation: {
        ...defaultAlignmentAnimation,
        ...alignmentAnimation,
      },
      velocityAnimation: { ...defaultVelocityAnimation, ...velocityAnimation },
      onZoomChange: onZoomChange || (() => {}),
      onImageCopied: onImageCopied || (() => {}),
    }),
    [
      src,
      className,
      initialScale,
      minScale,
      maxScale,
      wheel,
      pinch,
      doubleClick,
      panning,
      limitToBounds,
      centerOnInit,
      smooth,
      alignmentAnimation,
      velocityAnimation,
      onZoomChange,
      onImageCopied,
    ],
  )

  useImperativeHandle(ref, () => ({
    zoomIn: (animated?: boolean) => viewerRef.current?.zoomIn(animated),
    zoomOut: (animated?: boolean) => viewerRef.current?.zoomOut(animated),
    resetView: () => viewerRef.current?.resetView(),
    getScale: () => viewerRef.current?.getScale() || 1,
  }))

  useEffect(() => {
    if (!canvasRef.current) return

    let webGLImageViewerEngine: WebGLImageViewerEngine | null = null
    try {
      webGLImageViewerEngine = new WebGLImageViewerEngine(
        canvasRef.current,
        config,
        onZoomChange,
        onImageCopied,
      )
      webGLImageViewerEngine.loadImage(src).catch(console.error)
      viewerRef.current = webGLImageViewerEngine
    } catch (error) {
      console.error('Failed to initialize WebGL Image Viewer:', error)
    }

    return () => {
      webGLImageViewerEngine?.destroy()
    }
  }, [src, config, onZoomChange, onImageCopied])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
      }}
    />
  )
}

WebGLImageViewer.displayName = 'WebGLImageViewer'

export type { WebGLImageViewerProps, WebGLImageViewerRef }
