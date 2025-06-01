import { buildManifest, logger } from '../src/core/index.js'

// 解析命令行参数
const args = process.argv.slice(2)
const isForceMode = args.includes('--force')
const isForceManifest = args.includes('--force-manifest')
const isForceThumbnails = args.includes('--force-thumbnails')

// 解析 --worker 参数
let concurrencyLimit = 10 // 默认并发数
const workerIndex = args.indexOf('--worker')
if (workerIndex !== -1 && workerIndex + 1 < args.length) {
  const workerValue = Number(args[workerIndex + 1])
  if (!Number.isNaN(workerValue) && workerValue > 0) {
    concurrencyLimit = workerValue
  } else {
    logger.main.warn(
      `无效的 --worker 参数值：${args[workerIndex + 1]}，使用默认值 ${concurrencyLimit}`,
    )
  }
}

// 确定运行模式
let runMode = '增量更新'
if (isForceMode) {
  runMode = '全量更新'
} else if (isForceManifest && isForceThumbnails) {
  runMode = '强制刷新 manifest 和缩略图'
} else if (isForceManifest) {
  runMode = '强制刷新 manifest'
} else if (isForceThumbnails) {
  runMode = '强制刷新缩略图'
}

logger.main.info(`🚀 运行模式：${runMode}`)
logger.main.info(`⚡ 并发数：${concurrencyLimit}`)

// 启动构建过程
buildManifest({
  isForceMode,
  isForceManifest,
  isForceThumbnails,
  concurrencyLimit,
}).catch((error) => {
  logger.main.error('构建失败：', error)
  throw error
})
