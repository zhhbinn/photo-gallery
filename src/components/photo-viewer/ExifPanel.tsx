import './PhotoViewer.css'

import type { Exif } from 'exif-reader'
import { m } from 'motion/react'
import type { FC } from 'react'
import { Fragment } from 'react'

import {
  CarbonIsoOutline,
  MaterialSymbolsShutterSpeed,
  StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens,
  TablerAperture,
} from '~/icons'
import type { PhotoManifest } from '~/types/photo'

export const ExifPanel: FC<{
  currentPhoto: PhotoManifest
  exifData: Exif | null
}> = ({ currentPhoto, exifData }) => {
  const formattedExifData = formatExifData(exifData)
  return (
    <m.div
      className="w-80 bg-material-medium p-4 shrink-0 text-white overflow-y-auto z-10 backdrop-blur-3xl"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="text-lg font-semibold mb-4">图片信息</h3>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-white/80 mb-2">基本信息</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">文件名</span>
              <span>{currentPhoto.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">尺寸</span>
              <span>
                {currentPhoto.width} × {currentPhoto.height}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">文件大小</span>
              <span>{(currentPhoto.size / 1024 / 1024).toFixed(1)}MB</span>
            </div>
            {formattedExifData?.colorSpace && (
              <div className="flex justify-between">
                <span className="text-white/60">色彩空间</span>
                <span>{formattedExifData.colorSpace}</span>
              </div>
            )}
          </div>
        </div>

        {formattedExifData && (
          <Fragment>
            {(formattedExifData.camera || formattedExifData.lens) && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">
                  设备信息
                </h4>
                <div className="space-y-1 text-sm">
                  {formattedExifData.camera && (
                    <Row label="相机" value={formattedExifData.camera} />
                  )}
                  {formattedExifData.lens && (
                    <Row label="镜头" value={formattedExifData.lens} />
                  )}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-white/80 mb-2">
                拍摄参数
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {formattedExifData.focalLength35mm && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens className="text-white/70 text-sm" />
                    <span className="text-xs">
                      {formattedExifData.focalLength35mm}mm
                    </span>
                  </div>
                )}

                {formattedExifData.aperture && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <TablerAperture className="text-white/70 text-sm" />
                    <span className="text-xs">
                      {formattedExifData.aperture}
                    </span>
                  </div>
                )}

                {formattedExifData.shutterSpeed && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <MaterialSymbolsShutterSpeed className="text-white/70 text-sm" />
                    <span className="text-xs">
                      {formattedExifData.shutterSpeed}
                    </span>
                  </div>
                )}

                {formattedExifData.iso && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <CarbonIsoOutline className="text-white/70 text-sm" />
                    <span className="text-xs">ISO {formattedExifData.iso}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 新增：拍摄模式信息 */}
            {(formattedExifData.exposureMode ||
              formattedExifData.meteringMode ||
              formattedExifData.whiteBalance ||
              formattedExifData.flash) && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">
                  拍摄模式
                </h4>
                <div className="space-y-1 text-sm">
                  {formattedExifData.exposureMode && (
                    <Row
                      label="曝光模式"
                      value={formattedExifData.exposureMode}
                    />
                  )}
                  {formattedExifData.meteringMode && (
                    <Row
                      label="测光模式"
                      value={formattedExifData.meteringMode}
                    />
                  )}
                  {formattedExifData.whiteBalance && (
                    <Row
                      label="白平衡"
                      value={formattedExifData.whiteBalance}
                    />
                  )}
                  {formattedExifData.flash && (
                    <Row label="闪光灯" value={formattedExifData.flash} />
                  )}
                </div>
              </div>
            )}

            {/* 新增：镜头信息 */}
            {(formattedExifData.lens ||
              formattedExifData.focalLength ||
              formattedExifData.focalLength35mm ||
              formattedExifData.maxAperture ||
              formattedExifData.digitalZoom) && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">
                  镜头信息
                </h4>
                <div className="space-y-1 text-sm">
                  {formattedExifData.lens && (
                    <Row label="镜头型号" value={formattedExifData.lens} />
                  )}
                  {formattedExifData.focalLength && (
                    <Row
                      label="实际焦距"
                      value={`${formattedExifData.focalLength}mm`}
                    />
                  )}
                  {formattedExifData.focalLength35mm && (
                    <Row
                      label="等效焦距"
                      value={`${formattedExifData.focalLength35mm}mm (35mm)`}
                    />
                  )}
                  {formattedExifData.maxAperture && (
                    <Row
                      label="最大光圈"
                      value={`f/${formattedExifData.maxAperture}`}
                    />
                  )}
                  {formattedExifData.digitalZoom && (
                    <Row
                      label="数字变焦"
                      value={`${formattedExifData.digitalZoom}x`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 新增：GPS位置信息 */}
            {formattedExifData.gps && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">
                  位置信息
                </h4>
                <div className="space-y-1 text-sm">
                  <Row label="纬度" value={formattedExifData.gps.latitude} />
                  <Row label="经度" value={formattedExifData.gps.longitude} />
                  <Row label="海拔" value={formattedExifData.gps.altitude} />
                </div>
              </div>
            )}

            {formattedExifData.dateTime && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">
                  拍摄时间
                </h4>
                <div className="text-sm text-white/80">
                  {typeof formattedExifData.dateTime === 'string'
                    ? new Date(formattedExifData.dateTime).toLocaleString()
                    : formattedExifData.dateTime instanceof Date
                      ? formattedExifData.dateTime.toLocaleString()
                      : String(formattedExifData.dateTime)}
                </div>
              </div>
            )}
          </Fragment>
        )}
      </div>
    </m.div>
  )
}

