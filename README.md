# Photo Gallery Site

一个现代化的照片画廊网站，支持从 S3 存储自动同步照片，具有瀑布流布局、EXIF 信息展示、缩略图生成等功能。

Preview: https://gallery.innei.in

## 特点

- HEIC/HEIF 格式支持
- 支持缩略图生成
- 支持 EXIF 信息展示
- 支持瀑布流布局
- 支持富士胶片模拟信息读取

## 环境配置

创建 `.env` 文件并配置以下环境变量：

```env
# S3 配置
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_BUCKET_NAME=your_bucket_name
S3_PREFIX=photos/
S3_CUSTOM_DOMAIN=your_custom_domain.com
```

## 🚀 使用

### 开发模式

```bash
pnpm dev
```

### 构建照片清单

```bash
# 增量更新（默认）
pnpm run build:manifest

# 全量更新
pnpm run build:manifest -- --force
```

### 测试 S3 连接

```bash
pnpm run test:s3
```

### 构建生产版本

```bash
pnpm run build
```

## License

2025 © Innei, Released under the MIT License.

> [Personal Website](https://innei.in/) · GitHub [@Innei](https://github.com/innei/)
