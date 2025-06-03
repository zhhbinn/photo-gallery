import { isSafari } from './device-viewport'
import { LRUCache } from './lru-cache'

interface ConversionProgress {
  isConverting: boolean
  progress: number
  message: string
}

interface ConversionResult {
  success: boolean
  videoUrl?: string
  error?: string
  convertedSize?: number
  method?: 'webcodecs'
}

// Global video cache instance using the generic LRU cache with custom cleanup
const videoCache: LRUCache<string, ConversionResult> = new LRUCache<
  string,
  ConversionResult
>(10, (value, key, reason) => {
  if (value.videoUrl) {
    try {
      URL.revokeObjectURL(value.videoUrl)
      console.info(`Video cache: Revoked blob URL - ${reason}`)
    } catch (error) {
      console.warn(`Failed to revoke video blob URL (${reason}):`, error)
    }
  }
})

// Export cache management functions
export function getVideoCacheSize(): number {
  return videoCache.size()
}

export function clearVideoCache(): void {
  videoCache.clear()
}

export function getCachedVideo(url: string): ConversionResult | undefined {
  return videoCache.get(url)
}

/**
 * Remove a specific video from cache and clean up its blob URL
 */
export function removeCachedVideo(url: string): boolean {
  return videoCache.delete(url)
}

/**
 * Get detailed cache statistics for debugging
 */
export function getVideoCacheStats(): {
  size: number
  maxSize: number
  keys: string[]
} {
  return videoCache.getStats()
}

// 检查 WebCodecs 支持
export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof EncodedVideoChunk !== 'undefined'
  )
}

// 检查浏览器是否支持视频转换（WebCodecs 或 FFmpeg）
export function isVideoConversionSupported(): boolean {
  return (
    isWebCodecsSupported() ||
    (typeof WebAssembly !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof SharedArrayBuffer !== 'undefined')
  )
}

