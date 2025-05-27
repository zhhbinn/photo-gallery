import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

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
  debug?: boolean
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

  // Throttle state for render
  private renderThrottleId: number | null = null
  private lastRenderTime = 0
  private renderThrottleDelay = 16 // ~60fps

  // Texture optimization state
  private originalImage: HTMLImageElement | null = null
  private textureDebounceId: ReturnType<typeof setTimeout> | null = null
  private textureDebounceDelay = 300 // ms
  private currentTextureScale = 1
  private lastOptimalTextureSize = { width: 0, height: 0 }

  // Configuration
  private config: Required<WebGLImageViewerProps>
  private onZoomChange?: (originalScale: number, relativeScale: number) => void
  private onImageCopied?: () => void
  private onDebugUpdate?: (debugInfo: any) => void

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
    onDebugUpdate?: (debugInfo: any) => void,
  ) {
    this.canvas = canvas
    this.config = config
    this.onZoomChange = onZoomChange
    this.onImageCopied = onImageCopied
    this.onDebugUpdate = onDebugUpdate

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      powerPreference: 'high-performance',
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

    // 暂时简化处理，使用1:1的像素映射
    this.canvasWidth = rect.width
    this.canvasHeight = rect.height
    this.canvas.width = this.canvasWidth
    this.canvas.height = this.canvasHeight
    this.gl.viewport(0, 0, this.canvasWidth, this.canvasHeight)

    if (this.imageLoaded) {
      // 窗口大小改变时，需要重新约束缩放倍数和位置
      this.constrainScaleAndPosition()
      this.render()
      // canvas尺寸变化时也需要检查纹理更新
      this.debouncedTextureUpdate()
      // 通知缩放变化
      this.notifyZoomChange()
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
    this.originalImage = image
    this.createOptimizedTexture()
  }

  private createOptimizedTexture() {
    if (!this.originalImage) return

    const { gl } = this

    // 计算当前最优纹理尺寸
    const optimalSize = this.calculateOptimalTextureSize()
    this.lastOptimalTextureSize = optimalSize

    // 创建离屏canvas来调整图片尺寸
    const offscreenCanvas = document.createElement('canvas')
    const offscreenCtx = offscreenCanvas.getContext('2d')!

    offscreenCanvas.width = optimalSize.width
    offscreenCanvas.height = optimalSize.height

    // 设置高质量的图像渲染
    offscreenCtx.imageSmoothingEnabled = true
    offscreenCtx.imageSmoothingQuality = 'high'

    // 绘制缩放后的图片
    offscreenCtx.drawImage(
      this.originalImage,
      0,
      0,
      this.originalImage.width,
      this.originalImage.height,
      0,
      0,
      optimalSize.width,
      optimalSize.height,
    )

    // 删除旧纹理
    if (this.texture) {
      gl.deleteTexture(this.texture)
    }

    // 创建新纹理
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // 设置纹理参数，防止边框效果
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // 始终使用线性插值获得最平滑的效果
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // 上传纹理数据
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      offscreenCanvas,
    )

    this.currentTextureScale = this.scale
  }

  private calculateOptimalTextureSize(): { width: number; height: number } {
    if (!this.originalImage) return { width: 0, height: 0 }

    // 计算当前显示在屏幕上的图片尺寸
    const displayWidth = this.imageWidth * this.scale
    const displayHeight = this.imageHeight * this.scale

    // 计算设备像素比，确保在高DPI屏幕上也有足够的清晰度
    const devicePixelRatio = window.devicePixelRatio || 1

    // 基于显示尺寸和设备像素比计算目标纹理尺寸
    let targetWidth = displayWidth * devicePixelRatio
    let targetHeight = displayHeight * devicePixelRatio

    // 应用超采样来提高质量，减少锯齿
    // 在高DPI屏幕上或放大时使用更高的超采样倍率
    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale

    let supersamplingFactor = 1
    if (relativeScale >= 1) {
      // 正常大小或放大时，使用较高的超采样
      supersamplingFactor = Math.min(2, 1 + relativeScale * 0.5)
    } else {
      // 缩小时，仍然保持一定的超采样以减少锯齿
      supersamplingFactor = Math.max(1.2, Math.min(2, 2 - relativeScale))
    }

    targetWidth *= supersamplingFactor
    targetHeight *= supersamplingFactor

    // 确保纹理尺寸不会过小，但也要考虑性能
    // 最小尺寸应该足够保证图像质量，特别是对于原本就不大的图片
    const minSize = Math.min(
      1024,
      Math.max(
        512,
        Math.min(this.originalImage.width, this.originalImage.height),
      ),
    )
    // 最大纹理尺寸不应该超过原图尺寸，因为这样不会提供额外的图像信息
    const maxSize = Math.max(
      this.originalImage.width,
      this.originalImage.height,
    )

    targetWidth = Math.max(minSize, Math.min(maxSize, targetWidth))
    targetHeight = Math.max(minSize, Math.min(maxSize, targetHeight))

    // 纹理尺寸永远不应该超过原图尺寸
    targetWidth = Math.min(targetWidth, this.originalImage.width)
    targetHeight = Math.min(targetHeight, this.originalImage.height)

    // 将尺寸调整为2的幂次方，这对WebGL性能更好
    const optimalWidth = Math.pow(2, Math.ceil(Math.log2(targetWidth)))
    const optimalHeight = Math.pow(2, Math.ceil(Math.log2(targetHeight)))

    // 最终限制在合理范围内
    const finalWidth = Math.max(minSize, Math.min(maxSize, optimalWidth))
    const finalHeight = Math.max(minSize, Math.min(maxSize, optimalHeight))

    return { width: finalWidth, height: finalHeight }
  }

  private debouncedTextureUpdate() {
    // 检查是否需要更新纹理
    const scaleChange =
      Math.abs(this.scale - this.currentTextureScale) /
      Math.max(this.currentTextureScale, 0.1)

    // 降低更新阈值，使纹理更及时地响应缩放变化
    if (scaleChange < 0.3) {
      return // 变化不大，不需要更新
    }

    // 清除之前的防抖调用
    if (this.textureDebounceId !== null) {
      clearTimeout(this.textureDebounceId)
    }

    // 缩短防抖延迟，使纹理更新更及时
    const debounceDelay = this.textureDebounceDelay * 0.5

    // 设置新的防抖调用
    this.textureDebounceId = setTimeout(() => {
      this.textureDebounceId = null
      this.createOptimizedTexture()
      this.render()
    }, debounceDelay)
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

    // Apply constraints to target position before starting animation
    const tempScale = this.scale
    const tempTranslateX = this.translateX
    const tempTranslateY = this.translateY

    this.scale = targetScale
    this.translateX = targetTranslateX
    this.translateY = targetTranslateY
    this.constrainImagePosition()

    this.targetTranslateX = this.translateX
    this.targetTranslateY = this.translateY

    // Restore current state
    this.scale = tempScale
    this.translateX = tempTranslateX
    this.translateY = tempTranslateY

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
      // Ensure final values are exactly the target values
      this.scale = this.targetScale
      this.translateX = this.targetTranslateX
      this.translateY = this.targetTranslateY
      this.render()
      this.notifyZoomChange()
    }
  }

  private createMatrix(): Float32Array {
    // Create transformation matrix
    // 使用CSS尺寸进行计算，因为所有的交互和位置都是基于CSS尺寸的
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

  private constrainScaleAndPosition() {
    // 首先约束缩放倍数
    const fitToScreenScale = this.getFitToScreenScale()
    const absoluteMinScale = fitToScreenScale * this.config.minScale
    const absoluteMaxScale = fitToScreenScale * this.config.maxScale

    // 如果当前缩放超出范围，调整到合理范围内
    if (this.scale < absoluteMinScale) {
      this.scale = absoluteMinScale
    } else if (this.scale > absoluteMaxScale) {
      this.scale = absoluteMaxScale
    }

    // 然后约束位置
    this.constrainImagePosition()
  }

  private render() {
    const now = performance.now()

    // 如果距离上次渲染时间不足，则使用节流
    if (now - this.lastRenderTime < this.renderThrottleDelay) {
      // 清除之前的节流调用
      if (this.renderThrottleId !== null) {
        cancelAnimationFrame(this.renderThrottleId)
      }

      // 安排下次渲染
      this.renderThrottleId = requestAnimationFrame(() => {
        this.renderThrottleId = null
        this.renderInternal()
      })
      return
    }

    this.renderInternal()
  }

  private renderInternal() {
    this.lastRenderTime = performance.now()

    const { gl } = this

    // 确保视口设置正确
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight)

    // 清除为完全透明
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

    // Update debug info if enabled
    if (this.config.debug && this.onDebugUpdate) {
      this.updateDebugInfo()
    }
  }

  private updateDebugInfo() {
    if (!this.onDebugUpdate) return

    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale

    this.onDebugUpdate({
      scale: this.scale,
      relativeScale,
      translateX: this.translateX,
      translateY: this.translateY,
      textureSize: this.lastOptimalTextureSize,
      canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
      imageSize: { width: this.imageWidth, height: this.imageHeight },
      fitToScreenScale,
      renderCount: performance.now(),
      textureUpdateCount: this.currentTextureScale,
    })
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

    // Stop any ongoing animation when user starts interacting
    this.isAnimating = false

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

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (this.config.doubleClick.mode === 'toggle') {
      const fitToScreenScale = this.getFitToScreenScale()
      const absoluteMinScale = fitToScreenScale * this.config.minScale
      const absoluteMaxScale = fitToScreenScale * this.config.maxScale

      if (this.isOriginalSize) {
        // Animate to fit-to-screen 1x (适应页面大小) with click position as center
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(absoluteMaxScale, fitToScreenScale),
        )

        // Calculate zoom point relative to current transform
        const zoomX =
          (mouseX - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY =
          (mouseY - this.canvasHeight / 2 - this.translateY) / this.scale

        // Calculate target translation after zoom
        const targetTranslateX =
          mouseX - this.canvasWidth / 2 - zoomX * targetScale
        const targetTranslateY =
          mouseY - this.canvasHeight / 2 - zoomY * targetScale

        this.startAnimation(
          targetScale,
          targetTranslateX,
          targetTranslateY,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = false
      } else {
        // Animate to original size 1x (原图原始大小) with click position as center
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(absoluteMaxScale, 1),
        ) // 1x = 原图原始大小

        // Calculate zoom point relative to current transform
        const zoomX =
          (mouseX - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY =
          (mouseY - this.canvasHeight / 2 - this.translateY) / this.scale

        // Calculate target translation after zoom
        const targetTranslateX =
          mouseX - this.canvasWidth / 2 - zoomX * targetScale
        const targetTranslateY =
          mouseY - this.canvasHeight / 2 - zoomY * targetScale

        this.startAnimation(
          targetScale,
          targetTranslateX,
          targetTranslateY,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = true
      }
    } else {
      // Zoom mode
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

      this.debouncedTextureUpdate()
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

    // 清理节流相关的资源
    if (this.renderThrottleId !== null) {
      cancelAnimationFrame(this.renderThrottleId)
      this.renderThrottleId = null
    }

    // 清理纹理防抖相关的资源
    if (this.textureDebounceId !== null) {
      clearTimeout(this.textureDebounceId)
      this.textureDebounceId = null
    }
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
  debug = false,
}: WebGLImageViewerProps & {
  ref?: React.RefObject<WebGLImageViewerRef | null>
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<WebGLImageViewerEngine | null>(null)
  const [debugInfo, setDebugInfo] = useState({
    scale: 1,
    relativeScale: 1,
    translateX: 0,
    translateY: 0,
    textureSize: { width: 0, height: 0 },
    canvasSize: { width: 0, height: 0 },
    imageSize: { width: 0, height: 0 },
    fitToScreenScale: 1,
    renderCount: 0,
    textureUpdateCount: 0,
  })

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
      debug: debug || false,
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
      debug,
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
        debug ? setDebugInfo : undefined,
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          border: 'none',
          outline: 'none',
          margin: 0,
          padding: 0,
          imageRendering: 'auto', // 让浏览器选择最佳的渲染方式
        }}
      />
      {debug && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            lineHeight: '1.4',
            pointerEvents: 'none',
            zIndex: 1000,
            minWidth: '200px',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            WebGL Debug Info
          </div>
          <div>Scale: {debugInfo.scale.toFixed(3)}</div>
          <div>Relative Scale: {debugInfo.relativeScale.toFixed(3)}</div>
          <div>
            Translate: ({debugInfo.translateX.toFixed(1)},{' '}
            {debugInfo.translateY.toFixed(1)})
          </div>
          <div>
            Canvas CSS: {debugInfo.canvasSize.width}×
            {debugInfo.canvasSize.height}
          </div>
          <div>
            Canvas Actual: {canvasRef.current?.width || 0}×
            {canvasRef.current?.height || 0}
          </div>
          <div>Device Pixel Ratio: {window.devicePixelRatio || 1}</div>
          <div>
            Image: {debugInfo.imageSize.width}×{debugInfo.imageSize.height}
          </div>
          <div>
            Texture: {debugInfo.textureSize.width}×
            {debugInfo.textureSize.height}
          </div>
          <div>Fit Scale: {debugInfo.fitToScreenScale.toFixed(3)}</div>
        </div>
      )}
    </div>
  )
}

WebGLImageViewer.displayName = 'WebGLImageViewer'

export type { WebGLImageViewerProps, WebGLImageViewerRef }
