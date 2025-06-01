# Live Photo 功能使用指南

## 🎬 功能概述

Live Photo 功能让你可以在照片画廊中播放 iPhone Live Photo 的短视频动画。当检测到同名的图片和 `.mov` 视频文件时，系统会自动将它们识别为 Live Photo。

## 📋 功能特点

### ✨ 自动检测
- 自动识别同目录下同文件名的图片和 `.mov` 视频配对
- 支持所有主流图片格式（HEIC、JPG、PNG等）

### 🔄 智能转换
- 优先使用 **WebCodecs API** 进行高性能原生视频转换
- 降级到 **FFmpeg WASM** 作为兼容性备选方案
- 自动将 `.mov` 格式转换为浏览器兼容的 MP4
- 在线转换，无需上传到服务器
- 实时显示转换进度和使用的转换方法

### 🎮 交互体验
- **长按播放**：长按 300ms 开始播放 Live Photo 动画
- **自动停止**：松开手指或播放完毕自动停止
- **视觉反馈**：显示 "LIVE" 标识、转换状态和使用的转换引擎（WebCodecs/FFmpeg）

## 🚀 使用方法

### 1. 上传 Live Photo 文件

将 iPhone 拍摄的 Live Photo 文件上传到 S3 存储桶：

```
your-bucket/
├── photos/
│   ├── IMG_1234.HEIC    # 图片文件
│   └── IMG_1234.mov     # 对应的视频文件
```

**重要要求：**
- 图片和视频文件必须在同一目录
- 文件名必须相同（除扩展名外）
- 视频文件必须是 `.mov` 格式

### 2. 重新构建 Manifest

```bash
npm run build:manifest
```

构建过程中会显示：
```
ℹ 检测到 1 个 Live Photo
ℹ 📱 检测到 Live Photo：photos/IMG_1234.HEIC -> photos/IMG_1234.mov
```

### 3. 在前端查看

- Live Photo 会显示 **"LIVE"** 标识
- 首次查看时会自动转换视频格式（显示转换进度）
- 长按图片即可播放 Live Photo 动画

## 🛠️ 技术实现

### 后端检测逻辑
```typescript
// S3 扫描时检测 Live Photo 配对
export function detectLivePhotos(allObjects: _Object[]): Map<string, _Object> {
  // 按目录和基础文件名分组所有文件
  // 寻找图片+视频配对
  // 返回 Live Photo 映射
}
```

### 前端智能转换
```typescript
// 优先使用 WebCodecs API
if (isWebCodecsSupported()) {
  // 自动检测最佳编码器（H.264 High/Main/Baseline, VP8, VP9）
  const result = await convertVideoWithWebCodecs(livePhotoVideoUrl, onProgress)
  // 使用原生 VideoEncoder 进行高性能转换
  // 直接输出为 MP4/WebM 格式，无需复杂 muxing
} else {
  // 降级到 FFmpeg WASM
  const result = await convertVideoWithFFmpeg(livePhotoVideoUrl, onProgress)
  // 使用 FFmpeg 进行兼容性转换
}
```

## 🔧 浏览器兼容性

### WebCodecs API 支持（优先选择）
- ✅ Chrome 94+ (推荐)
- ✅ Edge 94+ (推荐)
- ⚠️ Firefox (实验性支持)
- ❌ Safari (未支持)

**编码器支持检测**：
- H.264 High Profile (优先)
- H.264 Main Profile (备选)
- H.264 Baseline Profile (兼容)
- VP8 (WebM 格式)
- VP9 (WebM 格式)

### FFmpeg WASM 支持（降级方案）
- ✅ Chrome 88+
- ✅ Firefox 79+
- ✅ Safari 14+
- ✅ Edge 88+

### 要求的特性
**WebCodecs API:**
- VideoEncoder/VideoDecoder API 支持
- Canvas API 支持
- 自动编码器检测和选择

**FFmpeg WASM（降级）:**
- WebAssembly 支持
- SharedArrayBuffer 支持（用于多线程处理）
- Web Workers 支持

### 智能降级处理
```typescript
// 检查 WebCodecs 支持和编码器兼容性
if (isWebCodecsSupported()) {
  // 尝试多种编码器配置
  const codecConfigs = [
    'H.264 High Profile',   // 最佳质量
    'H.264 Main Profile',   // 平衡
    'H.264 Baseline Profile', // 兼容性
    'VP8',                  // WebM
    'VP9'                   // 高效压缩
  ]
  
  for (const config of codecConfigs) {
    if (await VideoEncoder.isConfigSupported(config)) {
      // 使用找到的第一个支持的编码器
      break
    }
  }
} else {
  // 降级到 FFmpeg WASM
  console.info('Using FFmpeg WASM for video conversion...')
}
```

## 📊 性能优化

### WebCodecs 性能优势
- **原生编解码**：使用浏览器内置的硬件加速
- **零依赖**：无需加载额外的库文件
- **多编码器支持**：自动选择最佳编码器
- **简化输出**：直接生成可播放的视频格式

### 编码器选择策略
1. **H.264 High Profile** - 最佳质量，现代设备优选
2. **H.264 Main Profile** - 平衡质量和兼容性
3. **H.264 Baseline Profile** - 最佳兼容性
4. **VP8** - 开源格式，WebM 容器
5. **VP9** - 高效压缩，适合带宽受限环境

### FFmpeg 降级保障
- **广泛兼容**：支持更多浏览器
- **功能完整**：全面的视频处理能力
- **稳定可靠**：成熟的转换方案

## 🐛 故障排除

### WebCodecs 编码器不支持
```
错误：没有找到支持的视频编码器
原因：设备或浏览器不支持任何 WebCodecs 编码器
解决：系统会自动降级到 FFmpeg WASM
```

### 视频播放问题
```
现象：转换成功但无法播放
原因：浏览器不支持生成的视频格式
建议：检查浏览器对 H.264/VP8/VP9 的支持
```

### 转换性能问题
```
现象：WebCodecs 转换慢于预期
原因：设备缺乏硬件加速支持
建议：系统会自动选择最合适的编码器
```

## �� 统计信息

从构建日志和浏览器控制台中可以看到：
- 检测到的 Live Photo 数量
- 使用的转换方法（WebCodecs/FFmpeg）
- 选择的编码器类型
- 转换性能统计

```
ℹ 检测到 1 个 Live Photo
✔ ✅ 处理完成：人文/IMG_1201.HEIC
ℹ 📱 检测到 Live Photo：人文/IMG_1201.HEIC -> 人文/IMG_1201.mov

// 浏览器控制台
Using WebCodecs for video conversion...
WebCodecs: Using H.264 High Profile encoder
WebCodecs conversion completed successfully
Video conversion completed using webcodecs. Size: 245KB
```

## 🔮 未来改进

- [ ] 支持更多视频格式（MP4、WEBM等）
- [ ] WebCodecs API 的更多浏览器支持
- [ ] 批量转换优化
- [ ] 离线缓存转换结果
- [ ] 更丰富的播放控制选项
- [ ] 硬件加速检测和优化 