import "./loadEnv.js";
import { BlobServiceClient } from "@azure/storage-blob";

const DEFAULT_CONTAINER_NAME = "insightiq-datasets";

let containerClientPromise;

function normalizeContainerName(value) {
  const normalized = String(value || DEFAULT_CONTAINER_NAME)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized.length < 3 || normalized.length > 63) {
    throw new Error(
      "AZURE_STORAGE_CONTAINER_NAME must be between 3 and 63 characters after normalization."
    );
  }

  return normalized;
}

function normalizeBlobSegment(value, fallback = "dataset") {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return normalized || fallback;
}

export function isAzureBlobStorageConfigured() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING);
}

async function getContainerClient() {
  if (!isAzureBlobStorageConfigured()) {
    return null;
  }

  if (!containerClientPromise) {
    containerClientPromise = (async () => {
      try {
        const serviceClient = BlobServiceClient.fromConnectionString(
          process.env.AZURE_STORAGE_CONNECTION_STRING
        );
        const containerClient = serviceClient.getContainerClient(
          normalizeContainerName(process.env.AZURE_STORAGE_CONTAINER_NAME)
        );

        await containerClient.createIfNotExists();

        return containerClient;
      } catch (error) {
        containerClientPromise = undefined;
        throw error;
      }
    })();
  }

  return containerClientPromise;
}

function buildBlobName(file, source) {
  const workspaceKey = normalizeBlobSegment(
    source?.workspaceId || source?.sessionId || "shared",
    "shared"
  );
  const uploadedDate = String(source?.uploadedAt || new Date().toISOString()).slice(0, 10);
  const uploadId = normalizeBlobSegment(source?.id, String(Date.now()));
  const originalName = normalizeBlobSegment(
    file?.originalname || source?.filename,
    "dataset"
  );

  return `${workspaceKey}/${uploadedDate}/${uploadId}-${originalName}`;
}

export async function uploadFileToAzureBlob(file, source) {
  if (!isAzureBlobStorageConfigured()) {
    return null;
  }

  try {
    const containerClient = await getContainerClient();
    const blobName = buildBlobName(file, source);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype || "application/octet-stream",
      },
    });

    return {
      provider: "azure_blob",
      container: containerClient.containerName,
      blobName,
    };
  } catch (error) {
    throw new Error(
      `Azure Blob Storage upload failed: ${error.message || error}`
    );
  }
}
