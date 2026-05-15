// DigitalOcean Spaces uploader (S3-compatible).
// Returns the public CDN URL of the uploaded object.

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const SPACES_KEY      = process.env.SPACES_KEY;
const SPACES_SECRET   = process.env.SPACES_SECRET;
const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT; // e.g. https://nyc3.digitaloceanspaces.com
const SPACES_BUCKET   = process.env.SPACES_BUCKET;   // e.g. carfiablecdns

let _client = null;
function client() {
  if (!_client) {
    if (!SPACES_KEY || !SPACES_SECRET || !SPACES_ENDPOINT || !SPACES_BUCKET) {
      throw new Error('Missing DO Spaces env vars (SPACES_KEY, SPACES_SECRET, SPACES_ENDPOINT, SPACES_BUCKET)');
    }
    // Region is part of the endpoint but the SDK still wants something — use 'us-east-1' as placeholder.
    _client = new S3Client({
      endpoint: SPACES_ENDPOINT,
      region:   'us-east-1',
      credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
      forcePathStyle: false,
    });
  }
  return _client;
}

// Builds the public URL for the uploaded object.
// DO Spaces serves public objects at: https://{bucket}.{region}.digitaloceanspaces.com/{key}
// (CDN URL — .cdn. — only works if CDN is explicitly enabled on the bucket; the direct
// origin URL above always works for public-read objects.)
function publicUrl(key) {
  const host = new URL(SPACES_ENDPOINT).hostname; // nyc3.digitaloceanspaces.com
  const region = host.split('.')[0];              // nyc3
  return `https://${SPACES_BUCKET}.${region}.digitaloceanspaces.com/${key}`;
}

async function uploadToSpaces({ buffer, key, contentType = 'application/octet-stream' }) {
  await client().send(new PutObjectCommand({
    Bucket:      SPACES_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
    ACL:         'public-read',
    CacheControl: 'public, max-age=31536000', // 1 año (los reels son inmutables por nombre)
  }));
  return publicUrl(key);
}

module.exports = { uploadToSpaces };