// 使用 WebCodecs 转换视频
function convertVideoWithWebCodecs(
  videoUrl: string,
  onProgress?: (progress: ConversionProgress) => void,
  preferMp4 = true, // 新增参数：是否优先选择MP4格式
): Promise<ConversionResult> {
  return new Promise((resolve) => {
    const processVideo = async () => {
      try {
        onProgress?.({
          isConverting: true,
          progress: 0,
          message: '正在初始化 WebCodecs 转换器...',
        })

        // 创建视频元素来读取源视频
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.playsInline = true

        onProgress?.({
          isConverting: true,
          progress: 10,
          message: '正在加载视频文件...',
        })

        // 等待视频加载
        await new Promise<void>((videoResolve, videoReject) => {
          video.onloadedmetadata = () => videoResolve()
          video.onerror = () => videoReject(new Error('Failed to load video'))
          video.src = videoUrl
        })

        const { videoWidth, videoHeight, duration } = video

        // 获取原视频的实际帧率，使用多种方法检测
        let actualFrameRate = 29.97 // 默认值

        console.info(
          `Original video: ${videoWidth}x${videoHeight}, duration: ${duration}s`,
        )

        // 对于短视频（Live Photo等），优先使用智能估算，因为更可靠
        if (duration <= 5) {
          // Live Photo和短视频通常使用特定的帧率
          const commonFrameRates = [23.976, 24, 25, 29.97, 30, 60]

          console.info(
            `Short video detected (${duration}s), using intelligent frame rate estimation`,
          )

          // 尝试每个帧率，找到产生最接近整数的帧数
          let bestFrameRate = 29.97
          let minFrameDiff = Infinity
          const results: Array<{
            rate: number
            frames: number
            rounded: number
            diff: number
          }> = []

          for (const testFrameRate of commonFrameRates) {
            const testFrames = duration * testFrameRate
            const roundedFrames = Math.round(testFrames)
            const frameDiff = Math.abs(testFrames - roundedFrames)

            results.push({
              rate: testFrameRate,
              frames: testFrames,
              rounded: roundedFrames,
              diff: frameDiff,
            })

            if (frameDiff < minFrameDiff) {
              minFrameDiff = frameDiff
              bestFrameRate = testFrameRate
            }
          }

          // 显示所有测试结果
          console.info('Frame rate estimation results:')
          results.forEach((r) => {
            const marker = r.rate === bestFrameRate ? ' ✓' : ''
            console.info(
              `  ${r.rate} fps: ${r.frames.toFixed(2)} frames (rounded: ${r.rounded}, diff: ${r.diff.toFixed(3)})${marker}`,
            )
          })

          // 如果找到了很好的匹配（帧数差异小于1帧）
          if (minFrameDiff < 1) {
            actualFrameRate = bestFrameRate
            const estimatedFrames = Math.round(duration * actualFrameRate)
            console.info(
              `✓ Selected frame rate for short video: ${actualFrameRate} fps (${estimatedFrames} frames, diff: ${minFrameDiff.toFixed(3)})`,
            )
          } else {
            // 如果没有很好的匹配，使用最常见的Live Photo帧率
            actualFrameRate = 29.97
            console.info(
              `⚠ No good match found, using default Live Photo frame rate: ${actualFrameRate} fps`,
            )
          }
        }
        // 对于较长的视频，才使用复杂的检测方法
        else {
          // 方法1: 使用getVideoPlaybackQuality（Chrome/Edge）- 仅用于长视频
          if ('getVideoPlaybackQuality' in video) {
            try {
              // 让视频播放一段时间来累积准确的帧数据
              video.currentTime = 0
              await new Promise((resolve) => setTimeout(resolve, 100))

              // 播放视频来获取准确的帧率信息
              const playPromise = video.play()
              if (playPromise) {
                await playPromise.catch(() => {}) // 忽略播放错误
              }

              // 等待足够时间累积帧数据
              await new Promise((resolve) => setTimeout(resolve, 500))

              const quality1 = (video as any).getVideoPlaybackQuality?.()
              const time1 = video.currentTime

              if (quality1 && time1 > 0.3) {
                // 确保有足够的播放时间
                // 继续播放更长时间来获得更准确的数据
                await new Promise((resolve) => setTimeout(resolve, 300))

                const quality2 = (video as any).getVideoPlaybackQuality?.()
                const time2 = video.currentTime

                if (quality2 && time2 > time1) {
                  const frameDiff =
                    quality2.totalVideoFrames - quality1.totalVideoFrames
                  const timeDiff = time2 - time1

                  if (frameDiff > 0 && timeDiff > 0.2) {
                    const estimatedFrameRate = frameDiff / timeDiff
                    console.info(
                      `Raw frame rate calculation: ${frameDiff} frames in ${timeDiff.toFixed(3)}s = ${estimatedFrameRate.toFixed(2)} fps`,
                    )

                    // 将检测到的帧率四舍五入到常见的帧率值
                    const commonFrameRates = [
                      23.976, 24, 25, 29.97, 30, 50, 59.94, 60,
                    ]
                    let bestMatch = estimatedFrameRate
                    let minDiff = Infinity

                    for (const rate of commonFrameRates) {
                      const diff = Math.abs(estimatedFrameRate - rate)
                      if (diff < minDiff && diff < 2) {
                        // 容差2fps
                        minDiff = diff
                        bestMatch = rate
                      }
                    }

                    if (bestMatch >= 15 && bestMatch <= 120) {
                      actualFrameRate = bestMatch
                      console.info(
                        `Frame rate detected via getVideoPlaybackQuality (long video): ${actualFrameRate} fps`,
                      )
                    }
                  }
                }
              }

              // 暂停视频
              video.pause()
            } catch (error) {
              console.warn('getVideoPlaybackQuality detection failed:', error)
              video.pause() // 确保视频被暂停
            }
          }

          // 方法2: 尝试通过视频元素的mozFrameDelay属性（Firefox）
          if (
            actualFrameRate === 29.97 &&
            'mozDecodedFrames' in video &&
            'mozPresentedFrames' in video
          ) {
            try {
              // 播放一小段视频来获取帧信息
              video.currentTime = Math.min(0.5, duration * 0.3)
              await new Promise((resolve) => {
                const onSeeked = () => {
                  video.removeEventListener('seeked', onSeeked)
                  resolve(void 0)
                }
                video.addEventListener('seeked', onSeeked)
                setTimeout(resolve, 200)
              })

              const frames = (video as any).mozPresentedFrames
              if (frames && video.currentTime > 0) {
                const estimatedFR = frames / video.currentTime
                if (estimatedFR > 15 && estimatedFR <= 120) {
                  actualFrameRate = Math.round(estimatedFR * 100) / 100
                  console.info(
                    `Frame rate detected via mozPresentedFrames: ${actualFrameRate} fps`,
                  )
                }
              }
            } catch (error) {
              console.warn('mozPresentedFrames detection failed:', error)
            }
          }
        }

        // 重置视频到开始位置
        video.currentTime = 0
        await new Promise((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve(void 0)
          }
          video.addEventListener('seeked', onSeeked)
          setTimeout(resolve, 100)
        })

        const frameRate = actualFrameRate
        const totalFrames = Math.ceil(duration * frameRate)

        console.info(
          `Final video processing config: ${videoWidth}x${videoHeight}, ${duration}s, ${frameRate}fps, ${totalFrames} frames`,
        )

        // 计算高质量比特率 - 大幅提高质量
        const pixelCount = videoWidth * videoHeight
        const getQualityBitrate = (multiplier: number, maxBitrate: number) => {
          // 基于分辨率的动态比特率计算
          let baseBitrate = pixelCount * multiplier

          // 为高分辨率视频提供更高的比特率
          if (pixelCount >= 1920 * 1080) {
            // 1080p及以上
            baseBitrate *= 1.5
          } else if (pixelCount >= 1280 * 720) {
            // 720p
            baseBitrate *= 1.2
          }

          return Math.min(baseBitrate, maxBitrate)
        }

        onProgress?.({
          isConverting: true,
          progress: 20,
          message: '正在检测编码器支持...',
        })

        // 高质量编码器配置，重新排序优先高质量编码器
        const codecConfigs: Array<{
          name: string
          config: VideoEncoderConfig
          priority: number // 添加优先级字段
        }> = [
          // 更多H.264配置选项，提高兼容性
          {
            name: 'H.264 High Profile',
            priority: preferMp4 ? 1 : 7,
            config: {
              codec: 'avc1.64002A', // H.264 High Profile Level 4.2
              width: videoWidth,
              height: videoHeight,
              bitrate: getQualityBitrate(4, 50000000),
              framerate: frameRate,
              avc: { format: 'avc' as const },
            },
          },
          {
            name: 'H.264 Main Profile (Level 3.1)',
            priority: preferMp4 ? 2 : 8,
            config: {
              codec: 'avc1.4D401F', // H.264 Main Profile Level 3.1 - 更低级别，更兼容
              width: videoWidth,
              height: videoHeight,
              bitrate: getQualityBitrate(3.5, 40000000),
              framerate: frameRate,
              avc: { format: 'avc' as const },
            },
          },
          {
            name: 'H.264 Main Profile',
            priority: preferMp4 ? 3 : 9,
            config: {
              codec: 'avc1.4D4029', // H.264 Main Profile Level 4.1
              width: videoWidth,
              height: videoHeight,
              bitrate: getQualityBitrate(3.5, 40000000),
              framerate: frameRate,
              avc: { format: 'avc' as const },
            },
          },
          {
            name: 'H.264 Baseline Profile (Level 3.0)',
            priority: preferMp4 ? 4 : 10,
            config: {
              codec: 'avc1.42E01E', // H.264 Baseline Profile Level 3.0 - 最兼容
              width: Math.min(videoWidth, 1280), // 限制分辨率提高兼容性
              height: Math.min(videoHeight, 720),
              bitrate: getQualityBitrate(2.5, 25000000),
              framerate: Math.min(frameRate, 30), // 限制帧率
              avc: { format: 'avc' as const },
            },
          },
          {
            name: 'H.264 Baseline Profile',
            priority: preferMp4 ? 5 : 11,
            config: {
              codec: 'avc1.42E01E', // H.264 Baseline Profile
              width: videoWidth,
              height: videoHeight,
              bitrate: getQualityBitrate(3, 30000000),
              framerate: frameRate,
              avc: { format: 'avc' as const },
            },
          },
          {
            name: 'VP9 Profile 0',
            priority: preferMp4 ? 6 : 1, // WebM优先时排第一
            config: {
              codec: 'vp09.00.10.08', // VP9 Profile 0 - 高效率高质量
              width: videoWidth,
              height: videoHeight,
              bitrate: getQualityBitrate(3, 35000000),
              framerate: frameRate,
            },
          },
          {
            name: 'VP8',
            priority: preferMp4 ? 7 : 2,
            config: {
              codec: 'vp8',
              width: videoWidth,
              height: videoHeight,
              bitrate: getQualityBitrate(2.5, 25000000),
              framerate: frameRate,
            },
          },
        ]

        // 根据优先级排序
        codecConfigs.sort((a, b) => a.priority - b.priority)

        let selectedConfig: VideoEncoderConfig | null = null
        let selectedCodecName = ''
        let h264Attempted = false
        const h264FailureReasons: string[] = []

        console.info('🔍 Starting codec detection process...')
        console.info(
          `📋 Format preference: ${preferMp4 ? 'MP4 (H.264)' : 'WebM (VP8/VP9)'} formats preferred`,
        )

        // 测试编码器支持，同时检查 VideoEncoder 和 MediaRecorder 支持
        for (const { name, config, priority } of codecConfigs) {
          console.info(`\n📋 Testing codec: ${name} (Priority: ${priority})`)
          console.info(`   Codec string: ${config.codec}`)
          console.info(`   Resolution: ${config.width}x${config.height}`)
          console.info(
            `   Bitrate: ${(config.bitrate! / 1000000).toFixed(1)}Mbps`,
          )

          try {
            // 记录H.264尝试
            if (name.includes('H.264')) {
              h264Attempted = true
            }

            // 首先检查 VideoEncoder 支持
            console.info(`   🔧 Checking VideoEncoder support...`)
            const support = await VideoEncoder.isConfigSupported(config)
            console.info(
              `   VideoEncoder support: ${support.supported ? '✅ YES' : '❌ NO'}`,
            )

            if (!support.supported) {
              if (name.includes('H.264')) {
                h264FailureReasons.push(`${name}: VideoEncoder not supported`)
              }
              console.warn(
                `   ⚠️ ${name} VideoEncoder not supported - skipping`,
              )
              continue
            }

            // 然后检查对应的 MediaRecorder 支持
            let mimeType: string
            if (config.codec.startsWith('vp09')) {
              mimeType = 'video/webm; codecs="vp09.00.10.08"'
            } else if (config.codec.startsWith('vp8')) {
              mimeType = 'video/webm; codecs="vp8"'
            } else if (config.codec.includes('64002A')) {
              mimeType = 'video/mp4; codecs="avc1.64002A"' // High Profile
            } else if (config.codec.includes('4D401F')) {
              mimeType = 'video/mp4; codecs="avc1.4D401F"' // Main Profile Level 3.1
            } else if (config.codec.includes('4D4029')) {
              mimeType = 'video/mp4; codecs="avc1.4D4029"' // Main Profile
            } else {
              mimeType = 'video/mp4; codecs="avc1.42E01E"' // Baseline
            }

            console.info(
              `   📺 Checking MediaRecorder support for: ${mimeType}`,
            )

            // 检查 MediaRecorder 是否支持这个 MIME 类型
            const mediaRecorderSupported =
              MediaRecorder.isTypeSupported(mimeType)
            console.info(
              `   MediaRecorder support: ${mediaRecorderSupported ? '✅ YES' : '❌ NO'}`,
            )

            if (!mediaRecorderSupported) {
              if (name.includes('H.264')) {
                h264FailureReasons.push(
                  `${name}: MediaRecorder not supported (${mimeType})`,
                )
              }
              console.warn(
                `   ⚠️ ${name} MediaRecorder not supported (${mimeType}) - skipping`,
              )
              continue
            }

            // 两者都支持，选择此编码器
            selectedConfig = config
            selectedCodecName = name
            console.info(`   🎉 SELECTED: ${name} encoder (${mimeType})`)
            console.info(`   🏆 Winner! Using this codec for conversion`)
            break
          } catch (error) {
            if (name.includes('H.264')) {
              h264FailureReasons.push(`${name}: Exception - ${error}`)
            }
            console.warn(`   ❌ Failed to check ${name} support:`, error)
          }
        }

        // 添加选择结果总结和H.264故障排除建议
        if (selectedConfig) {
          const outputFormat = selectedCodecName.includes('H.264')
            ? 'MP4'
            : 'WebM'
          console.info(`\n🏁 CODEC SELECTION SUMMARY:`)
          console.info(`   Selected: ${selectedCodecName}`)
          console.info(`   Output format: ${outputFormat}`)
          console.info(
            `   Bitrate: ${(selectedConfig.bitrate! / 1000000).toFixed(1)}Mbps`,
          )
          console.info(`   User preference: ${preferMp4 ? 'MP4' : 'WebM'}`)
          console.info(
            `   Preference matched: ${(preferMp4 && outputFormat === 'MP4') || (!preferMp4 && outputFormat === 'WebM') ? '✅ YES' : '❌ NO'}`,
          )

          // 如果用户想要MP4但选择了WebM，提供故障排除建议
          if (preferMp4 && outputFormat === 'WebM' && h264Attempted) {
            console.info(`\n🛠️ H.264 TROUBLESHOOTING:`)
            console.info(
              `   H.264 codecs were not available. Possible solutions:`,
            )
            console.info(`   1. Update Chrome to latest version`)
            console.info(
              `   2. Enable chrome://flags/#enable-experimental-web-platform-features`,
            )
            console.info(
              `   3. Check if hardware H.264 encoding is supported on your system`,
            )
            console.info(`   4. On Windows: Install/update Media Feature Pack`)
            console.info(`   5. On macOS: Check system codec availability`)
            console.info(`\n   H.264 Failure reasons:`)
            h264FailureReasons.forEach((reason, index) => {
              console.info(`   ${index + 1}. ${reason}`)
            })
          }
        }

        if (!selectedConfig) {
          // 如果没有找到支持的编码器，列出所有尝试过的编码器
          const attemptedCodecs = codecConfigs.map(({ name, config }) => ({
            name,
            codec: config.codec,
          }))
          console.error(
            'No supported video encoder found. Attempted codecs:',
            attemptedCodecs,
          )

          // 尝试最基本的配置作为最后的回退
          try {
            const fallbackMimeType = 'video/webm'
            if (MediaRecorder.isTypeSupported(fallbackMimeType)) {
              console.info('Attempting fallback with basic webm format')
              selectedConfig = {
                codec: 'vp8', // 基础配置
                width: videoWidth,
                height: videoHeight,
                bitrate: getQualityBitrate(2, 20000000), // 回退也提高质量
                framerate: frameRate,
              }
              selectedCodecName = 'VP8 Fallback'
            }
          } catch (fallbackError) {
            console.error('Fallback codec also failed:', fallbackError)
          }

          if (!selectedConfig) {
            throw new Error(
              '没有找到任何支持的视频编码器，浏览器可能不支持视频转换',
            )
          }
        }

        onProgress?.({
          isConverting: true,
          progress: 30,
          message: `正在使用 ${selectedCodecName} 编码器...`,
        })

        // 使用 MediaRecorder 作为容器生成器
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', {
          alpha: false, // 禁用 alpha 通道以提高性能和质量
          desynchronized: false, // 确保同步渲染
        })!
        canvas.width = videoWidth
        canvas.height = videoHeight

        // 设置最高质量绘制参数
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        // 添加更多质量优化设置
        if ('filter' in ctx) {
          ctx.filter = 'none' // 避免额外的滤镜处理
        }

        // 添加比特率信息日志
        console.info('Selected encoder:', selectedCodecName)
        console.info('Bitrate:', selectedConfig.bitrate, 'bps')
        console.info(
          'Bitrate (Mbps):',
          ((selectedConfig.bitrate || 0) / 1000000).toFixed(2),
        )

        // 使用 canvas stream 和 MediaRecorder，最高质量录制

        const outputFrameRate = frameRate
        console.info(`Using output frame rate: ${outputFrameRate} fps`)

        const stream = canvas.captureStream(outputFrameRate)

        // 根据选择的编码器设置对应的 MIME 类型（已在上面验证过支持）
        let mimeType: string
        if (selectedConfig.codec.startsWith('vp09')) {
          mimeType = 'video/webm; codecs="vp09.00.10.08"'
        } else if (selectedConfig.codec.startsWith('vp8')) {
          mimeType =
            selectedCodecName === 'VP8 Fallback'
              ? 'video/webm'
              : 'video/webm; codecs="vp8"'
        } else if (selectedConfig.codec.includes('64002A')) {
          mimeType = 'video/mp4; codecs="avc1.64002A"' // High Profile
        } else if (selectedConfig.codec.includes('4D4029')) {
          mimeType = 'video/mp4; codecs="avc1.4D4029"' // Main Profile
        } else {
          mimeType = 'video/mp4; codecs="avc1.42E01E"' // Baseline
        }

        console.info('Using MediaRecorder with mimeType:', mimeType)

        // MediaRecorder配置优化 - 确保帧率一致性
        const mediaRecorderOptions: MediaRecorderOptions = {
          mimeType,
          videoBitsPerSecond: selectedConfig.bitrate, // 使用与编码器相同的比特率
        }

        // 如果支持，添加更多质量选项
        if ('videoKeyFrameIntervalDuration' in MediaRecorder.prototype) {
          ;(mediaRecorderOptions as any).videoKeyFrameIntervalDuration = 1000 // 1秒关键帧间隔
        }

        const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions)

        const recordedChunks: Blob[] = []
        let frameCount = 0
        let isRecording = false
        let startTime = Date.now()

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          const processingTime = (Date.now() - startTime) / 1000
          console.info(
            `Video processing took ${processingTime.toFixed(2)}s for ${duration.toFixed(3)}s video`,
          )

          onProgress?.({
            isConverting: true,
            progress: 90,
            message: '正在生成视频文件...',
          })

          const blob = new Blob(recordedChunks, {
            type: mediaRecorder.mimeType,
          })
          const url = URL.createObjectURL(blob)

          onProgress?.({
            isConverting: false,
            progress: 100,
            message: '转换完成',
          })

          resolve({
            success: true,
            videoUrl: url,
            convertedSize: blob.size,
            method: 'webcodecs',
          })
        }

        mediaRecorder.onerror = (error) => {
          console.error('MediaRecorder error:', error)
          resolve({
            success: false,
            error: `录制器错误：${error}`,
          })
        }

        onProgress?.({
          isConverting: true,
          progress: 40,
          message: '正在转换视频帧...',
        })

        // 开始录制 - 使用更小的数据块间隔确保精度
        mediaRecorder.start(50) // 每50ms收集一次数据块
        isRecording = true
        startTime = Date.now()

        let averageFrameTime = 33 // 初始估计：30fps = 33ms/frame

        // 优化的逐帧处理视频 - 使用精确的时间控制
        const processFrame = async (frameIndex: number) => {
          const frameStartTime = Date.now()

          if (frameIndex >= totalFrames) {
            // 处理完成
            const actualDuration = (Date.now() - startTime) / 1000
            console.info(
              `Video processing completed: processed ${frameCount} frames out of ${totalFrames} expected in ${actualDuration.toFixed(2)}s`,
            )
            console.info(
              `Expected output duration: ${duration.toFixed(3)}s, Processing rate: ${(frameCount / actualDuration).toFixed(1)} fps`,
            )
            console.info(
              `Average frame processing time: ${averageFrameTime.toFixed(1)}ms`,
            )

            if (isRecording) {
              // 等待一下确保最后的帧被处理
              setTimeout(() => {
                mediaRecorder.stop()
                isRecording = false
              }, 100)
            }
            return
          }

          // 使用更精确的时间戳计算，基于原始帧率
          const timestamp = frameIndex / frameRate
          const isLastFrame = frameIndex === totalFrames - 1

          // 对于最后一帧，确保不超过视频时长
          const finalTimestamp = isLastFrame
            ? Math.min(timestamp, duration - 0.001)
            : timestamp

          if (finalTimestamp >= duration) {
            console.info(
              `Reached end of video at frame ${frameIndex}, stopping conversion`,
            )
            if (isRecording) {
              setTimeout(() => {
                mediaRecorder.stop()
                isRecording = false
              }, 100)
            }
            return
          }

          // 精确设置视频时间
          video.currentTime = finalTimestamp

          // 简化的等待逻辑 - 减少等待时间
          await new Promise<void>((frameResolve) => {
            let resolved = false

            const onSeeked = () => {
              if (!resolved) {
                resolved = true
                video.removeEventListener('seeked', onSeeked)
                video.removeEventListener('timeupdate', onTimeUpdate)
                frameResolve()
              }
            }

            const onTimeUpdate = () => {
              // 使用更宽松的时间匹配，提高处理速度
              const tolerance = 1 / frameRate // 1帧时间的容差
              if (
                !resolved &&
                Math.abs(video.currentTime - finalTimestamp) <= tolerance
              ) {
                resolved = true
                video.removeEventListener('timeupdate', onTimeUpdate)
                video.removeEventListener('seeked', onSeeked)
                frameResolve()
              }
            }

            video.addEventListener('seeked', onSeeked)
            video.addEventListener('timeupdate', onTimeUpdate)

            // 减少超时时间，提高处理速度
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                video.removeEventListener('seeked', onSeeked)
                video.removeEventListener('timeupdate', onTimeUpdate)
                frameResolve()
              }
            }, 100) // 减少到100ms
          })

          // 减少动画帧等待，只等待一个帧
          await new Promise((resolve) => {
            requestAnimationFrame(resolve)
          })

          // 验证视频是否已准备好绘制
          if (video.readyState >= 2) {
            // HAVE_CURRENT_DATA
            // 高质量绘制当前帧到 canvas
            ctx.save()
            ctx.clearRect(0, 0, videoWidth, videoHeight) // 清除画布确保干净的帧

            try {
              ctx.drawImage(video, 0, 0, videoWidth, videoHeight)
            } catch (drawError) {
              console.warn(`Frame ${frameIndex}: Draw error:`, drawError)
              // 简化错误处理，不重试
            }

            ctx.restore()
          } else {
            console.warn(
              `Frame ${frameIndex}: Video not ready for drawing (readyState: ${video.readyState})`,
            )
          }

          frameCount++

          // 计算帧处理时间并更新平均值
          const frameProcessingTime = Date.now() - frameStartTime
          averageFrameTime = averageFrameTime * 0.9 + frameProcessingTime * 0.1 // 指数移动平均

          // 更新进度
          const progress = 40 + (frameCount / totalFrames) * 45
          onProgress?.({
            isConverting: true,
            progress,
            message: `正在转换视频帧... ${frameCount}/${totalFrames} (${selectedCodecName}) - ${video.currentTime.toFixed(3)}s/${duration.toFixed(3)}s`,
          })

          // 自适应处理间隔 - 根据实际处理时间调整
          const targetFrameTime = 1000 / frameRate // 目标帧时间
          const processingRatio = frameProcessingTime / targetFrameTime

          let nextFrameDelay: number
          if (processingRatio > 0.8) {
            // 处理时间接近目标帧时间，立即处理下一帧
            nextFrameDelay = 1
          } else {
            // 有时间余量，稍微延迟以避免过快处理
            nextFrameDelay = Math.max(8, targetFrameTime * 0.5)
          }

          // 每10帧输出一次性能统计
          if (frameIndex % 10 === 0 && frameIndex > 0) {
            const currentFps = frameCount / ((Date.now() - startTime) / 1000)
            console.info(
              `Frame ${frameIndex}: Processing ${currentFps.toFixed(1)} fps, avg frame time: ${averageFrameTime.toFixed(1)}ms`,
            )
          }

          setTimeout(() => processFrame(frameIndex + 1), nextFrameDelay)
        }

        // 开始处理第一帧
        await processFrame(0)
      } catch (error) {
        console.error('WebCodecs conversion failed:', error)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'WebCodecs 转换失败',
        })
      }
    }

    processVideo()
  })
}

