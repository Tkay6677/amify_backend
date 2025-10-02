import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testUpload() {
  try {
    console.log('🧪 Testing direct upload to amify-storage bucket...');
    console.log('📡 Supabase URL:', process.env.VITE_SUPABASE_URL);
    console.log('🔑 Using anonymous key (first 20 chars):', process.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');

    // Create a test file
    const testBuffer = Buffer.from('This is a test avatar upload');
    const fileName = `test-avatar-${Date.now()}.txt`;
    const filePath = `avatars/${fileName}`;

    console.log('📁 Uploading to path:', filePath);

    // Try to upload directly to the bucket
    const { data, error } = await supabase.storage
      .from('amify-storage')
      .upload(filePath, testBuffer, {
        contentType: 'text/plain',
        upsert: true
      });

    if (error) {
      console.error('❌ Upload failed:', error);
      console.log('\n💡 Possible solutions:');
      console.log('1. Check if the bucket "amify-storage" exists');
      console.log('2. Ensure the bucket is set to public');
      console.log('3. Check RLS policies on the storage bucket');
      console.log('4. Verify your Supabase project settings');
      return false;
    }

    console.log('✅ Upload successful!', data);

    // Try to get the public URL
    const { data: urlData } = supabase.storage
      .from('amify-storage')
      .getPublicUrl(filePath);

    console.log('🔗 Public URL:', urlData.publicUrl);

    // Try to delete the test file
    const { error: deleteError } = await supabase.storage
      .from('amify-storage')
      .remove([filePath]);

    if (deleteError) {
      console.warn('⚠️  Could not delete test file:', deleteError);
    } else {
      console.log('🧹 Test file cleaned up successfully');
    }

    console.log('\n🎉 Supabase storage is working correctly!');
    console.log('✅ Your image upload functionality should work now');
    return true;

  } catch (error) {
    console.error('💥 Test failed with error:', error);
    return false;
  }
}

// Run the test
testUpload().then(success => {
  if (success) {
    console.log('\n🚀 Ready to test avatar uploads in your app!');
  } else {
    console.log('\n🔧 Please check your Supabase configuration');
  }
});