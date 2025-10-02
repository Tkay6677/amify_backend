import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkStorage() {
  try {
    console.log('🔍 Checking Supabase storage configuration...');

    // Try to list buckets to see what's available
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error accessing storage:', listError);
      console.log('\n📋 Manual Setup Required:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to Storage section');
      console.log('3. Create a new bucket named "amify-storage"');
      console.log('4. Make it public');
      console.log('5. Set file size limit to 5MB');
      console.log('6. Allow image types: JPEG, PNG, WebP, GIF');
      return;
    }

    console.log('📦 Available buckets:', buckets.map(b => b.name));

    const bucketExists = buckets.some(bucket => bucket.name === 'amify-storage');

    if (bucketExists) {
      console.log('✅ amify-storage bucket found!');
      
      // Test upload to verify everything works
      console.log('🧪 Testing upload functionality...');
      
      const testBuffer = Buffer.from('test image data');
      const testPath = 'avatars/test-upload.txt';

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('amify-storage')
        .upload(testPath, testBuffer, {
          contentType: 'text/plain',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Test upload failed:', uploadError);
        console.log('\n📋 Please check bucket permissions in Supabase dashboard');
        return;
      }

      console.log('✅ Test upload successful');

      // Get public URL to verify access
      const { data: urlData } = supabase.storage
        .from('amify-storage')
        .getPublicUrl(testPath);

      console.log('🔗 Test file URL:', urlData.publicUrl);

      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from('amify-storage')
        .remove([testPath]);

      if (deleteError) {
        console.warn('⚠️  Could not delete test file:', deleteError);
      } else {
        console.log('🧹 Test file cleaned up');
      }

      console.log('\n🎉 Supabase storage is ready!');
      console.log('📁 Bucket: amify-storage');
      console.log('📂 Avatar path: avatars/');
      console.log('🔒 Public access: enabled');

    } else {
      console.log('❌ amify-storage bucket not found');
      console.log('\n📋 Manual Setup Required:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to Storage section');
      console.log('3. Create a new bucket named "amify-storage"');
      console.log('4. Make it public');
      console.log('5. Set file size limit to 5MB');
      console.log('6. Allow image types: JPEG, PNG, WebP, GIF');
      console.log('7. Run this script again to verify');
    }

  } catch (error) {
    console.error('💥 Check failed:', error);
  }
}

// Run the check
checkStorage();