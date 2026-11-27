"use strict";

/* ==========================================
   LIVESTREAM PRO
   R2 MEDIA CLEANUP ENGINE V3.1
========================================== */

const crypto = require("crypto");

const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");


const PREFIX = "lsp-user-media-v31/";

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

const KINDS = new Set([
  "avatar",
  "cover",
  "post-image",
  "post-video",
  "chat-image",
  "chat-video"
]);


/* ==========================================
   01. R2 CONNECTION
========================================== */

let config;

function getConfig() {

  if (config) return config;

  const account =
    process.env.LSP_R2_MEDIA_ACCOUNT_ID;

  const bucket =
    process.env.LSP_R2_MEDIA_BUCKET;

  const accessKeyId =
    process.env.LSP_R2_MEDIA_ACCESS_KEY_ID;

  const secretAccessKey =
    process.env.LSP_R2_MEDIA_SECRET_ACCESS_KEY;

  const publicUrl = new URL(
    process.env.R2_PUBLIC_URL ||
    "https://invalid.invalid"
  );


  if (
    !/^[a-f0-9]{32}$/i.test(account || "") ||
    !bucket ||
    /backup/i.test(bucket) ||
    !accessKeyId ||
    !secretAccessKey ||
    !process.env.R2_PUBLIC_URL ||
    publicUrl.protocol !== "https:" ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.search ||
    publicUrl.hash ||
    publicUrl.pathname !== "/"
  ) {

    throw new Error("R2_MEDIA_CONFIG_INVALID");

  }


  config = {

    bucket,

    publicUrl: publicUrl.origin,

    client: new S3Client({

      region: "auto",

      endpoint:
        `https://${account}.r2.cloudflarestorage.com`,

      credentials: {
        accessKeyId,
        secretAccessKey
      },

      maxAttempts: 3

    })

  };

  return config;

}


/* ==========================================
   02. VERIFIED OWNER HASH
========================================== */

function ownerHash(uid) {

  if (
    typeof uid !== "string" ||
    !uid ||
    uid.length > 256
  ) {

    throw new Error("INVALID_MEDIA_OWNER");

  }

  return crypto
    .createHash("sha256")
    .update(uid)
    .digest("hex");

}


/* ==========================================
   03. SECURE R2 REQUEST
========================================== */

async function send(command) {

  return getConfig().client.send(
    command,
    {
      abortSignal: AbortSignal.timeout(15000)
    }
  );

}


/* ==========================================
   04. UPLOAD OWNED MEDIA
========================================== */

async function upload(uid, kind, file) {

  const owner = ownerHash(uid);

  const ext = Object.hasOwn(
    TYPES,
    file?.mimetype
  )
    ? TYPES[file.mimetype]
    : null;


  if (
    !KINDS.has(kind) ||
    !ext ||
    !Buffer.isBuffer(file.buffer) ||
    (
      kind.endsWith("video")
        ? !file.mimetype.startsWith("video/")
        : !file.mimetype.startsWith("image/")
    )
  ) {

    throw new Error("INVALID_MEDIA_TYPE");

  }


  const { bucket, publicUrl } = getConfig();


  const key =

    `${PREFIX}${owner}/${kind}/` +

    `${crypto.randomUUID()}.${ext}`;


  await send(

    new PutObjectCommand({

      Bucket: bucket,

      Key: key,

      Body: file.buffer,

      ContentType: file.mimetype,

      CacheControl: "no-store",

      Metadata: {

        "lsp-owner": owner,

        "lsp-schema": "v31"

      }

    })

  );


  return `${publicUrl}/${key}`;

}


/* ==========================================
   05. LIST OWNED MEDIA
========================================== */

async function listOwned(prefix) {

  const { bucket } = getConfig();

  const keys = [];

  let token;

  const seen = new Set();


  do {

    const result = await send(

      new ListObjectsV2Command({

        Bucket: bucket,

        Prefix: prefix,

        MaxKeys: 1000,

        ...(token
          ? { ContinuationToken: token }
          : {})

      })

    );


    for (const item of result.Contents || []) {

      if (
        typeof item.Key !== "string" ||
        !item.Key.startsWith(prefix)
      ) {

        throw new Error("R2_LIST_SCOPE_INVALID");

      }

      keys.push(item.Key);

      if (keys.length > 20000) {

        throw new Error("R2_MEDIA_LIMIT_REVIEW");

      }

    }


    if (!result.IsTruncated) break;

    token = result.NextContinuationToken;


    if (!token || seen.has(token)) {

      throw new Error("R2_LIST_INCOMPLETE");

    }

    seen.add(token);


  } while (true);


  return keys;

}


/* ==========================================
   06. ACCOUNT MEDIA CLEANUP
========================================== */

async function cleanup(uid, isReferenced) {

  const owner = ownerHash(uid);

  const prefix = `${PREFIX}${owner}/`;

  const { bucket } = getConfig();

  const keys = await listOwned(prefix);

  const review = [];

  let removed = 0;

  let deferred = false;


  for (const key of keys) {


    /* VALIDATE MEDIA KEY */

    const tail = key.slice(prefix.length);

    if (

      !/^(avatar|cover|post-image|post-video|chat-image|chat-video)\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/.test(tail)

    ) {

      review.push(key);

      continue;

    }


    /* BATCH LIMIT */

    if (removed >= 20) {

      deferred = true;

      break;

    }


    /* VERIFY OBJECT OWNERSHIP */

    const head = await send(

      new HeadObjectCommand({

        Bucket: bucket,

        Key: key

      })

    );


    if (

      head.Metadata?.["lsp-owner"] !== owner ||

      head.Metadata?.["lsp-schema"] !== "v31" ||

      isReferenced(key)

    ) {

      review.push(key);

      continue;

    }


    /* DELETE VERIFIED OBJECT */

    await send(

      new DeleteObjectCommand({

        Bucket: bucket,

        Key: key

      })

    );


    removed++;

  }


  /* Verify again on the next pass */

  return {

    state:

      !keys.length
        ? "done"
        : removed || deferred
          ? "pending"
          : "review",

    remaining: Math.max(
      0,
      keys.length - removed
    ),

    review: review.slice(0, 20)

  };

}


/* ==========================================
   EXPORT MODULE
========================================== */

module.exports = {
  upload,
  cleanup
};