// Cloudflare R2 (S3-совместимое хранилище). Используется качалкой и функцией /api/media на Vercel.
// Файл начинается с «_», поэтому Vercel не делает из него отдельный адрес /api/_r2.
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Нужны переменные: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
export function r2FromEnv(env = process.env) {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) return null
  const endpoint = env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: Boolean(env.R2_ENDPOINT), // для тестов с локальным S3
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  })
  const Bucket = env.R2_BUCKET
  return {
    put: (Key, Body, ContentType) => s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType })),
    sign: (Key, expiresIn = 60 * 60 * 24) => getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn }),
    // Сколько места занимают файлы в папке prefix: { bytes, files }
    usage: async (Prefix) => {
      let bytes = 0
      let files = 0
      let ContinuationToken
      do {
        const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }))
        for (const o of r.Contents ?? []) { bytes += o.Size ?? 0; files++ }
        ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined
      } while (ContinuationToken)
      return { bytes, files }
    },
    remove: (keys) => keys.length && s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } })),
  }
}
