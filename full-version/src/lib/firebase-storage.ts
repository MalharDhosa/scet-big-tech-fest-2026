/**
 * Firebase Storage helpers for event logo uploads.
 * Logos are stored at: event-logos/{eventId}.{ext}
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, auth } from "./firebase";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/**
 * Compresses an image client-side to drastically reduce upload time.
 * Max dimensions: 600x600, Output format: WebP (80% quality).
 */
async function compressImage(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml") return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX_DIMENSION = 600;
      let { width, height } = img;
      
      if (width > height && width > MAX_DIMENSION) {
        height *= MAX_DIMENSION / width;
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width *= MAX_DIMENSION / height;
        height = MAX_DIMENSION;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);
      
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/webp",
        0.8 // 80% quality WebP is very small and fast to upload
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

/**
 * Upload an event logo image to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadEventLogo(eventId: string, file: File): Promise<string> {
  if (!auth.currentUser) {
    throw new Error("You must be logged in with an administrator account to upload logos.");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Please upload a PNG, JPEG, WebP, or SVG image.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 2 MB.");
  }

  try {
    // Compress the image before uploading to save time and space
    const processedBlob = await compressImage(file);
    const isSvg = file.type === "image/svg+xml";
    const ext = isSvg ? "svg" : "webp";
    const contentType = isSvg ? "image/svg+xml" : "image/webp";

    const storageRef = ref(storage, `event-logos/${eventId}.${ext}`);
    await uploadBytes(storageRef, processedBlob, {
      contentType,
      cacheControl: "public, max-age=86400",
    });
    
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    if (err?.code === "storage/unauthorized") {
      throw new Error("Permission Denied: Only authorized administrator accounts can upload event logos.");
    }
    throw err;
  }
}

/**
 * Delete an event logo from Firebase Storage.
 */
export async function deleteEventLogo(eventId: string, logoUrl: string): Promise<void> {
  try {
    // Extract the storage path from the URL
    const storageRef = ref(storage, `event-logos/${eventId}`);
    await deleteObject(storageRef);
  } catch {
    // If specific path fails, try parsing from URL
    try {
      const url = new URL(logoUrl);
      const path = decodeURIComponent(url.pathname.split("/o/")[1]?.split("?")[0] || "");
      if (path) {
        await deleteObject(ref(storage, path));
      }
    } catch {
      console.warn("Could not delete old logo, it may have been removed already.");
    }
  }
}

/**
 * Compresses an event poster image.
 * Posters benefit from higher resolution (up to 1600px) with WebP compression (85% quality).
 */
async function compressPosterImage(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml") return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX_DIMENSION = 1600;
      let { width, height } = img;
      
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);
      
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/webp",
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

/**
 * Upload an event poster image to Firebase Storage.
 * Posters are stored at: event-posters/{eventId}.{ext}
 * Returns the public download URL.
 */
export async function uploadEventPoster(eventId: string, file: File): Promise<string> {
  if (!auth.currentUser) {
    throw new Error("You must be logged in with an administrator account to upload posters.");
  }
  const MAX_POSTER_SIZE = 8 * 1024 * 1024; // 8 MB
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Please upload a PNG, JPEG, WebP, or SVG image.");
  }
  if (file.size > MAX_POSTER_SIZE) {
    throw new Error("Poster file is too large. Maximum size is 8 MB.");
  }

  try {
    const processedBlob = await compressPosterImage(file);
    const isSvg = file.type === "image/svg+xml";
    const ext = isSvg ? "svg" : "webp";
    const contentType = isSvg ? "image/svg+xml" : "image/webp";

    const storageRef = ref(storage, `event-posters/${eventId}.${ext}`);
    await uploadBytes(storageRef, processedBlob, {
      contentType,
      cacheControl: "public, max-age=86400",
    });
    
    return await getDownloadURL(storageRef);
  } catch (err: any) {
    if (err?.code === "storage/unauthorized") {
      throw new Error("Permission Denied: Only authorized administrator accounts can upload event posters.");
    }
    throw err;
  }
}

/**
 * Delete an event poster from Firebase Storage.
 */
export async function deleteEventPoster(eventId: string, posterUrl: string): Promise<void> {
  try {
    const storageRef = ref(storage, `event-posters/${eventId}`);
    await deleteObject(storageRef);
  } catch {
    try {
      const url = new URL(posterUrl);
      const path = decodeURIComponent(url.pathname.split("/o/")[1]?.split("?")[0] || "");
      if (path) {
        await deleteObject(ref(storage, path));
      }
    } catch {
      console.warn("Could not delete old poster, it may have been removed already.");
    }
  }
}

/**
 * Upload a team member profile photo to Firebase Storage.
 * Stores at: team-photos/{memberId}.webp
 */
export async function uploadTeamMemberPhoto(memberId: string, file: File): Promise<string> {
  if (!auth.currentUser) {
    throw new Error("You must be logged in as an administrator to upload photos.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 2 MB.`);
  }

  try {
    const processedBlob = await compressImage(file);
    const storageRef = ref(storage, `team-photos/${memberId}.webp`);
    await uploadBytes(storageRef, processedBlob, {
      contentType: "image/webp",
      cacheControl: "public, max-age=86400",
    });

    return await getDownloadURL(storageRef);
  } catch (err: any) {
    if (err?.code === "storage/unauthorized") {
      throw new Error("Permission Denied: Only authorized administrators can upload photos.");
    }
    throw err;
  }
}