// 检测浏览器是否原生支持 MOV 格式
function isBrowserSupportMov(): boolean {
  // 创建一个临时的 video 元素来测试格式支持
  const video = document.createElement('video')

  // 检测是否支持 MOV 容器格式
  const canPlayMov = video.canPlayType('video/quicktime')

  // Safari 通常原生支持 MOV
  if (isSafari) {
    return true
  }

  // 对于其他浏览器，只有当 canPlayType 明确返回支持时才认为支持
  // 'probably' 或 'maybe' 表示支持，空字符串表示不支持
  return canPlayMov === 'probably' || canPlayMov === 'maybe'
}

// 检测是否需要转换 mov 文件
export function needsVideoConversion(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  const isMovFile = lowerUrl.includes('.mov') || lowerUrl.endsWith('.mov')

  // 如果不是 MOV 文件，不需要转换
  if (!isMovFile) {
    return false
  }

  // 如果浏览器原生支持 MOV，不需要转换
  if (isBrowserSupportMov()) {
    console.info('Browser natively supports MOV format, skipping conversion')
    return false
  }

  // 浏览器不支持 MOV，需要转换
  console.info('Browser does not support MOV format, conversion needed')
  return true
}

export async function convertMovToMp4(
  videoUrl: string,
  onProgress?: (progress: ConversionProgress) => void,
  forceReconvert = false, // 添加强制重新转换参数
  preferMp4 = true, // 新增参数：是否优先选择MP4格式
): Promise<ConversionResult> {
  // Check cache first, unless forced to reconvert
  if (!forceReconvert) {
    const cachedResult = videoCache.get(videoUrl)
    if (cachedResult) {
      console.info('Using cached video conversion result')
      onProgress?.({
        isConverting: false,
        progress: 100,
        message: '使用缓存结果',
      })
      return cachedResult
    }
  } else {
    console.info('Force reconversion: clearing cached result for', videoUrl)
    videoCache.delete(videoUrl)
  }

  // 优先尝试 WebCodecs
  if (isWebCodecsSupported()) {
    console.info('Using WebCodecs for HIGH QUALITY video conversion...')
    console.info(
      `🎯 Target format: ${preferMp4 ? 'MP4 (H.264)' : 'WebM (VP8/VP9)'}`,
    )
    onProgress?.({
      isConverting: true,
      progress: 0,
      message: '使用高质量 WebCodecs 转换器...',
    })

    const result = await convertVideoWithWebCodecs(
      videoUrl,
      onProgress,
      preferMp4,
    )

    // Cache the result if successful
    if (result.success) {
      videoCache.set(videoUrl, result)
      console.info('WebCodecs conversion completed successfully and cached')
    } else {
      console.warn(
        'WebCodecs conversion failed, falling back to FFmpeg:',
        result.error,
      )
    }

    return result
  }

  const fallbackResult = {
    success: false,
    error: '浏览器不支持 webcodecs，Live Photo 转换失败',
  }

  // Cache failed result to avoid repeated attempts
  videoCache.set(videoUrl, fallbackResult)

  return fallbackResult
}