const formatExifData = (exif: Exif | null) => {
  if (!exif) return null

  const photo = exif.Photo || {}
  const image = exif.Image || {}
  const gps = exif.GPSInfo || {}

  // 等效焦距 (35mm)
  const focalLength35mm = photo.FocalLengthIn35mmFilm
    ? Math.round(photo.FocalLengthIn35mmFilm)
    : null

  // 实际焦距
  const focalLength = photo.FocalLength ? Math.round(photo.FocalLength) : null

  // ISO
  const iso = photo.ISOSpeedRatings || image.ISOSpeedRatings

  // 快门速度
  const exposureTime = photo.ExposureTime
  const shutterSpeed = exposureTime
    ? exposureTime >= 1
      ? `${exposureTime}s`
      : `1/${Math.round(1 / exposureTime)}`
    : null

  // 光圈
  const aperture = photo.FNumber ? `f/${photo.FNumber}` : null

  // 最大光圈
  const maxAperture = photo.MaxApertureValue
    ? `${Math.round(Math.pow(Math.sqrt(2), photo.MaxApertureValue) * 10) / 10}`
    : null

  // 相机信息
  const camera =
    image.Make && image.Model ? `${image.Make} ${image.Model}` : null

  // 镜头信息
  const lens =
    photo.LensModel || photo.LensSpecification || photo.LensMake || null

  // 软件信息
  const software = image.Software || null

  // 拍摄时间
  const dateTime = photo.DateTimeOriginal || photo.DateTime

  // 曝光模式
  const exposureModeMap: Record<number, string> = {
    0: '自动曝光',
    1: '手动曝光',
    2: '自动包围曝光',
  }
  const exposureMode =
    photo.ExposureMode !== undefined
      ? exposureModeMap[photo.ExposureMode] || `未知 (${photo.ExposureMode})`
      : null

  // 测光模式
  const meteringModeMap: Record<number, string> = {
    0: '未知',
    1: '平均测光',
    2: '中央重点测光',
    3: '点测光',
    4: '多点测光',
    5: '评价测光',
    6: '局部测光',
  }
  const meteringMode =
    photo.MeteringMode !== undefined
      ? meteringModeMap[photo.MeteringMode] || `未知 (${photo.MeteringMode})`
      : null

  // 白平衡
  const whiteBalanceMap: Record<number, string> = {
    0: '自动白平衡',
    1: '手动白平衡',
  }
  const whiteBalance =
    photo.WhiteBalance !== undefined
      ? whiteBalanceMap[photo.WhiteBalance] || `未知 (${photo.WhiteBalance})`
      : null

  // 闪光灯
  const flashMap: Record<number, string> = {
    0: '未闪光',
    1: '闪光',
    5: '闪光，未检测到回闪',
    7: '闪光，检测到回闪',
    9: '强制闪光',
    13: '强制闪光，未检测到回闪',
    15: '强制闪光，检测到回闪',
    16: '未闪光，强制关闭',
    24: '未闪光，自动模式',
    25: '闪光，自动模式',
    29: '闪光，自动模式，未检测到回闪',
    31: '闪光，自动模式，检测到回闪',
    32: '未提供闪光功能',
  }
  const flash =
    photo.Flash !== undefined
      ? flashMap[photo.Flash] || `未知 (${photo.Flash})`
      : null

  // 数字变焦
  const digitalZoom = photo.DigitalZoomRatio || null

  // 色彩空间
  const colorSpaceMap: Record<number, string> = {
    1: 'sRGB',
    65535: 'Adobe RGB',
  }
  const colorSpace =
    photo.ColorSpace !== undefined
      ? colorSpaceMap[photo.ColorSpace] || `未知 (${photo.ColorSpace})`
      : null

  // GPS信息
  let gpsInfo: {
    latitude: string | undefined
    longitude: string | undefined
    altitude: number | null
  } | null = null
  if (gps.GPSLatitude && gps.GPSLongitude) {
    const latitude = convertDMSToDD(gps.GPSLatitude, gps.GPSLatitudeRef || '')
    const longitude = convertDMSToDD(
      gps.GPSLongitude,
      gps.GPSLongitudeRef || '',
    )
    const altitude = gps.GPSAltitude || null

    gpsInfo = {
      latitude: latitude?.toFixed(6),
      longitude: longitude?.toFixed(6),
      altitude: altitude ? Math.round(altitude) : null,
    }
  }

  return {
    focalLength35mm,
    focalLength,
    iso,
    shutterSpeed,
    aperture,
    maxAperture,
    camera,
    lens,
    software,
    dateTime,
    exposureMode,
    meteringMode,
    whiteBalance,
    flash,
    digitalZoom,
    colorSpace,
    gps: gpsInfo,
  }
}

// 将度分秒格式转换为十进制度数
const convertDMSToDD = (dms: number[], ref: string): number | null => {
  if (!dms || dms.length !== 3) return null

  const [degrees, minutes, seconds] = dms
  let dd = degrees + minutes / 60 + seconds / 3600

  if (ref === 'S' || ref === 'W') {
    dd = dd * -1
  }

  return dd
}

const Row: FC<{
  label: string
  value: string | number | null | undefined | number[]
}> = ({ label, value }) => {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-secondary shrink-0">{label}</span>
      <span className="text-text text-right">
        {Array.isArray(value) ? value.join(' ') : value}
      </span>
    </div>
  )
}
