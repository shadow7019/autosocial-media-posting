const chokidar = require('chokidar');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const WATCH_DIR = process.env.WATCH_DIR || path.join(__dirname, 'uploads');
const API_URL = process.env.API_URL || 'http://localhost:3000/api/posts';
const DAEMON_SECRET = process.env.DAEMON_SECRET;

if (!DAEMON_SECRET) {
  console.error('DAEMON_SECRET is not set in .env');
  process.exit(1);
}

// Ensure watch directory exists
const fs = require('fs');
if (!fs.existsSync(WATCH_DIR)) {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
}

console.log(`Watching for video files in: ${WATCH_DIR}`);

const watcher = chokidar.watch(WATCH_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true,
});

watcher.on('add', async (filePath) => {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  
  // Only watch for video files
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
  if (!videoExtensions.includes(ext)) {
    console.log(`Skipping non-video file: ${fileName}`);
    return;
  }

  console.log(`New video detected: ${fileName}`);

  try {
    const response = await axios.post(API_URL, {
      fileName,
      filePath: path.resolve(filePath),
      secret: DAEMON_SECRET,
    });
    console.log(`Successfully reported to API: ${response.data.message}`);
  } catch (error) {
    console.error(`Error reporting to API: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
  }
});

watcher.on('error', error => console.error(`Watcher error: ${error}`));

// Polling for due uploads
const POLL_URL = process.env.POLL_URL || 'http://localhost:3000/api/daemon/poll';
const POLL_INTERVAL = 60 * 1000; // 1 minute

async function pollForUploads() {
  console.log('Checking for due uploads...');
  try {
    const response = await axios.get(`${POLL_URL}?secret=${DAEMON_SECRET}`);
    const duePosts = response.data;

    if (duePosts.length > 0) {
      console.log(`Found ${duePosts.length} posts due for upload.`);
      for (const post of duePosts) {
        await executeUpload(post);
      }
    }
  } catch (error) {
    console.error(`Polling error: ${error.message}`);
  }
}

async function executeUpload(post) {
  console.log(`Executing upload for post ${post.id}: ${post.title}`);
  
  try {
    // Mark as uploading
    await axios.patch(POLL_URL, {
      postId: post.id,
      status: 'UPLOADING',
      secret: DAEMON_SECRET,
    });

    // Mock upload logic
    console.log(`Uploading file from ${post.filePath}...`);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate upload time

    // Success
    console.log(`Upload successful for post ${post.id}`);
    await axios.patch(POLL_URL, {
      postId: post.id,
      status: 'UPLOADED',
      platformPostId: `mock-id-${Date.now()}`,
      secret: DAEMON_SECRET,
    });
  } catch (error) {
    console.error(`Upload failed for post ${post.id}: ${error.message}`);
    await axios.patch(POLL_URL, {
      postId: post.id,
      status: 'FAILED',
      secret: DAEMON_SECRET,
    });
  }
}

setInterval(pollForUploads, POLL_INTERVAL);
pollForUploads(); // Initial check
