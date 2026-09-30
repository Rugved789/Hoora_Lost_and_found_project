import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Cloudinary is configured via CLOUDINARY_URL env var
// Format: cloudinary://api_key:api_secret@cloud_name

export async function uploadImage(buffer, folder = 'backtoyou') {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (!cloudinaryUrl || cloudinaryUrl.includes('api_key:api_secret') || cloudinaryUrl.includes('cloud_name')) {
    // Return sample image when Cloudinary is not configured
    return 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=60';
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    
    uploadStream.end(buffer);
  });
}
