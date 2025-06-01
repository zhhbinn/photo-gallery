import { buildManifest } from './builder/index.js'
import { logger } from './logger/index.js'

async function main() {
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

  // 显示帮助信息
  if (args.includes('--help') || args.includes('-h')) {
    logger.main.info(`
照片库构建工具

用法：tsx src/core/cli.ts [选项]

选项：
  --force              强制重新处理所有照片
  --force-manifest     强制重新生成 manifest
  --force-thumbnails   强制重新生成缩略图
  --worker <数量>      并发 worker 数量 (默认：10)
  --help, -h          显示帮助信息

示例：
  tsx src/core/cli.ts                           # 增量更新
  tsx src/core/cli.ts --force                   # 全量更新
  tsx src/core/cli.ts --force-thumbnails        # 强制重新生成缩略图
  tsx src/core/cli.ts --worker 5                # 使用 5 个并发 worker
  tsx src/core/cli.ts --force-manifest --worker 20  # 强制刷新 manifest，使用 20 个 worker
`)
    return
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
  await buildManifest({
    isForceMode,
    isForceManifest,
    isForceThumbnails,
    concurrencyLimit,
  })
}

// 运行主函数
main().catch((error) => {
  logger.main.error('构建失败：', error)
  throw error
})
